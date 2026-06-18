import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireAuth, parseBody, json, jsonError } from "@/lib/api/helpers";
import { cancelSignatureRequest } from "@/lib/signatures";

const CancelSchema = z.object({
  reason: z.string().max(500).optional(),
}).optional();

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ signatureId: string }> }
) {
  const { user, error } = await requireAuth("PREPARER");
  if (error) return error;

  const { signatureId } = await params;

  const row = await prisma.signatureRequest.findFirst({
    where: { id: signatureId, client: { firmId: user.firmId } },
    select: { id: true },
  });
  if (!row) return jsonError("Not found", 404);

  const { data, error: parseError } = await parseBody(req, CancelSchema);
  if (parseError) return parseError;

  try {
    await cancelSignatureRequest(signatureId, user.id, data?.reason);
    return json({ cancelled: true });
  } catch (e) {
    return jsonError(
      e instanceof Error ? e.message : "Cancel failed",
      500
    );
  }
}
