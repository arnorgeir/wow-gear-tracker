import { NextResponse, type NextRequest } from 'next/server';
import { knownSpecSlug } from '@/core/bis/edits';
import { UserError } from '@/core/errors';
import { syncBisLists } from '@/core/sync/reference-sync';
import { getServices } from '@/server/services';
import { errorResponse } from '@/server/route-helpers';

// The slug must name a known spec, so a client can't aim the fetch at an arbitrary Method page.
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { specSlug?: unknown };
    const { db, bisSource, now } = await getServices();
    if (typeof body.specSlug !== 'string' || !(await knownSpecSlug(db, body.specSlug))) throw new UserError('Unknown spec.');
    await syncBisLists({ db, source: bisSource, now: now() }, body.specSlug);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}
