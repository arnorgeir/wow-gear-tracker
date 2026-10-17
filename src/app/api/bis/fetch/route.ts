import { NextResponse, type NextRequest } from 'next/server';
import { knownSpecSlug, regionForSpec } from '@/core/bis/edits';
import { getSpecSettings } from '@/core/db/queries/bis-settings';
import { UserError } from '@/core/errors';
import { syncBisLists } from '@/core/sync/reference/bis-lists';
import { getServices } from '@/server/services';
import { errorResponse } from '@/server/route-helpers';

// The slug must name a known spec, so a client can't aim the fetch at an arbitrary page.
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { specSlug?: unknown };
    const { db, bisSources, blizzard, now, currentAccountId } = await getServices();
    if (typeof body.specSlug !== 'string' || !(await knownSpecSlug(db, body.specSlug))) throw new UserError('Unknown spec.');
    const { source } = await getSpecSettings(db, currentAccountId(), body.specSlug);
    if (source === 'manual') throw new UserError('Manual lists aren’t fetched.');
    const region = await regionForSpec(db, body.specSlug);
    await syncBisLists({ db, source: bisSources[source], sourceId: source, blizzard, region, now: now() }, body.specSlug);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}
