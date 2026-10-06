import { describe, expect, it } from 'vitest';
import { BODY_LIMIT, bodyExceeds, checkRequest, isApiWrite, type GuardInput } from './request-guard';

const base: GuardInput = {
  method: 'POST',
  pathname: '/api/season/sync',
  host: 'localhost:3000',
  origin: null,
  secFetchSite: null,
  contentLength: null,
};
const check = (patch: Partial<GuardInput>) => checkRequest({ ...base, ...patch });
const UNKNOWN_HOST = { status: 403, error: 'Unknown host.' };
const CROSS_SITE = { status: 403, error: 'Cross-site requests are not allowed.' };
const TOO_LARGE = { status: 413, error: 'Request body is too large.' };

describe('checkRequest: host', () => {
  it.each(['localhost:3000', 'localhost', 'LOCALHOST:3000', '127.0.0.1:3000', '[::1]:3000', '192.168.1.20:3000'])('allows %s', (host) => {
    expect(check({ host })).toBeNull();
  });

  it.each(['evil.example:3000', 'mypc.local:3000', 'localhost@evil.example', 'localhost/evil', 'local host', ''])('rejects %s', (host) => {
    expect(check({ host })).toEqual(UNKNOWN_HOST);
  });

  it('rejects a missing host', () => {
    expect(check({ host: null })).toEqual(UNKNOWN_HOST);
  });

  it('rejects a rebound name on a page GET too', () => {
    expect(check({ method: 'GET', pathname: '/characters/1', host: 'evil.example:3000' })).toEqual(UNKNOWN_HOST);
  });
});

describe('checkRequest: Sec-Fetch-Site', () => {
  it('allows same-origin', () => {
    expect(check({ secFetchSite: 'same-origin' })).toBeNull();
  });

  it.each(['same-site', 'cross-site', 'none'])('rejects %s', (secFetchSite) => {
    expect(check({ secFetchSite })).toEqual(CROSS_SITE);
  });

  it('wins over a foreign Origin when present', () => {
    expect(check({ secFetchSite: 'same-origin', origin: 'http://evil.example' })).toBeNull();
  });
});

describe('checkRequest: Origin', () => {
  it.each([
    ['http://localhost:3000', 'localhost:3000'],
    ['HTTP://LOCALHOST:3000', 'localhost:3000'],
    ['http://192.168.1.20:3000', '192.168.1.20:3000'],
  ])('allows %s on host %s', (origin, host) => {
    expect(check({ origin, host })).toBeNull();
  });

  it.each(['http://evil.example', 'http://localhost:5173', 'null', 'not a url'])('rejects %s', (origin) => {
    expect(check({ origin })).toEqual(CROSS_SITE);
  });

  it('allows a write with neither header', () => {
    expect(check({})).toBeNull();
  });
});

describe('checkRequest: methods and paths', () => {
  it.each(['GET', 'HEAD', 'get'])('lets %s to /api through with a foreign Origin', (method) => {
    expect(check({ method, origin: 'http://evil.example' })).toBeNull();
  });

  it.each(['POST', 'PATCH', 'DELETE', 'post'])('rejects %s to /api with a foreign Origin', (method) => {
    expect(check({ method, origin: 'http://evil.example' })).toEqual(CROSS_SITE);
  });

  it('applies only the host rule to a page path', () => {
    expect(check({ pathname: '/characters/1', origin: 'http://evil.example', contentLength: '99999999' })).toBeNull();
  });
});

describe('checkRequest: Content-Length', () => {
  it.each([[String(BODY_LIMIT), null], [String(BODY_LIMIT + 1), TOO_LARGE], [null, null], ['abc', null]])(
    'Content-Length %s gives %o',
    (contentLength, expected) => {
      expect(check({ contentLength })).toEqual(expected);
    },
  );
});

describe('isApiWrite', () => {
  it.each([
    ['POST', '/api', true],
    ['DELETE', '/api/characters/1', true],
    ['patch', '/api/characters/1', true],
    ['GET', '/api/search', false],
    ['HEAD', '/api/search', false],
    ['POST', '/apiary', false],
    ['POST', '/characters/1', false],
  ])('%s %s gives %s', (method, pathname, expected) => {
    expect(isApiWrite(method, pathname)).toBe(expected);
  });
});

const CHUNK = 65_536;

function streamOf(total: number): ReadableStream<Uint8Array> {
  let sent = 0;
  return new ReadableStream({
    pull(controller) {
      if (sent >= total) return controller.close();
      const size = Math.min(CHUNK, total - sent);
      sent += size;
      controller.enqueue(new Uint8Array(size));
    },
  });
}

describe('bodyExceeds', () => {
  it('is false for no body', async () => {
    expect(await bodyExceeds(null, BODY_LIMIT)).toBe(false);
  });

  it('is false at exactly the limit across chunks', async () => {
    expect(await bodyExceeds(streamOf(BODY_LIMIT), BODY_LIMIT)).toBe(false);
  });

  it('is true one byte over the limit', async () => {
    expect(await bodyExceeds(streamOf(BODY_LIMIT + 1), BODY_LIMIT)).toBe(true);
  });

  it('stops reading once over the limit', async () => {
    const endless = new ReadableStream<Uint8Array>({ pull: (controller) => controller.enqueue(new Uint8Array(CHUNK)) });
    expect(await bodyExceeds(endless, BODY_LIMIT)).toBe(true);
  });
});
