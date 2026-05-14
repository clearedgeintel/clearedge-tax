import { NextRequest } from "next/server";
import {
  requireAuth,
  json,
  jsonError,
  getReturnScoped,
} from "@/lib/api/helpers";
import { isManager } from "@/lib/utils/permissions";
import { generateExportPackage } from "@/lib/export/package-generator";
import { logAuditEvent } from "@/lib/audit/logger";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ returnId: string }> }
) {
  const { user, error } = await requireAuth("PREPARER");
  if (error) return error;

  const { returnId } = await params;

  const taxReturn = await getReturnScoped(returnId, user.firmId);
  if (!taxReturn) return jsonError("Not found", 404);

  if (taxReturn.status !== "APPROVED" && taxReturn.status !== "EXPORTED") {
    return jsonError("Return must be approved before export", 400);
  }

  try {
    const exportPackage = await generateExportPackage(returnId);

    await logAuditEvent({
      returnId,
      userId: user.id,
      eventType: "RETURN_EXPORTED",
      eventCategory: "RETURN",
      description: "Export package generated",
      critical: true,
    });

    return json({ export: exportPackage });
  } catch (err) {
    return jsonError(
      err instanceof Error ? err.message : "Export failed",
      400
    );
  }
}
