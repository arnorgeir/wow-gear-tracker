import { NextResponse, type NextRequest } from 'next/server';
import { knownSpecSlug } from '@/core/bis/edits';
import { updateSpecSettings } from '@/core/db/queries/bis-settings';
import { UserError } from '@/core/errors';
import type { SpecSettings } from '@/core/types';
import { getServices } from '@/server/services';
import { errorResponse, parseListType } from '@/server/route-helpers';

export async function PATCH(request: NextRequest) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const s = await getServices();
    if (typeof body.specSlug !== 'string' || !(await knownSpecSlug(s.db, body.specSlug))) throw new UserError('Unknown spec.');
    const patch: Partial<SpecSettings> = {};
    if (body.listType !== undefined) patch.listType = parseListType(body.listType);
    if (typeof body.statsMatter === 'boolean') patch.statsMatter = body.statsMatter;
    if (Object.keys(patch).length === 0) throw new UserError('Nothing to change.');
    await updateSpecSettings(s.db, s.currentAccountId(), body.specSlug, patch);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}
