/** The outcome of a call to one of this app's route handlers. */
export interface ApiActionResult<T> {
  ok: boolean;
  data: T | null;
  /** A message safe to show: the route's own `{ error }` text, or the caller's fallback. Null when the call succeeded. */
  error: string | null;
}

const UNREACHABLE = 'Couldn’t reach the app server.';
const DEFAULT_FALLBACK = 'Something went wrong. Check the server log.';

const messageFrom = (body: unknown, fallback: string): string => {
  const error = (body as { error?: unknown } | null)?.error;
  return typeof error === 'string' && error.trim() !== '' ? error : fallback;
};

/**
 * Calls a route handler and reads its reply. Route handlers answer a failure with `{ error }`
 * holding a message that is safe to show, so a failed call reports that text rather than a status
 * code. Takes `fetch` as a parameter so tests can pass a fake one.
 */
export async function runApiAction<T>(
  fetchFn: typeof fetch,
  url: string,
  init?: RequestInit,
  fallbackError: string = DEFAULT_FALLBACK,
): Promise<ApiActionResult<T>> {
  let res: Response;
  try {
    res = await fetchFn(url, init);
  } catch {
    return { ok: false, data: null, error: UNREACHABLE };
  }
  const body = await res.json().catch(() => null);
  if (!res.ok) return { ok: false, data: null, error: messageFrom(body, fallbackError) };
  return { ok: true, data: body as T | null, error: null };
}
