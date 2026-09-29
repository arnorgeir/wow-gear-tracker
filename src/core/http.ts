import { brand, hasBrand } from './errors';

export type FetchFn = typeof fetch;
export type SleepFn = (ms: number) => Promise<void>;

const defaultSleep: SleepFn = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Longest wait for any one external request, so a stalled service can't hang a page. */
export const REQUEST_TIMEOUT_MS = 10_000;

const HTTP_ERROR = Symbol.for('wow-gear-tracker.HttpError');

export class HttpError extends Error {
  constructor(public readonly status: number, public readonly url: string, body: string) {
    super(`HTTP ${status} for ${url}: ${body.slice(0, 200)}`);
    this.name = 'HttpError';
    brand(this, HTTP_ERROR);
  }
}

/** Whether `err` is an HttpError from any copy of this module; see `src/core/errors.ts`. */
export const isHttpError = (err: unknown): err is HttpError => hasBrand(err, HTTP_ERROR);

const withTimeout = (init: RequestInit | undefined, timeoutMs: number): RequestInit =>
  ({ ...init, signal: init?.signal ?? AbortSignal.timeout(timeoutMs) });

/** Fetches once; on 429 waits for Retry-After (default 1 s) and tries one more time. Each attempt times out. */
export async function fetchWithRetry(
  fetchFn: FetchFn, url: string, init?: RequestInit, sleep: SleepFn = defaultSleep, timeoutMs = REQUEST_TIMEOUT_MS,
): Promise<Response> {
  const res = await fetchFn(url, withTimeout(init, timeoutMs));
  if (res.status !== 429) return res;
  const seconds = Number(res.headers.get('retry-after'));
  await sleep((Number.isFinite(seconds) && seconds > 0 ? seconds : 1) * 1000);
  return fetchFn(url, withTimeout(init, timeoutMs));
}

export async function fetchJson<T>(fetchFn: FetchFn, url: string, init?: RequestInit, sleep?: SleepFn, timeoutMs?: number): Promise<T> {
  const res = await fetchWithRetry(fetchFn, url, init, sleep, timeoutMs);
  if (!res.ok) throw new HttpError(res.status, url, await res.text());
  return (await res.json()) as T;
}

/** Runs at most `max` async tasks at once; extra tasks wait in order. */
export function createLimiter(max: number) {
  let active = 0;
  const waiting: (() => void)[] = [];
  return async function limit<T>(task: () => Promise<T>): Promise<T> {
    if (active >= max) await new Promise<void>((resolve) => waiting.push(resolve));
    active++;
    try {
      return await task();
    } finally {
      active--;
      waiting.shift()?.();
    }
  };
}
