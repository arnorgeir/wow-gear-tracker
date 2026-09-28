import { NextResponse, type NextRequest } from 'next/server';
import { getCharacter } from '@/core/db/queries/characters';
import { importSimc } from '@/core/simc/import-simc';
import { ensureTracks } from '@/core/sync/reference-sync';
import { getServices } from '@/server/services';
import { errorResponse, parseId } from '@/server/route-helpers';

const MAX_LENGTH = 200_000;

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const id = parseId((await params).id);
  if (!id) return NextResponse.json({ error: 'Unknown character' }, { status: 404 });
  try {
    const body = (await request.json().catch(() => null)) as { text?: unknown } | null;
    const text = typeof body?.text === 'string' ? body.text : '';
    if (!text.trim()) return NextResponse.json({ error: 'Paste the text from the /simc window first.' }, { status: 400 });
    if (text.length > MAX_LENGTH) return NextResponse.json({ error: 'That text is too long to be a SimC export.' }, { status: 400 });

    const services = await getServices();
    if (!(await getCharacter(services.db, id))) return NextResponse.json({ error: 'Unknown character' }, { status: 404 });
    const { qualities } = await ensureTracks({ db: services.db, fetchRaidbots: services.fetchRaidbots, now: services.now() });
    const result = await importSimc({ db: services.db, blizzard: services.blizzard, qualities, now: services.now }, id, text);
    return NextResponse.json(result);
  } catch (err) {
    return errorResponse(err);
  }
}
