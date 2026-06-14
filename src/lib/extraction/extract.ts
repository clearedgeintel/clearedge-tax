import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "@/lib/db";
import { downloadObject } from "@/lib/storage";
import { logAuditEvent } from "@/lib/audit/logger";
import type { DocumentCategory } from "@/generated/prisma/enums";
import { EXTRACTORS } from "./schemas";
import type { Prisma } from "@/generated/prisma/client";

const MODEL = "claude-sonnet-4-6";
const MAX_TOKENS = 2048;

let cachedClient: Anthropic | null = null;
function getClient(): Anthropic | null {
  if (cachedClient) return cachedClient;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;
  cachedClient = new Anthropic({ apiKey });
  return cachedClient;
}

export function extractionConfigured(): boolean {
  return !!process.env.ANTHROPIC_API_KEY;
}

export interface ExtractResult {
  status: "SUCCESS" | "FAILED" | "UNSUPPORTED" | "SKIPPED";
  message?: string;
}

/**
 * Runs structured-output extraction against a Document via Claude's vision
 * + tool-use API. Idempotent: if a DocumentExtraction row already exists in
 * SUCCESS or REVIEWED status, returns SKIPPED.
 *
 * Behavior when the API key is missing: writes a FAILED row with a clear
 * error message so it shows up in admin views and can be retried later.
 */
export async function extractDocument(
  documentId: string,
  actorUserId?: string
): Promise<ExtractResult> {
  const document = await prisma.document.findUnique({
    where: { id: documentId },
    include: { extraction: true },
  });
  if (!document) return { status: "FAILED", message: "Document not found" };

  if (
    document.extraction &&
    (document.extraction.status === "SUCCESS" ||
      document.extraction.status === "REVIEWED")
  ) {
    return { status: "SKIPPED", message: "Already extracted" };
  }
  if (!document.storageKey || !document.mimeType) {
    return await markFailed(
      documentId,
      "Document has no uploaded file to extract from"
    );
  }

  const extractor = EXTRACTORS[document.category as DocumentCategory];
  if (!extractor) {
    await prisma.documentExtraction.upsert({
      where: { documentId },
      create: { documentId, status: "UNSUPPORTED" },
      update: { status: "UNSUPPORTED", errorMessage: null, fields: undefined },
    });
    return {
      status: "UNSUPPORTED",
      message: `No extractor for category ${document.category}`,
    };
  }

  const client = getClient();
  if (!client) {
    return await markFailed(
      documentId,
      "ANTHROPIC_API_KEY not set; extraction disabled"
    );
  }

  // Mark PENDING up front so the UI can show a spinner while we work.
  await prisma.documentExtraction.upsert({
    where: { documentId },
    create: { documentId, status: "PENDING" },
    update: { status: "PENDING", errorMessage: null },
  });

  try {
    const bytes = await downloadObject(document.storageKey);
    const base64 = bytes.toString("base64");
    const mediaType = document.mimeType;

    const isPdf = mediaType === "application/pdf";
    const isImage = mediaType.startsWith("image/");
    if (!isPdf && !isImage) {
      return await markFailed(
        documentId,
        `Cannot extract from ${mediaType}; supported: image/* and application/pdf`
      );
    }

    const contentBlock = isPdf
      ? {
          type: "document" as const,
          source: {
            type: "base64" as const,
            media_type: "application/pdf" as const,
            data: base64,
          },
        }
      : {
          type: "image" as const,
          source: {
            type: "base64" as const,
            media_type: mediaType as
              | "image/jpeg"
              | "image/png"
              | "image/gif"
              | "image/webp",
            data: base64,
          },
        };

    const response = await client.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      tools: [
        {
          name: extractor.toolName,
          description: extractor.toolDescription,
          input_schema: extractor.inputSchema as Anthropic.Tool["input_schema"],
        },
      ],
      tool_choice: { type: "tool", name: extractor.toolName },
      messages: [
        {
          role: "user",
          content: [
            contentBlock,
            {
              type: "text",
              text: `Extract the fields from this document and call the ${extractor.toolName} tool with the result.\n\n${extractor.instructions}`,
            },
          ],
        },
      ],
    });

    const toolUse = response.content.find(
      (b): b is Anthropic.ToolUseBlock => b.type === "tool_use"
    );
    if (!toolUse) {
      return await markFailed(
        documentId,
        "Model did not produce a tool-use response"
      );
    }

    const parsed = extractor.schema.safeParse(toolUse.input);
    if (!parsed.success) {
      return await markFailed(
        documentId,
        `Extracted fields failed validation: ${parsed.error.message}`
      );
    }

    await prisma.documentExtraction.update({
      where: { documentId },
      data: {
        status: "SUCCESS",
        fields: parsed.data as Prisma.InputJsonValue,
        model: MODEL,
        errorMessage: null,
      },
    });

    if (actorUserId) {
      await logAuditEvent({
        userId: actorUserId,
        eventType: "DOCUMENT_EXTRACTED",
        eventCategory: "DOCUMENT",
        description: `Auto-extracted fields from ${document.label}`,
        metadata: { documentId, category: document.category, model: MODEL },
      });
    }

    return { status: "SUCCESS" };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return await markFailed(documentId, message);
  }
}

async function markFailed(
  documentId: string,
  message: string
): Promise<ExtractResult> {
  await prisma.documentExtraction.upsert({
    where: { documentId },
    create: { documentId, status: "FAILED", errorMessage: message },
    update: {
      status: "FAILED",
      errorMessage: message,
      fields: undefined,
    },
  });
  return { status: "FAILED", message };
}
