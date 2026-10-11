import { NextResponse, type NextRequest } from 'next/server';
import { searchItems } from '@/core/bis/edits';
import { getServices } from '@/server/services';
import { errorResponse, parseRowRef } from '@/server/route-helpers';

// Reads only: local season loot and the item catalog. Lookups that call Blizzard go through POST /api/items/lookup.
export async function GET(request: NextRequest) {
  try {
    const params = Object.fromEntries(request.nextUrl.searchParams);
    const { db } = await getServices();
    return NextResponse.json(await searchItems(db, parseRowRef(params), params.q ?? ''));
  } catch (err) {
    return errorResponse(err);
  }
}
