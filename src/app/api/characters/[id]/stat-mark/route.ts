import { NextResponse, type NextRequest } from 'next/server';
import { getCharacter } from '@/core/db/queries/characters';
import { clearStatMark, setStatMark } from '@/core/db/queries/stat-marks';
import { UserError } from '@/core/errors';
import { SLOT_TYPES, type SlotType } from '@/core/types';
import { errorResponse, parseId } from '@/server/route-helpers';
import { getServices } from '@/server/services';

type Context = { params: Promise<{ id: string }> };

const invalid = () => new UserError('Invalid stat mark.');
const readBody = async (request: NextRequest) => {
  const body: unknown = await request.json().catch(() => { throw invalid(); });
  if (typeof body !== 'object' || body === null) throw invalid();
  return body as Record<string, unknown>;
};
const parseSlot = (v: unknown): SlotType => {
  if ((SLOT_TYPES as readonly unknown[]).includes(v)) return v as SlotType;
  throw invalid();
};
const positiveInt = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v > 0;

const unknownCharacter = () => NextResponse.json({ error: 'Unknown character' }, { status: 404 });

export async function PUT(request: NextRequest, { params }: Context) {
  const id = parseId((await params).id);
  if (!id) return unknownCharacter();
  try {
    const s = await getServices();
    if (!(await getCharacter(s.db, id))) return unknownCharacter();
    const body = await readBody(request);
    const { itemId, bonusIds, targetItemId, right } = body;
    if (!positiveInt(itemId) || !positiveInt(targetItemId) || typeof right !== 'boolean'
      || !Array.isArray(bonusIds) || !bonusIds.every((b) => Number.isInteger(b) && b >= 0)) throw invalid();
    await setStatMark(s.db, s.currentAccountId(), id, { slot: parseSlot(body.slot), itemId, bonusIds, targetItemId, right });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function DELETE(request: NextRequest, { params }: Context) {
  const id = parseId((await params).id);
  if (!id) return unknownCharacter();
  try {
    const s = await getServices();
    if (!(await getCharacter(s.db, id))) return unknownCharacter();
    await clearStatMark(s.db, s.currentAccountId(), id, parseSlot((await readBody(request)).slot));
    return NextResponse.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}
