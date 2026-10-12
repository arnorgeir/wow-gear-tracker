import { NextResponse, type NextRequest } from 'next/server';
import { knownSpecSlug } from '@/core/bis/edits';
import { copyManual } from '@/core/bis/spec-base';
import { UserError } from '@/core/errors';
import { FETCHED_SOURCES, type FetchedSourceId } from '@/core/types';
import { getServices } from '@/server/services';
import { errorResponse } from '@/server/route-helpers';

/** "Copy again": replaces the spec's manual lists with a fetched source's lists. */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const s = await getServices();
    if (typeof body.specSlug !== 'string' || !(await knownSpecSlug(s.db, body.specSlug))) throw new UserError('Unknown spec.');
    if (!(FETCHED_SOURCES as readonly unknown[]).includes(body.from)) throw new UserError('Unknown source.');
    await copyManual(s.db, s.currentAccountId(), body.specSlug, body.from as FetchedSourceId, s.now());
    return NextResponse.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}
