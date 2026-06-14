import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth, json, jsonError } from "@/lib/api/helpers";
import { sendCampaign } from "@/lib/campaigns";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ campaignId: string }> }
) {
  const { user, error } = await requireAuth("PREPARER");
  if (error) return error;

  const { campaignId } = await params;
  const campaign = await prisma.documentCampaign.findFirst({
    where: { id: campaignId, client: { firmId: user.firmId } },
    select: { id: true, status: true },
  });
  if (!campaign) return jsonError("Not found", 404);

  try {
    const result = await sendCampaign(campaignId, user.id);
    return json(result);
  } catch (e) {
    return jsonError(
      e instanceof Error ? e.message : "Failed to send campaign",
      500
    );
  }
}
