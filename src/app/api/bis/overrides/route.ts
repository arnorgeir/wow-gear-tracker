import { NextResponse, type NextRequest } from 'next/server';
import { removeOverride, saveOverride } from '@/core/bis/edits';
import { UserError } from '@/core/errors';
import { getServices } from '@/server/services';
import { errorResponse, parseRowRef } from '@/server/route-helpers';

async function editDeps() {
  const s = await getServices();
  return { db: s.db, blizzard: s.blizzard, now: s.now(), accountId: s.currentAccountId() };
}

export async function PUT(request: NextRequest) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const ref = parseRowRef(body);
    if (typeof body.itemId !== 'number' || !Number.isInteger(body.itemId) || body.itemId <= 0) throw new UserError('Unknown item.');
    await saveOverride(await editDeps(), ref, body.itemId, body.catalyst === true);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const ref = parseRowRef((await request.json()) as Record<string, unknown>);
    await removeOverride(await editDeps(), ref);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}
