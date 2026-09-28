import { describe, expect, it } from 'vitest';
import { fakeFetch, json, on } from '@/test/fake-fetch';
import { runApiAction } from './api-action';

describe('runApiAction', () => {
  it('returns the parsed body when the route succeeds', async () => {
    const { fn, calls } = fakeFetch([on('/api/characters/1', () => json({ id: 1, changed: true }))]);
    const result = await runApiAction<{ id: number; changed: boolean }>(fn, '/api/characters/1', { method: 'POST' });
    expect(result).toEqual({ ok: true, data: { id: 1, changed: true }, error: null });
    expect(calls[0].init?.method).toBe('POST');
  });

  it('returns the message the route put in its error body', async () => {
    const { fn } = fakeFetch([on('/api/characters', () => json({ error: 'That character is already tracked.' }, 400))]);
    const result = await runApiAction(fn, '/api/characters');
    expect(result.ok).toBe(false);
    expect(result.error).toBe('That character is already tracked.');
    expect(result.data).toBeNull();
  });

  it('falls back to the given message when the error body has no usable message', async () => {
    const { fn } = fakeFetch([on('/api/x', () => json({ error: { code: 12 } }, 500))]);
    const result = await runApiAction(fn, '/api/x', undefined, 'Couldn’t do that.');
    expect(result.error).toBe('Couldn’t do that.');
  });

  it('reports an unreachable server instead of rejecting', async () => {
    const fn = (() => Promise.reject(new TypeError('fetch failed'))) as unknown as typeof fetch;
    const result = await runApiAction(fn, '/api/x');
    expect(result).toEqual({ ok: false, data: null, error: 'Couldn’t reach the app server.' });
  });

  it('succeeds with null data when the route sends no JSON', async () => {
    const { fn } = fakeFetch([on('/api/x', () => new Response(null, { status: 204 }))]);
    const result = await runApiAction(fn, '/api/x');
    expect(result).toEqual({ ok: true, data: null, error: null });
  });

  it('uses the fallback when a failed response has no body at all', async () => {
    const { fn } = fakeFetch([on('/api/x', () => new Response(null, { status: 503 }))]);
    const result = await runApiAction(fn, '/api/x', undefined, 'Service is asleep.');
    expect(result.error).toBe('Service is asleep.');
  });
});
