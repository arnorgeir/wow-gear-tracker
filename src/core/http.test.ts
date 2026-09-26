import { describe, expect, it } from 'vitest';
import { createLimiter, fetchJson, HttpError } from './http';
import { fakeFetch, json, on } from '@/test/fake-fetch';

describe('fetchJson', () => {
  it('returns parsed JSON', async () => {
    const { fn } = fakeFetch([on('/ok', () => json({ a: 1 }))]);
    expect(await fetchJson(fn, 'https://x/ok')).toEqual({ a: 1 });
  });

  it('throws HttpError with the status on failure', async () => {
    const { fn } = fakeFetch([on('/boom', () => new Response('nope', { status: 500 }))]);
    await expect(fetchJson(fn, 'https://x/boom')).rejects.toMatchObject({ status: 500 });
    await expect(fetchJson(fn, 'https://x/boom')).rejects.toBeInstanceOf(HttpError);
  });

  it('waits for Retry-After on 429 and retries once', async () => {
    let n = 0;
    const waits: number[] = [];
    const { fn, calls } = fakeFetch([
      on('/limited', () => (n++ === 0 ? new Response('', { status: 429, headers: { 'retry-after': '2' } }) : json({ ok: true }))),
    ]);
    const result = await fetchJson(fn, 'https://x/limited', undefined, async (ms) => { waits.push(ms); });
    expect(result).toEqual({ ok: true });
    expect(waits).toEqual([2000]);
    expect(calls).toHaveLength(2);
  });

  it('gives up after one retry', async () => {
    const { fn, calls } = fakeFetch([on('/limited', () => new Response('', { status: 429 }))]);
    await expect(fetchJson(fn, 'https://x/limited', undefined, async () => {})).rejects.toMatchObject({ status: 429 });
    expect(calls).toHaveLength(2);
  });
});

describe('createLimiter', () => {
  it('never runs more than max tasks at once', async () => {
    const limit = createLimiter(2);
    let active = 0;
    let peak = 0;
    const task = () => limit(async () => {
      active++;
      peak = Math.max(peak, active);
      await new Promise((r) => setTimeout(r, 5));
      active--;
    });
    await Promise.all([task(), task(), task(), task(), task()]);
    expect(peak).toBe(2);
  });
});
