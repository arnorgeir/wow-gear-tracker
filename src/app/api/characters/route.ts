import { NextResponse, type NextRequest } from 'next/server';
import { addCharacter } from '@/core/characters/add-character';
import { getServices } from '@/server/services';
import { errorResponse, parseRegion } from '@/server/route-helpers';

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { region?: unknown; name?: unknown; realmId?: unknown; realmSlug?: unknown };
    const region = parseRegion(body.region);
    if (!region || typeof body.name !== 'string') return NextResponse.json({ error: 'Region and name are required.' }, { status: 400 });
    const services = await getServices();
    const result = await addCharacter(services, {
      region,
      name: body.name,
      realmId: typeof body.realmId === 'number' ? body.realmId : undefined,
      realmSlug: typeof body.realmSlug === 'string' ? body.realmSlug : undefined,
    });
    return NextResponse.json(result, { status: result.created ? 201 : 200 });
  } catch (err) {
    return errorResponse(err);
  }
}
