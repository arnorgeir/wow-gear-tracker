import { NextResponse, type NextRequest } from 'next/server';
import { UserError } from '@/core/errors';
import { getServices } from '@/server/services';
import { errorResponse, parseId } from '@/server/route-helpers';
import { getVaultHistoryWeek } from '@/server/views/vault-history';

type Context = { params: Promise<{ id: string }> };

/** The latest earlier week of Great Vault choices. Reads only. */
export async function GET(request: NextRequest, { params }: Context) {
  const id = parseId((await params).id);
  if (!id) return NextResponse.json({ error: 'Unknown character' }, { status: 404 });
  try {
    const before = Number(request.nextUrl.searchParams.get('before'));
    if (!Number.isInteger(before) || before <= 0) throw new UserError('Unknown week.');
    const result = await getVaultHistoryWeek(await getServices(), id, before);
    if (!result) return NextResponse.json({ error: 'Unknown character' }, { status: 404 });
    return NextResponse.json(result);
  } catch (err) {
    return errorResponse(err);
  }
}
