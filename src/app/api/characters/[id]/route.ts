import { NextResponse, type NextRequest } from 'next/server';
import { deleteCharacter, getCharacter, updateCharacter } from '@/core/db/queries/characters';
import { getServices } from '@/server/services';
import { errorResponse, parseId, parseSpecOverride } from '@/server/route-helpers';

type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: Context) {
  const id = parseId((await params).id);
  if (!id) return NextResponse.json({ error: 'Unknown character' }, { status: 404 });
  try {
    const { db, blizzard } = await getServices();
    const character = await getCharacter(db, id);
    if (!character) return NextResponse.json({ error: 'Unknown character' }, { status: 404 });
    const body = (await request.json()) as { specOverride?: unknown; priorityList?: unknown };
    const patch: Parameters<typeof updateCharacter>[2] = {};
    // Specs load only when the override changes, so a priority-only change works without Blizzard.
    if (body.specOverride !== undefined) {
      const classes = await blizzard.getClasses(character.region);
      const specs = classes.find((cls) => cls.name === character.className)?.specs ?? [];
      patch.specOverride = parseSpecOverride(body.specOverride, specs) ?? null;
    }
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
