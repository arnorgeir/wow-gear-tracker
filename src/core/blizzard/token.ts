import { HttpError, REQUEST_TIMEOUT_MS, type FetchFn } from '../http';

interface TokenOptions {
  clientId: string;
  clientSecret: string;
  fetchFn: FetchFn;
  now: () => number;
}

/** A client-credentials token, fetched on first use and refreshed a minute before it expires. */
export function createTokenSource(options: TokenOptions) {
  let token: { value: string; expiresAt: number } | null = null;

  async function get(): Promise<string> {
    if (token && token.expiresAt > options.now() + 60_000) return token.value;
    const url = 'https://oauth.battle.net/token';
    const res = await options.fetchFn(url, {
      method: 'POST',
      headers: {
        Authorization: 'Basic ' + Buffer.from(`${options.clientId}:${options.clientSecret}`).toString('base64'),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials',
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!res.ok) throw new HttpError(res.status, url, await res.text());
    const data = (await res.json()) as { access_token: string; expires_in: number };
    token = { value: data.access_token, expiresAt: options.now() + data.expires_in * 1000 };
    return token.value;
  }

  /** Forgets the token, after Blizzard rejects it with a 401. */
  function invalidate() {
    token = null;
  }

  return { get, invalidate };
}
