import { NextResponse, type NextRequest } from 'next/server';
import { knownSpecSlug } from '@/core/bis/edits';
import { chooseManual } from '@/core/bis/spec-base';
import { updateSpecSettings } from '@/core/db/queries/bis-settings';
import { UserError } from '@/core/errors';
import { isOfferedSource, type SpecSettings } from '@/core/types';
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
    if (body.source !== undefined && !isOfferedSource(body.source)) throw new UserError('Unknown source.');
    if (body.source !== undefined && body.source !== 'manual') patch.source = body.source;
    if (Object.keys(patch).length === 0 && body.source !== 'manual') throw new UserError('Nothing to change.');
    // Manual first: it can refuse, and then nothing else changes either.
    if (body.source === 'manual') await chooseManual(s.db, s.currentAccountId(), body.specSlug, s.now());
    if (Object.keys(patch).length > 0) await updateSpecSettings(s.db, s.currentAccountId(), body.specSlug, patch);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}
