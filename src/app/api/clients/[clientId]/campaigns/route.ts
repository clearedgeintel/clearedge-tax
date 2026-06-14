import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import {
  requireAuth,
  parseBody,
  json,
  jsonError,
  getClientScoped,
} from "@/lib/api/helpers";
import type { DocumentCategory } from "@/generated/prisma/enums";
import { createCampaign } from "@/lib/campaigns";
import { getTemplate } from "@/lib/campaigns/templates";

const CATEGORY_VALUES = [
  "W2",
  "W2_G",
  "F1099_INT",
  "F1099_DIV",
  "F1099_NEC",
  "F1099_MISC",
  "F1099_B",
  "F1099_R",
  "F1099_SSA",
  "F1099_G",
  "F1095_A",
  "K1_1065",
  "K1_1120S",
  "K1_1041",
  "BANK_STATEMENT",
  "MORTGAGE_STATEMENT",
  "PROPERTY_TAX",
  "CHARITABLE_RECEIPT",
  "PRIOR_RETURN",
  "DEPRECIATION_SCHEDULE",
  "FINANCIAL_STATEMENT",
  "OTHER",
] as const;

const CreateCampaignSchema = z.object({
  taxYear: z.number().int().min(2020).max(2099),
  templateId: z.string().optional(),
  items: z
    .array(
      z.object({
        category: z.enum(CATEGORY_VALUES),
        label: z.string().min(1).max(300),
      })
    )
    .optional(),
  message: z.string().max(5000).optional(),
  deadline: z.string().optional(),
});

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ clientId: string }> }
) {
  const { user, error } = await requireAuth("PREPARER");
  if (error) return error;

  const { clientId } = await params;
  const client = await getClientScoped(clientId, user.firmId);
  if (!client) return jsonError("Not found", 404);

  const campaigns = await prisma.documentCampaign.findMany({
    where: { clientId },
    orderBy: { taxYear: "desc" },
    include: {
      _count: { select: { documents: true } },
    },
  });

  return json({ campaigns });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ clientId: string }> }
) {
  const { user, error } = await requireAuth("PREPARER");
  if (error) return error;

  const { clientId } = await params;
  const client = await getClientScoped(clientId, user.firmId);
  if (!client) return jsonError("Not found", 404);

  const { data, error: parseError } = await parseBody(req, CreateCampaignSchema);
  if (parseError) return parseError;

  // Resolve items: explicit list wins, otherwise use the template's items.
  let items = data.items as { category: DocumentCategory; label: string }[] | undefined;
  if (!items || items.length === 0) {
    if (!data.templateId) {
      return jsonError("Must provide items or templateId", 400);
    }
    const template = getTemplate(data.templateId);
    if (!template) {
      return jsonError(`Unknown template ${data.templateId}`, 400);
    }
    items = template.items;
  }

  // Reject duplicates (the schema has a unique index but a clean 409 is
  // friendlier than a Prisma error).
  const existing = await prisma.documentCampaign.findUnique({
    where: { clientId_taxYear: { clientId, taxYear: data.taxYear } },
  });
  if (existing) {
    return jsonError(
      `A campaign already exists for ${client.displayName} for tax year ${data.taxYear}`,
      409
    );
  }

  try {
    const result = await createCampaign({
      clientId,
      taxYear: data.taxYear,
      items,
      message: data.message,
      deadline: data.deadline ? new Date(data.deadline) : null,
      createdBy: user.id,
    });
    return json({ campaign: result }, 201);
  } catch (e) {
    return jsonError(
      e instanceof Error ? e.message : "Failed to create campaign",
      500
    );
  }
}
