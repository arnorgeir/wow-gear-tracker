import { test as base, expect, type Locator, type Page } from '@playwright/test';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';

export const UNMATCHED_LOG = '.cache/e2e/unmatched.log';
export const readUnmatched = () =>
  existsSync(UNMATCHED_LOG) ? readFileSync(UNMATCHED_LOG, 'utf8').split('\n').filter(Boolean) : [];
export const clearUnmatched = () => {
  if (existsSync(UNMATCHED_LOG)) writeFileSync(UNMATCHED_LOG, '');
};

const APP_ORIGIN = 'http://127.0.0.1:3100';

export const test = base.extend<{ isolation: void }>({
  isolation: [
    async ({ context }, use) => {
      // Browser side: only the app itself. Wowhead's script, item icons and render images are aborted.
      await context.route((url) => url.origin !== APP_ORIGIN, (route) => route.abort());
      const before = readUnmatched().length;
      await use();
      // Server side: a request the fake doesn't know fails the test that caused it.
      expect(readUnmatched().slice(before), 'unmatched upstream requests').toEqual([]);
    },
    { auto: true },
  ],
});

/** Holds requests to our own API so a test can look at the busy state, then lets them through. */
export async function holdRequest(page: Page, method: string, urlPart: string) {
  let release!: () => void;
  const gate = new Promise<void>((r) => {
    release = r;
  });
  let seen = 0;
  await page.route(
    (url) => url.pathname.startsWith('/api/') && url.href.includes(urlPart),
    async (route) => {
      if (route.request().method() !== method) return route.fallback();
      seen += 1;
      await gate;
      await route.continue();
    },
  );
  return { count: () => seen, release: async () => release() };
}

export { expect };

/** Clicks twice, the second time through a disabled button, and checks the request went out once. */
export async function doubleClick(button: Locator, hold: Awaited<ReturnType<typeof holdRequest>>) {
  await button.click();
  await button.click({ force: true });
  await expect(button).toBeDisabled();
  expect(hold.count()).toBe(1);
}

/** Tracks a made-up character through the same route a user's click reaches. Names must start with "Birki". */
export async function trackCharacter(page: Page, name: string, realmSlug = 'kazzak') {
  const res = await page.request.post('/api/characters', { data: { region: 'eu', name, realmSlug } });
  expect(res.status()).toBeLessThan(300);
  return (await res.json()) as { id: number; key: string };
}

const CLOCK_SKEW_FILE = '.cache/e2e/clock-skew-ms';
const METHOD_WITHOUT_CLOAK_FLAG = '.cache/e2e/method-without-cloak';
const FIVE_DAYS_MS = 5 * 86_400_000;
const SKEW_COUNT_FILE = '.cache/e2e/clock-skew-count';
const SKEW_POLL_MS = 150; // the fake re-reads its skew file at most every 50 ms

/**
 * Makes the server fetch a spec's Method list again, past its one-day cache, and returns the clock to
 * normal afterwards. `withoutCloak` has the fake serve this spec a page whose Cloak row is gone, and
 * only this spec: the fetch is the spec's alone, so no other test reads what it changes.
 */
export async function refetchMethod(page: Page, specSlug: string, { withoutCloak = false } = {}) {
  mkdirSync('.cache/e2e', { recursive: true });
  // Each refetch jumps further ahead than the last, so the cache it finds is always a day or more old.
  const count = (existsSync(SKEW_COUNT_FILE) ? Number(readFileSync(SKEW_COUNT_FILE, 'utf8')) : 0) + 1;
  writeFileSync(SKEW_COUNT_FILE, String(count));
  writeFileSync(CLOCK_SKEW_FILE, String(count * FIVE_DAYS_MS));
  if (withoutCloak) writeFileSync(METHOD_WITHOUT_CLOAK_FLAG, specSlug);
  try {
    await page.waitForTimeout(SKEW_POLL_MS);
    expect((await page.request.post('/api/bis/fetch', { data: { specSlug } })).ok()).toBe(true);
  } finally {
    rmSync(CLOCK_SKEW_FILE, { force: true });
    rmSync(METHOD_WITHOUT_CLOAK_FLAG, { force: true });
    await page.waitForTimeout(SKEW_POLL_MS);
  }
}
