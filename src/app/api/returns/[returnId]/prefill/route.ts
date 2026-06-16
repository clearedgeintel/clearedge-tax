import { NextRequest } from "next/server";
import { z } from "zod";
import {
  requireAuth,
  parseBody,
  json,
  jsonError,
  getReturnScoped,
} from "@/lib/api/helpers";
import {
  applyReturnPrefills,
  proposeReturnPrefills,
} from "@/lib/prefill";

const PrefillSchema = z
  .object({
    overwrite: z.boolean().optional(),
    dryRun: z.boolean().optional(),
  })
  .optional();

/**
 * Preview proposed prefills without applying them. Staff-or-client (the
 * existing return-scoping covers access).
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ returnId: string }> }
) {
  const { user, error } = await requireAuth();
  if (error) return error;

  const { returnId } = await params;
  const taxReturn = await getReturnScoped(returnId, user.firmId);
  if (!taxReturn) return jsonError("Not found", 404);

  const proposals = await proposeReturnPrefills(returnId);
  return json({ proposals });
}

/**
 * Apply the proposed prefills. By default does not overwrite existing
 * answers; pass `overwrite: true` to replace. `dryRun: true` returns the
 * proposals without writing.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ returnId: string }> }
) {
  const { user, error } = await requireAuth();
  if (error) return error;

  const { returnId } = await params;
  const taxReturn = await getReturnScoped(returnId, user.firmId);
  if (!taxReturn) return jsonError("Not found", 404);

  const { data, error: parseError } = await parseBody(req, PrefillSchema);
  if (parseError) return parseError;

  if (data?.dryRun) {
    const proposals = await proposeReturnPrefills(returnId);
    return json({ proposals });
  }

  const result = await applyReturnPrefills(returnId, user.id, {
    overwrite: !!data?.overwrite,
  });
  return json(result);
}
