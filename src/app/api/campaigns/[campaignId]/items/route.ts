import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import {
  requireAuth,
  parseBody,
  json,
  jsonError,
} from "@/lib/api/helpers";

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

const AddItemSchema = z.object({
  category: z.enum(CATEGORY_VALUES),
  label: z.string().min(1).max(300),
  requestNote: z.string().max(2000).optional(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ campaignId: string }> }
) {
  const { user, error } = await requireAuth("PREPARER");
  if (error) return error;

  const { campaignId } = await params;

  const campaign = await prisma.documentCampaign.findFirst({
    where: { id: campaignId, client: { firmId: user.firmId } },
    select: {
      id: true,
      clientId: true,
      taxYear: true,
      status: true,
    },
  });
  if (!campaign) return jsonError("Not found", 404);

  // Adding items is only allowed while the campaign is DRAFT. Once sent,
  // the item list is locked — additions become standalone requests via
  // the regular doc-request endpoints instead.
  if (campaign.status !== "DRAFT") {
    return jsonError(
      "Items can only be added while the campaign is in DRAFT status",
      400
    );
  }

  const { data, error: parseError } = await parseBody(req, AddItemSchema);
  if (parseError) return parseError;

  const item = await prisma.document.create({
    data: {
      clientId: campaign.clientId,
      campaignId: campaign.id,
      taxYear: campaign.taxYear,
      category: data.category,
      label: data.label,
      requestNote: data.requestNote,
      status: "REQUESTED",
    },
  });

  return json({ item }, 201);
}
