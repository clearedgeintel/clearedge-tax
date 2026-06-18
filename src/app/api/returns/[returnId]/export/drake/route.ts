import { NextRequest } from "next/server";
import {
  requireAuth,
  jsonError,
  getReturnScoped,
} from "@/lib/api/helpers";
import { logAuditEvent, logPIIAccess } from "@/lib/audit/logger";
import { generateDrakeCsv } from "@/lib/export/drake-csv";

/**
 * GET /api/returns/[returnId]/export/drake.csv
 *
 * Returns a Drake-format CSV download for an APPROVED or EXPORTED return.
 * Requires PREPARER or higher (same as the JSON export). Logs both a
 * RETURN_EXPORTED audit event and a PII_FULL_VIEW event because the CSV
 * embeds the decrypted TIN and full interview answers.
 */
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
    return jsonError(
      "Return must be approved before export",
      400
    );
  }

  try {
    const csv = await generateDrakeCsv({ returnId });

    await logAuditEvent({
      returnId,
      userId: user.id,
      eventType: "RETURN_EXPORTED_DRAKE_CSV",
      eventCategory: "RETURN",
      description: "Drake CSV export downloaded",
      critical: true,
    });
    // The Drake CSV always surfaces decrypted PII (TIN + interview answers)
    // when those values exist. Log a PII access event for the export so the
    // audit trail records the access regardless of which fields populated.
    await logPIIAccess(
      user.id,
      "tin",
      { entityId: taxReturn.entityId, returnId },
      "Drake CSV export downloaded"
    );

    const filename = `return-${returnId}-ty${taxReturn.taxYear}-drake.csv`;
    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    return jsonError(
      e instanceof Error ? e.message : "Export failed",
      400
    );
  }
}
