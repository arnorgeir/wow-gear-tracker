import { NextResponse, type NextRequest } from 'next/server';
import { searchCharacters, type CharacterSearchResult } from '@/core/raiderio/search';
import { ensureClassIcons } from '@/core/sync/reference-sync';
import { parseRegion } from '@/server/route-helpers';
import { getServices, type Services } from '@/server/services';

export async function GET(request: NextRequest) {
  const region = parseRegion(request.nextUrl.searchParams.get('region'));
  if (!region) return NextResponse.json({ error: 'Unknown region' }, { status: 400 });

  let services: Services;
  let results: CharacterSearchResult[];
  try {
    services = await getServices();
    results = await searchCharacters(services.fetchFn, region, request.nextUrl.searchParams.get('term') ?? '');
  } catch {
    return NextResponse.json({ error: 'Search is unavailable. Pick the realm yourself.' }, { status: 502 });
  }

  // Class icons are a nice to have: without them, results show the class-colored initial.
  let icons = new Map<string, string | null>();
  try {
    icons = await ensureClassIcons({ db: services.db, blizzard: services.blizzard, now: services.now() }, region);
  } catch {
    // Keep the empty map.
  }
  return NextResponse.json(results.map((r) => ({ ...r, classIconUrl: icons.get(r.className) ?? null })));
}
