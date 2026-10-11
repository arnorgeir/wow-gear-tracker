import { NextResponse, type NextRequest } from 'next/server';
import { lookupItem } from '@/core/bis/edits';
import { getServices } from '@/server/services';
import { errorResponse, parseRowRef } from '@/server/route-helpers';

// Looks an item up by ID or Wowhead link. May call Blizzard and cache the item, so it is a POST.
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const s = await getServices();
    const deps = { db: s.db, blizzard: s.blizzard, now: s.now(), accountId: s.currentAccountId() };
    return NextResponse.json(await lookupItem(deps, parseRowRef(body), typeof body.input === 'string' ? body.input : ''));
  } catch (err) {
    return errorResponse(err);
  }
}
