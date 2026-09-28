import { NextResponse, type NextRequest } from 'next/server';
import { deleteCharacter, getCharacter, updateCharacter } from '@/core/db/queries/characters';
import { getServices } from '@/server/services';
import { errorResponse, parseId } from '@/server/route-helpers';

type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: Context) {
  const id = parseId((await params).id);
  if (!id) return NextResponse.json({ error: 'Unknown character' }, { status: 404 });
  try {
    const { db } = await getServices();
    if (!(await getCharacter(db, id))) return NextResponse.json({ error: 'Unknown character' }, { status: 404 });
    const body = (await request.json()) as { specOverride?: unknown; priorityList?: unknown };
    const patch: Parameters<typeof updateCharacter>[2] = {};
    if (body.specOverride === null || typeof body.specOverride === 'string') patch.specOverride = body.specOverride || null;
    if (body.priorityList === 'mythicPlus' || body.priorityList === 'overall') patch.priorityList = body.priorityList;
    await updateCharacter(db, id, patch);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function DELETE(_request: NextRequest, { params }: Context) {
  const id = parseId((await params).id);
  if (!id) return NextResponse.json({ error: 'Unknown character' }, { status: 404 });
  try {
    await deleteCharacter((await getServices()).db, id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}
