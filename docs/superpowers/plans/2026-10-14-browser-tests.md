# Browser Tests Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the Playwright spike on this branch into the harness and first test set the spec describes, running locally and as a non-required CI job.

**Architecture:** A launcher (`e2e/serve.mjs`) resets the e2e database, builds to `.next-e2e` and starts `next start` with a fetch preload that fakes every upstream. A shared fixture blocks external browser traffic and fails any test that caused an unmatched upstream request. Tests drive the real UI and hold our own `/api` requests with `page.route` to check busy states.

**Tech Stack:** Next 16.3, Playwright `@playwright/test` (already a dev dependency on this branch), Node 24, SQLite via libsql.

**Spec:** `docs/superpowers/specs/2026-10-14-browser-tests-design.md`

## Global Constraints

- Port 3100, host `127.0.0.1`. `workers: 1`, `fullyParallel: false`.
- Build output `.next-e2e` via `NEXT_DIST_DIR`; default stays `.next`.
- Database `file:.cache/e2e/app.db`, deleted by the launcher before build. Never deleted by `globalSetup`.
- Dummy credentials `BLIZZARD_CLIENT_ID=e2e`, `BLIZZARD_CLIENT_SECRET=e2e` for both build and start.
- No app code changes except `next.config.ts` `distDir`. No new dependencies.
- Fixture names are made up, with non-ASCII letters (Birkibjörn style). No real player names, no full third-party pages.
- Scripts shell-agnostic: the launcher spawns `next` with `process.execPath` and the `next` bin path, never through a shell.
- Every spec file imports `test`/`expect` from `./fixtures`, never from `@playwright/test` directly.
- `npm test` stays Vitest only.

## Review Focus

1. **Second consecutive run:** the launcher deletes a database left by the previous run while nothing holds it open. Checked in Task 6's acceptance run.
2. **Dev server running in the main checkout:** e2e build writes only `.next-e2e`; `tsconfig.json` and `git status` unchanged afterwards. Checked in Task 1 Step 6.
3. **A test whose flow triggers a sync the fake doesn't cover:** the unmatched log fails that test, not a later one. Task 2's harness test pins it.
4. **Order dependence:** each spec passes alone with `--grep` and in the full run. Task 6.
5. **Loopback look-alike host** (`localhost.example.com`) is treated as external. Task 2's harness test pins it.

---

### Task 1: Launcher, dist dir, config

**Files:**
- Create: `e2e/serve.mjs`
- Modify: `playwright.config.ts`, `next.config.ts`, `eslint.config.mjs`, `tsconfig.json`, `package.json`

- [ ] **Step 1: `next.config.ts`** — add `distDir: process.env.NEXT_DIST_DIR ?? '.next',` as the first key of `nextConfig`.

- [ ] **Step 2: launcher**

```js
// e2e/serve.mjs
// Playwright's webServer command. Resets the e2e database, builds to .next-e2e and starts the
// server with the upstream fake. One env for both steps, so the build and the server agree.
import { spawn, spawnSync } from 'node:child_process';
import { rmSync } from 'node:fs';
import { createRequire } from 'node:module';

const next = createRequire(import.meta.url).resolve('next/dist/bin/next');
const env = {
  ...process.env,
  NEXT_DIST_DIR: '.next-e2e',
  BLIZZARD_CLIENT_ID: 'e2e',
  BLIZZARD_CLIENT_SECRET: 'e2e',
  DATABASE_URL: 'file:.cache/e2e/app.db',
};

rmSync('.cache/e2e', { recursive: true, force: true });
const build = spawnSync(process.execPath, [next, 'build'], { env, stdio: 'inherit' });
if (build.status !== 0) process.exit(build.status ?? 1);

const server = spawn(process.execPath, [next, 'start', '-H', '127.0.0.1', '-p', '3100'], {
  env: { ...env, NODE_OPTIONS: '--import ./e2e/fake-upstream.mjs' },
  stdio: 'inherit',
});
for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => server.kill(sig));
server.on('exit', (code) => process.exit(code ?? 0));
```

- [ ] **Step 3: `playwright.config.ts`**

```ts
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: false,
  workers: 1,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: { baseURL: 'http://127.0.0.1:3100', trace: 'retain-on-failure' },
  webServer: {
    command: 'node e2e/serve.mjs',
    url: 'http://127.0.0.1:3100',
    reuseExistingServer: false,
    timeout: 300_000,
  },
});
```

- [ ] **Step 4:** `eslint.config.mjs` add `'.next-e2e/**'` to `globalIgnores`. `tsconfig.json` add `".next-e2e/types/**/*.ts"` and `".next-e2e/dev/types/**/*.ts"` to `include`, after the `.next` ones. `package.json` scripts: `"test:e2e": "playwright test"`.

- [ ] **Step 5:** Run `npx playwright test`. Expected: build output lands in `.next-e2e`, the spike's 5 tests pass (4 pass + 1 expected fail).

- [ ] **Step 6:** Run `git status --short` (expected: only the files above), then `npm run typecheck && npm run lint`. If Next rewrote `tsconfig.json`, copy its exact globs into the committed file and rerun.

- [ ] **Step 7:** Commit `chore: build e2e app to .next-e2e through a launcher`.

### Task 2: Strict fake upstream and shared fixtures

**Files:**
- Modify: `e2e/fake-upstream.mjs`
- Create: `e2e/fixtures.ts`, `e2e/harness.spec.ts`
- Modify: `e2e/character-search.spec.ts`, `e2e/error-brands.spec.ts` (import from `./fixtures`)

**Interfaces:**
- Produces: `test`, `expect` from `e2e/fixtures.ts`; `holdRequest(page, method, urlPart)` returning `{ count(): number; release(): Promise<void> }`; `UNMATCHED_LOG = '.cache/e2e/unmatched.log'`.

- [ ] **Step 1: harness test first**

```ts
// e2e/harness.spec.ts
import { clearUnmatched, expect, readUnmatched, test } from './fixtures';

// The fake must record a request nobody routed. The KR realm list is deliberately unrouted.
test('an unrouted upstream request is recorded', async ({ page }) => {
  await page.goto('/');
  const before = readUnmatched().length;
  await page.request.get('/api/realms?region=kr');
  expect(readUnmatched().length).toBe(before + 1);
  expect(readUnmatched().at(-1)).toContain('kr.api.blizzard.com');
  clearUnmatched();
});
```

The fake routes realm index only for `eu.api.blizzard.com`, so a `kr` realm list is unrouted. Export `clearUnmatched()` from the fixtures so this one test can clean up before the auto check runs.

- [ ] **Step 2:** Run `npx playwright test harness`. Expected FAIL: `readUnmatched` not exported.

- [ ] **Step 3: fake upstream** — replace the prefix check and catch-all:

```js
import { appendFileSync, mkdirSync } from 'node:fs';

const LOOPBACK = new Set(['127.0.0.1', 'localhost', '[::1]']);
const UNMATCHED_LOG = '.cache/e2e/unmatched.log';

globalThis.fetch = async (input, init) => {
  const url = String(input instanceof Request ? input.url : input);
  if (LOOPBACK.has(new URL(url).hostname)) return realFetch(input, init);
  const route = routes.find(([match]) => typeof match === 'string' ? url.includes(match) : match.test(url));
  if (route) return route[1](url, init);
  mkdirSync('.cache/e2e', { recursive: true });
  appendFileSync(UNMATCHED_LOG, `${url}\n`);
  return json({ error: `fake-upstream: no route for ${url}` }, 404);
};
```

Routes become `[string | RegExp, handler]`. Narrow the realm index route to `eu.api.blizzard.com/data/wow/realm/index`. Add an explicit Blizzard profile route: `/profile/wow/character/<realm>/<name>` answers 404 for any name in `UNKNOWN` (`zzzqqxnotreal`, and any name starting with `nobody`), and the canned profile for the names in Task 3.

- [ ] **Step 4: fixtures**

```ts
// e2e/fixtures.ts
import { test as base, expect, type Page } from '@playwright/test';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

export const UNMATCHED_LOG = '.cache/e2e/unmatched.log';
export const readUnmatched = () =>
  existsSync(UNMATCHED_LOG) ? readFileSync(UNMATCHED_LOG, 'utf8').split('\n').filter(Boolean) : [];
export const clearUnmatched = () => { if (existsSync(UNMATCHED_LOG)) writeFileSync(UNMATCHED_LOG, ''); };

const APP_ORIGIN = 'http://127.0.0.1:3100';

export const test = base.extend<{ isolation: void }>({
  isolation: [async ({ context }, use) => {
    // Browser side: only the app itself. Wowhead's script, item icons and render images are aborted.
    await context.route((url) => url.origin !== APP_ORIGIN, (route) => route.abort());
    const before = readUnmatched().length;
    await use();
    // Server side: a request the fake doesn't know fails the test that caused it.
    expect(readUnmatched().slice(before), 'unmatched upstream requests').toEqual([]);
  }, { auto: true }],
});

/** Holds requests to our own API so a test can look at the busy state, then lets them through. */
export async function holdRequest(page: Page, method: string, urlPart: string) {
  let release!: () => void;
  const gate = new Promise<void>((r) => { release = r; });
  let seen = 0;
  await page.route((url) => url.pathname.startsWith('/api/') && url.href.includes(urlPart), async (route) => {
    if (route.request().method() !== method) return route.fallback();
    seen += 1;
    await gate;
    await route.continue();
  });
  return { count: () => seen, release: async () => release() };
}

export { expect };
```

- [ ] **Step 5:** Switch the spike's two spec files to `import { expect, test } from './fixtures'`. Run `npx playwright test`. Expected: all pass. If a spike test now fails on unmatched requests, route each listed URL in the fake (Task 3 owns the payloads) or model it as a deliberate 404.

- [ ] **Step 6:** Commit `chore: fail e2e tests on unrouted upstream calls`.

### Task 3: Fake payloads for a tracked character and its BiS

**Files:**
- Create: `e2e/__fixtures__/` (JSON payloads, trimmed), routes in `e2e/fake-upstream.mjs`

The fake must let a made-up character be added, synced and opened, and its spec's BiS list fetched from Method. Discover what's needed by running, not guessing:

- [ ] **Step 1:** Write `e2e/character-page.spec.ts` with one test: add `Birkibjörn` on `eu`/`kazzak` through `POST /api/characters`, then `page.goto` the URL from the response's `key`, and expect the character heading. Run it. Expected FAIL with the unmatched list naming every missing route.
- [ ] **Step 2:** For each listed URL, add a route with a trimmed payload. Shapes come from the parsers in `src/core/blizzard`, `src/core/raiderio`, `src/core/raidbots`, `src/core/method`, `src/core/wowhead`, and their unit-test fixtures. Reuse `src/core/method/__fixtures__/gearing.html` (guardian druid) and `src/core/wowhead/__fixtures__/currency-3446.json` by reading the files in the fake. Make Birkibjörn a Guardian Druid so the Method fixture matches. Keep every payload to what the parser reads.
- [ ] **Step 3:** Parameterize the profile route by name, so any name starting with `birki` (lowercased, after decoding) returns the same profile with that name. Tests then add distinct characters (`Birkibjörn`, `Birkiþór`, `Birkiörn`…) without new payloads.
- [ ] **Step 4:** Rerun until the test passes with no unmatched requests. Commit `chore: fake upstream payloads for a tracked character`.

### Task 4: useApiAction and search behavior

**Files:** `e2e/api-action.spec.ts`, `e2e/character-search.spec.ts`

- [ ] **Step 1: `e2e/api-action.spec.ts`**, four tests:
  - *A failed add shows the route's message:* home, search term `outage` (falls back to manual), fill name `Zzzqqxnotreal`, choose realm `Kazzak`, click **Add character**, expect the `alert` "Blizzard can’t find Zzzqqxnotreal on that realm."
  - *Track refreshes the page:* `page.goto('/group?chars=eu/kazzak/birkiþór')` (check `resolveGroupRequest` in `src/server/views/group-page-params.ts` for the exact key format), click **Track**, expect the member-notice row to go away and the character to show in the group grid, without `page.reload()`.
  - *Remove deletes the card:* add `Birkiörn` via `page.request.post('/api/characters', …)`, go home, accept the dialog (`page.once('dialog', d => d.accept())`) and click its Remove button, expect the card gone.
  - *Refresh re-renders:* open a tracked character's page, click Refresh, wait for the `POST …/sync?force=1` response, expect the header still visible and no `alert`.
- [ ] **Step 2: `character-search.spec.ts`** add *typing quickly sends one search request:* count `page.on('request')` for `/api/search`, `field.pressSequentially('Birki', { delay: 20 })`, wait for the listbox, expect count 1.
- [ ] **Step 3:** Run, fix fakes only where Task 3 missed a route. Commit `chore: e2e tests for useApiAction and search`.

### Task 5: Double-submit guards

**Files:** `e2e/double-submit.spec.ts`

One test per component. Each: reach the state, `const hold = await holdRequest(page, '<METHOD>', '<path>')`, click the button twice (`click()` then `click({ force: true })`), `await expect(button).toBeDisabled()`, `expect(hold.count()).toBe(1)`, `await hold.release()`, then expect the settled state.

| Component | Reach it | Method, path |
|---|---|---|
| AddCharacterBar | home, manual fallback (`outage`), name `Birkiný`, realm Kazzak | POST `/api/characters` |
| SearchResults | home, type `Birki`, result button | POST `/api/characters` |
| RefreshButton | character page | POST `/sync` |
| RemoveCharacterButton | home card, accept confirm | DELETE `/api/characters/` |
| TrackButton | `/group?chars=…` untracked member | POST `/api/characters` |
| FetchButton | `/settings/bis/<spec>` | POST `/api/bis/fetch` |
| SimcPaste | character page, paste `src/core/simc/__fixtures__/export.txt` with name and realm rewritten to the test character | POST `/simc` |
| CopyAgain | BiS editor after `POST /api/bis/manual/copy`, pick a source, confirm | POST `/api/bis/manual/copy` |
| OrphanList | BiS editor after `PUT /api/bis/overrides` for an item outside the list | DELETE `/api/bis/overrides` |
| SlotRow | BiS editor with one override set, **Reset** | DELETE `/api/bis/overrides` |
| ItemSearch | BiS editor, **Replace** a slot, search, **Choose**; and a catalyst slot's **Save** | PUT `/api/bis/overrides` |

Read each component before writing its test for exact labels and the request body the setup route needs. A test sets its own state through routes first (spec, "Database"). Commit after every three or four green tests: `chore: e2e double-submit tests for <components>`.

### Task 6: CI job and acceptance

**Files:** `.github/workflows/ci.yml`

- [ ] **Step 1:** Add the job:

```yaml
  e2e:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 24
          cache: npm
      - run: npm ci
      - run: npx playwright install --with-deps chromium
      - run: npm run test:e2e
      - if: failure()
        uses: actions/upload-artifact@v4
        with:
          name: playwright-report
          path: |
            playwright-report/
            test-results/
          if-no-files-found: ignore
```

- [ ] **Step 2: acceptance.** `npm run test:e2e` twice in a row, both green. Each spec file alone (`npx playwright test <file>`), green. `git status` clean afterwards. `npm run typecheck && npm run lint && npm test` green.
- [ ] **Step 3:** Commit `chore: run e2e tests in ci`. Push. Update PR #146: `Closes #35.`, What changes, Testing.
