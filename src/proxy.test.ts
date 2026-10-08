import { NextRequest } from 'next/server';
import { describe, expect, it } from 'vitest';
import { proxy } from './proxy';

const CHUNK = 65_536;
const encoder = new TextEncoder();

/** A chunked body with no Content-Length: `head`, then spaces up to `total` bytes. */
function padded(head: string, total: number): ReadableStream<Uint8Array> {
  const first = encoder.encode(head);
  let headSent = false;
  let sent = 0;
  return new ReadableStream({
    pull(controller) {
      if (!headSent) {
        headSent = true;
        sent = first.byteLength;
        return controller.enqueue(first);
      }
      if (sent >= total) return controller.close();
      const size = Math.min(CHUNK, total - sent);
      sent += size;
      controller.enqueue(new Uint8Array(size).fill(0x20));
    },
  });
}

function request(path: string, init: { method?: string; headers?: Record<string, string>; body?: ReadableStream<Uint8Array> } = {}) {
  return new NextRequest(`http://localhost:3000${path}`, {
    method: init.method ?? 'GET',
    headers: { host: 'localhost:3000', ...init.headers },
    body: init.body,
    duplex: 'half',
  } as ConstructorParameters<typeof NextRequest>[1]);
}

const passedThrough = (res: Response) => res.headers.get('x-middleware-next') === '1';
const SPEC = '{"specOverride":"Feral"}';

describe('proxy', () => {
  it('rejects valid JSON padded past the limit without Content-Length', async () => {
    const res = await proxy(request('/api/characters/1', { method: 'PATCH', body: padded(SPEC, SPEC.length + 1_048_577) }));
    expect(res.status).toBe(413);
    expect(await res.json()).toEqual({ error: 'Request body is too large.' });
  });

  it('passes the same JSON padded to exactly the limit', async () => {
    const res = await proxy(request('/api/characters/1', { method: 'PATCH', body: padded(SPEC, 1_048_576) }));
    expect(passedThrough(res)).toBe(true);
  });

  it('rejects an oversized body on a route that ignores its body', async () => {
    const res = await proxy(request('/api/characters/1/sync', { method: 'POST', body: padded('', 1_048_577) }));
    expect(res.status).toBe(413);
  });

  it('rejects a foreign Origin', async () => {
    const res = await proxy(request('/api/season/sync?region=eu', { method: 'POST', headers: { origin: 'http://evil.example' } }));
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: 'Cross-site requests are not allowed.' });
  });

  it('rejects a foreign Origin on the reference sync', async () => {
    const res = await proxy(request('/api/reference/sync', { method: 'POST', headers: { origin: 'http://evil.example' } }));
    expect(res.status).toBe(403);
  });

  it('rejects a page under a rebound name', async () => {
    const res = await proxy(request('/characters/1', { headers: { host: 'evil.example:3000' } }));
    expect(res.status).toBe(403);
  });

  it('lets a same-origin write and a page GET through', async () => {
    expect(passedThrough(await proxy(request('/api/characters/1', { method: 'DELETE', headers: { 'sec-fetch-site': 'same-origin' } })))).toBe(true);
    expect(passedThrough(await proxy(request('/characters/1')))).toBe(true);
  });
});
