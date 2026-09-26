import { NextResponse, type NextRequest } from 'next/server';
import { searchCharacters } from '@/core/raiderio/search';
import { parseRegion } from '@/server/route-helpers';

export async function GET(request: NextRequest) {
  const region = parseRegion(request.nextUrl.searchParams.get('region'));
  if (!region) return NextResponse.json({ error: 'Unknown region' }, { status: 400 });
  try {
    return NextResponse.json(await searchCharacters(fetch, region, request.nextUrl.searchParams.get('term') ?? ''));
  } catch {
    return NextResponse.json({ error: 'Search is unavailable. Pick the realm yourself.' }, { status: 502 });
  }
}
