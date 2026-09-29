import { describe, expect, it, vi } from 'vitest';
import { createLimiter, fetchJson, HttpError, isHttpError } from './http';
import { fakeFetch, json, on } from '@/test/fake-fetch';

describe('isHttpError', () => {
  it('recognizes an HttpError from another copy of the module, where instanceof fails', async () => {
    vi.resetModules();
    const { HttpError: OtherHttpError } = await import('./http');
    const err = new OtherHttpError(404, 'https://example.test', 'Not Found');
    expect(err instanceof HttpError).toBe(false);
    expect(isHttpError(err)).toBe(true);
    expect(isHttpError(err) && err.status).toBe(404);
  });

  it('rejects other errors, even one that only borrows the name', () => {
    expect(isHttpError(Object.assign(new Error('x'), { name: 'HttpError', status: 404 }))).toBe(false);
    expect(isHttpError(new Error('x'))).toBe(false);
    expect(isHttpError(undefined)).toBe(false);
  });
});

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

describe('request timeout', () => {
  it('aborts a request that never answers', async () => {
    const hanging = ((_url: string, init?: RequestInit) => new Promise<Response>((_, reject) => {
      init?.signal?.addEventListener('abort', () => reject(init.signal!.reason));
    })) as typeof fetch;
    await expect(fetchJson(hanging, 'https://x/slow', undefined, undefined, 20)).rejects.toMatchObject({ name: 'TimeoutError' });
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
