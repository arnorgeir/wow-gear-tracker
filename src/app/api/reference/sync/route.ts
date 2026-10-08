import { NextResponse } from 'next/server';
import { syncReference } from '@/core/sync/reference-run';
import { getServices } from '@/server/services';
import { errorResponse } from '@/server/route-helpers';

// No input: the server picks what to refresh from the tracked characters, so a client can't aim it at an arbitrary Method page.
export async function POST() {
  try {
    const { db, bisSource, fetchRaidbots, blizzard, now } = await getServices();
    return NextResponse.json({ result: await syncReference({ db, bisSource, fetchRaidbots, blizzard, now: now() }) });
  } catch (err) {
    return errorResponse(err);
  }
}
