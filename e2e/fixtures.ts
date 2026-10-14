import { test as base, expect, type Page } from '@playwright/test';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

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

/** Tracks a made-up character through the same route a user's click reaches. Names must start with "Birki". */
export async function trackCharacter(page: Page, name: string, realmSlug = 'kazzak') {
  const res = await page.request.post('/api/characters', { data: { region: 'eu', name, realmSlug } });
  expect(res.status()).toBeLessThan(300);
  return (await res.json()) as { id: number; key: string };
}
