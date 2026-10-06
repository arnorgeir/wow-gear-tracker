import { isIP } from 'node:net';

// Rules for every request the proxy sees. The app has no login, so these keep other websites
// (cross-site writes, DNS rebinding) and oversized bodies away from the route handlers.

export const BODY_LIMIT = 1_048_576;

export interface GuardInput {
  method: string;
  pathname: string;
  host: string | null;
  origin: string | null;
  secFetchSite: string | null;
  contentLength: string | null;
}

export interface GuardFailure {
  status: 403 | 413;
  error: string;
}

const UNKNOWN_HOST: GuardFailure = { status: 403, error: 'Unknown host.' };
const CROSS_SITE: GuardFailure = { status: 403, error: 'Cross-site requests are not allowed.' };
export const BODY_TOO_LARGE: GuardFailure = { status: 413, error: 'Request body is too large.' };

/** `host:port` as the URL parser normalizes it, or null when the value isn't a plain host. */
function normalHost(host: string): URL | null {
  if (!host || /[\s/\\@?#]/.test(host)) return null;
  try {
    return new URL(`http://${host}`);
  } catch {
    return null;
  }
}

// A DNS-rebinding page arrives under its own DNS name. An IP literal can't be rebound,
// so only `localhost` and IP literals are served. LAN use by IP keeps working.
function isLocalHost(host: string | null): boolean {
  const url = host === null ? null : normalHost(host);
  if (!url) return false;
  const name = url.hostname.replace(/^\[|\]$/g, '');
  return name === 'localhost' || isIP(name) !== 0;
}

function sameOrigin(origin: string, host: string): boolean {
  const expected = normalHost(host);
  try {
    return expected !== null && new URL(origin).host === expected.host;
  } catch {
    return false;
  }
}

export function isApiWrite(method: string, pathname: string): boolean {
  const upper = method.toUpperCase();
  return upper !== 'GET' && upper !== 'HEAD' && (pathname === '/api' || pathname.startsWith('/api/'));
}

export function checkRequest(input: GuardInput): GuardFailure | null {
  if (!isLocalHost(input.host)) return UNKNOWN_HOST;
  if (!isApiWrite(input.method, input.pathname)) return null;
  // Sec-Fetch-Site is exact when present; same-site still covers other ports on localhost.
  if (input.secFetchSite !== null) {
    if (input.secFetchSite !== 'same-origin') return CROSS_SITE;
  } else if (input.origin !== null && !sameOrigin(input.origin, input.host!)) {
    return CROSS_SITE;
  }
  // Neither header: not a browser. The loopback bind keeps those on this machine.
  const length = input.contentLength;
  if (length !== null && /^\d+$/.test(length) && Number(length) > BODY_LIMIT) return BODY_TOO_LARGE;
  return null;
}

/** Reads a body until it passes `limit`. Next cuts the proxy's copy silently, so the limit sits below its cap. */
export async function bodyExceeds(body: ReadableStream<Uint8Array> | null, limit: number): Promise<boolean> {
  if (!body) return false;
  const reader = body.getReader();
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) return false;
    total += value.byteLength;
    if (total > limit) {
      await reader.cancel();
      return true;
    }
  }
}
