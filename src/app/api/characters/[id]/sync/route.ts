import { NextResponse, type NextRequest } from 'next/server';
import { getCharacter } from '@/core/db/queries/characters';
import { getServices } from '@/server/services';
import { errorResponse, parseId } from '@/server/route-helpers';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const id = parseId((await params).id);
  if (!id) return NextResponse.json({ error: 'Unknown character' }, { status: 404 });
  try {
    const { db, syncer } = await getServices();
    if (!(await getCharacter(db, id))) return NextResponse.json({ error: 'Unknown character' }, { status: 404 });
    const result = await syncer.sync(id, { force: request.nextUrl.searchParams.get('force') === '1' });
    return NextResponse.json({ result });
  } catch (err) {
    return errorResponse(err);
  }
}
