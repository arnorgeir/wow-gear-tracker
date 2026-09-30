import { NextResponse, type NextRequest } from 'next/server';
import { syncSeason } from '@/core/sync/season-sync';
import { getServices } from '@/server/services';
import { errorResponse, parseRegion } from '@/server/route-helpers';

export async function POST(request: NextRequest) {
  const region = parseRegion(request.nextUrl.searchParams.get('region'));
  if (!region) return NextResponse.json({ error: 'Unknown region' }, { status: 400 });
  try {
    const { db, blizzard, fetchFn, now } = await getServices();
    return NextResponse.json({ result: await syncSeason({ db, blizzard, fetchFn, now: now(), region }) });
  } catch (err) {
    return errorResponse(err);
  }
}
