import { NextResponse } from 'next/server';
import { isMissingConfigError } from '@/core/config';
import { UserError, isUserError } from '@/core/errors';
import type { RowRef } from '@/core/bis/edits';
import { LIST_TYPES, REGIONS, isBisSourceId, type ListType, type Region } from '@/core/types';

export const parseRegion = (value: unknown): Region | null =>
  typeof value === 'string' && (REGIONS as readonly string[]).includes(value) ? (value as Region) : null;

export function parseId(value: string): number | null {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

/** undefined: leave the override alone. null: clear it. Otherwise one of the class's specs. */
export function parseSpecOverride(value: unknown, specs: readonly string[]): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  if (typeof value === 'string' && specs.includes(value)) return value;
  throw new UserError('Unknown spec for this class.');
}

export function parseListType(value: unknown): ListType {
  if (typeof value === 'string' && (LIST_TYPES as readonly string[]).includes(value)) return value as ListType;
  throw new UserError('Unknown list.');
}

export function parseRowRef(body: Record<string, unknown>): RowRef {
  if (typeof body.specSlug !== 'string' || !body.specSlug) throw new UserError('Unknown spec.');
  if (typeof body.slotKey !== 'string' || !body.slotKey) throw new UserError('Unknown slot.');
  if (!isBisSourceId(body.source)) throw new UserError('Unknown source.');
  return { specSlug: body.specSlug, source: body.source, listType: parseListType(body.listType), slotKey: body.slotKey };
}

export function errorResponse(err: unknown) {
  if (isUserError(err)) return NextResponse.json({ error: err.message }, { status: 400 });
  if (isMissingConfigError(err)) return NextResponse.json({ error: err.message }, { status: 503 });
  console.error(err);
  return NextResponse.json({ error: 'Something went wrong. Check the server log.' }, { status: 500 });
}
