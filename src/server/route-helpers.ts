import { NextResponse } from 'next/server';
import { isMissingConfigError } from '@/core/config';
import { UserError, isUserError } from '@/core/errors';
import { REGIONS, type Region } from '@/core/types';

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

export function errorResponse(err: unknown) {
  if (isUserError(err)) return NextResponse.json({ error: err.message }, { status: 400 });
  if (isMissingConfigError(err)) return NextResponse.json({ error: err.message }, { status: 503 });
  console.error(err);
  return NextResponse.json({ error: 'Something went wrong. Check the server log.' }, { status: 500 });
}
