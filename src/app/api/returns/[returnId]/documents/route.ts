import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import {
  requireAuth,
  parseBody,
  json,
  jsonError,
  getReturnScoped,
  getSearchParams,
} from "@/lib/api/helpers";
import { logDocumentEvent } from "@/lib/audit/logger";
import type { DocumentCategory, DocumentStatus } from "@/generated/prisma/enums";

const CreateDocumentSchema = z.object({
  category: z.enum([
    "W2", "W2_G", "F1099_INT", "F1099_DIV", "F1099_NEC", "F1099_MISC",
    "F1099_B", "F1099_R", "F1099_SSA", "F1099_G", "F1095_A",
    "K1_1065", "K1_1120S", "K1_1041", "BANK_STATEMENT", "MORTGAGE_STATEMENT",
    "PROPERTY_TAX", "CHARITABLE_RECEIPT", "PRIOR_RETURN",
    "DEPRECIATION_SCHEDULE", "FINANCIAL_STATEMENT", "OTHER",
  ]),
  label: z.string().min(1).max(300),
  requestNote: z.string().max(2000).optional(),
});

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ returnId: string }> }
) {
  const { user, error } = await requireAuth();
  if (error) return error;

  const { returnId } = await params;

  const taxReturn = await getReturnScoped(returnId, user.firmId);
  if (!taxReturn) return jsonError("Not found", 404);

  const searchParams = getSearchParams(req);
  const status = searchParams.get("status") as DocumentStatus | null;
  const category = searchParams.get("category") as DocumentCategory | null;

  const documents = await prisma.document.findMany({
    where: {
      returnId,
      ...(status ? { status } : {}),
      ...(category ? { category } : {}),
    },
    orderBy: { createdAt: "desc" },
  });

  return json({ documents });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ returnId: string }> }
) {
  const { user, error } = await requireAuth("PREPARER");
  if (error) return error;

  const { returnId } = await params;

  const taxReturn = await prisma.taxReturn.findFirst({
    where: { id: returnId, entity: { client: { firmId: user.firmId } } },
    include: { entity: { select: { clientId: true } } },
  });
  if (!taxReturn) return jsonError("Not found", 404);

  const { data, error: parseError } = await parseBody(req, CreateDocumentSchema);
  if (parseError) return parseError;

  const document = await prisma.document.create({
    data: {
      returnId,
      clientId: taxReturn.entity.clientId,
      category: data.category,
      label: data.label,
      requestNote: data.requestNote,
      status: "REQUESTED",
    },
  });

  await logDocumentEvent(returnId, user.id, "DOCUMENT_REQUESTED", document.id, data.label);

  return json({ document }, 201);
}
