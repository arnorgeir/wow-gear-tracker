import { NextResponse, type NextRequest } from 'next/server';
import { getServices } from '@/server/services';
import { errorResponse, parseRegion } from '@/server/route-helpers';

export async function GET(request: NextRequest) {
  const region = parseRegion(request.nextUrl.searchParams.get('region'));
  if (!region) return NextResponse.json({ error: 'Unknown region' }, { status: 400 });
  try {
    const realms = await (await getServices()).blizzard.getRealms(region);
    return NextResponse.json([...realms].sort((a, b) => a.name.localeCompare(b.name)));
  } catch (err) {
    return errorResponse(err);
  }
}
