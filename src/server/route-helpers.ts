import { NextResponse } from 'next/server';
import { MissingConfigError } from '@/core/config';
import { UserError } from '@/core/errors';
import { REGIONS, type Region } from '@/core/types';

export const parseRegion = (value: unknown): Region | null =>
  typeof value === 'string' && (REGIONS as readonly string[]).includes(value) ? (value as Region) : null;

export function parseId(value: string): number | null {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export function errorResponse(err: unknown) {
  if (err instanceof UserError) return NextResponse.json({ error: err.message }, { status: 400 });
  if (err instanceof MissingConfigError) return NextResponse.json({ error: err.message }, { status: 503 });
  console.error(err);
  return NextResponse.json({ error: 'Something went wrong. Check the server log.' }, { status: 500 });
}
