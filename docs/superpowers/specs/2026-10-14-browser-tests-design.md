# Browser tests: Playwright against the production build

Status: approved. The owner handed the spec on to review and planning on 2026-10-14. The Codex spec review's findings S.1 to S.9 are resolved here; none changes scope.
Date: 2026-10-14
Issues: #35

## Goal

Test client behavior in a real browser against a real `next start`, so hook and handler behavior stops being a hand check, and bugs that only exist in a built app (#33) get caught.

A spike on this branch proves the approach: `playwright.config.ts`, `e2e/fake-upstream.mjs` and two spec files, five tests, about 10 s against a built app. Reintroducing #33's `instanceof` check in `add-character.ts` turns `e2e/error-brands.spec.ts` red (500 instead of 400).

## Open questions answered

### Which layer

**End-to-end only: Playwright against `next start`.** No jsdom or happy-dom component layer.

- The rules already move branching out of components and hooks into plain `.ts` files with unit tests (`AGENTS.md`, "Splitting code"). What's left in a hook is wiring: timers, listeners, fetch then refresh. That wiring is exactly what jsdom fakes badly and a browser does for free.
- Only the built app has #33's class of bug. A component layer can't catch it.
- One new tool instead of three (`jsdom`, Testing Library, a second Vitest environment).
- Revisit if the e2e run gets slow enough to hurt, past roughly a minute.

### How to fake Blizzard, Raider.IO and the rest

**A preload that replaces `globalThis.fetch` inside the `next start` process.** `e2e/fake-upstream.mjs` is passed with `NODE_OPTIONS=--import ./e2e/fake-upstream.mjs`, only to the server process the launcher starts (see "Server lifecycle").

- Every core client takes the global `fetch` as its default when `services.ts` constructs it, and `/api/search` passes the global `fetch` to Raider.IO itself. The preload runs before any of that, so all of them get the fake. Next's own fetch patch wraps the existing global rather than replacing it. No app code changes, and nothing fake ships in the production bundle.
- **Loopback passes through, judged by parsed hostname:** exactly `127.0.0.1`, `localhost` or `[::1]`. A prefix check would let `localhost.example.com` through.
- **Every expected answer is modeled, including the negative ones.** An unknown character gets an explicit Blizzard 404 route; an optional source that the app tolerates missing (Wowhead's currency tooltip, item media) gets an explicit route too, either a canned answer or a deliberate 404.
- **An unmatched request fails the suite.** The fake answers it with a 404, and also appends its URL to `.cache/e2e/unmatched.log`. A shared auto fixture in `e2e/fixtures.ts` reads that log after every test and fails the test when it grew. This catches requests the app swallows, such as a sync fallback, which a 404 body alone never would. A harness test proves it: a request to an unrouted host makes the fixture fail.
- **Scenarios are picked by input, not by shared state.** A search term containing `outage` makes Raider.IO answer 500. A name the fake doesn't know gets Blizzard's 404.
- **One exception: the orphan override.** No route can make one. `saveOverride` rejects a slot the list lacks, saving puts the item in the catalog, and copying a manual list drops its overrides. The only way is a Method refetch that drops a row, and `syncBisLists` refetches only once the cached list is a day old. So the orphan test sets two files the fake reads: `.cache/e2e/method-without-cloak` names a spec whose Method page loses its Cloak row, and `.cache/e2e/clock-skew-ms` moves the server's `Date.now` ahead, re-read every 50 ms. The test uses `feral-druid`, a spec no other test reads, and clears both files when it's done. While the skew is set, every server clock reading jumps, so nothing else runs in that window.
- **In-flight states are held from the browser side.** Double-submit tests use Playwright's `page.route` on our own `/api/...` request to hold it open, assert the button is disabled and that only one matching request went out, then release it. No timing tricks on the server.
- Fixtures follow the repo rules: made-up names with non-ASCII letters (Birkibjörn), trimmed payloads. Payloads big enough to need a file go in `e2e/__fixtures__/`. Existing trimmed fixtures under `src/core/*/__fixtures__/` (Method, Icy Veins, Wowhead) are reused, not copied.
- No real credentials are needed. The launcher sets dummy Blizzard credentials and the e2e `DATABASE_URL` for both `next build` and `next start`. Next still loads `.env` files, but explicit process values win, so a developer's `.env` can't point the run at real APIs or the real database.

### Browser traffic

The preload covers the server. **Chromium's own requests are covered by a context route in `e2e/fixtures.ts`:** every request to a host other than the app's origin is aborted. That blocks Wowhead's `tooltips.js` from `layout.tsx`, item icons from `wow.zamimg.com` and render images from Blizzard. Tests that hold an `/api/...` request add their own `page.route`, which runs before the context route.

`next build` downloads Google fonts for `next/font`. That is a build-time network dependency, outside the preload. CI has network; the runtime isolation claim covers `next start` and the browser only.

### Server lifecycle

**A launcher, `e2e/serve.mjs`, is Playwright's `webServer.command`.** It runs in this order, with one environment object for both child processes:

1. Deletes `.cache/e2e/`. Nothing has opened the database yet, so this is safe on Windows too.
2. Runs `next build` with `NEXT_DIST_DIR=.next-e2e`, dummy credentials and the e2e `DATABASE_URL`.
3. Runs `next start -H 127.0.0.1 -p 3100` with the same environment plus `NODE_OPTIONS=--import ./e2e/fake-upstream.mjs`, and forwards signals so Playwright can stop it.

Playwright's own `globalSetup` runs after the web server is already up and serving `/`, which opens the database, so it never deletes anything. `webServer.timeout` allows for the build. `npm run test:e2e` is plain `playwright test`, and the launcher spawns `next` through `node`, so it works the same on Windows.

### Database

A fresh SQLite file per run at `.cache/e2e/app.db` (already git-ignored), removed by the launcher before the server starts. `openDb` runs migrations on open, so no seed step is needed for an empty app. Tests that need tracked characters add them through the app (`POST /api/characters` against faked Blizzard profiles), not by writing rows, so they exercise the same path a user does.

`workers: 1`: one server, one database, tests in sequence. Parallel workers wait until the suite is slow enough to need them.

**Tests don't depend on each other's leftovers.** One database lasts the whole run, so:

- Each test that adds a character uses its own made-up name, so no test finds another's character.
- A test that depends on shared state (a spec's BiS source, its manual list, an override) sets that state through the app's routes at its start, instead of assuming a fresh default.
- Editor states that need setup get it through routes: a manual list exists after `POST /api/bis/manual/copy`, an orphan override after an override is saved and a skewed refetch drops its row (see the exception above).
- Acceptance: every test passes alone (`--grep`) and in the full run, and two consecutive full runs both pass.

### Build output

`next build` for e2e writes to `.next-e2e`, not `.next`: `next.config.ts` reads `distDir` from `NEXT_DIST_DIR`, defaulting to `.next`. That keeps `npm run test:e2e` from wedging a running `npm run dev` (`AGENTS.md`, "Commands").

A separate dist dir doesn't isolate everything Next writes, so:

- **`eslint.config.mjs` ignores `.next-e2e/**`,** as it already ignores `.next/**`. `.gitignore` alone doesn't keep it out of `eslint .`.
- **`tsconfig.json` already lists `.next-e2e/types/**/*.ts` and `.next-e2e/dev/types/**/*.ts`,** committed, so an e2e build finds nothing to add and leaves `tsconfig.json` unchanged.
- `next-env.d.ts` is git-ignored and rewritten by whichever of `dev` or `build` ran last; it stays valid either way.
- Acceptance: after `npm run test:e2e`, `git status` is clean and `npm run typecheck && npm run lint` pass.

### Does it run in CI

**Yes, as a separate `e2e` job in `.github/workflows/ci.yml`,** next to `test`, with its own checkout and Node 24 setup: `npm ci`, `npx playwright install --with-deps chromium`, `npm run test:e2e`. It needs no secrets.

- Not a required check at first. The owner makes it required in branch protection once it has stayed green for a week of pull requests.
- `playwright.config.ts` sets the reporters to `list` plus `html` (`open: 'never'`), and `trace: 'retain-on-failure'`, so a failure leaves `playwright-report/` and traces in `test-results/`.
- On failure the job uploads both folders as one artifact, with `if-no-files-found: ignore` for a build that fails before Playwright writes anything.
- `npm test` stays Vitest only, so the fast gate stays fast.

## Scripts and files

| Path | Job |
|---|---|
| `playwright.config.ts` | `webServer` running the launcher on port 3100 with a build-sized timeout, reporters, trace policy, `workers: 1` |
| `e2e/serve.mjs` | The launcher: resets `.cache/e2e/`, builds to `.next-e2e`, starts the server with the preload |
| `e2e/fake-upstream.mjs` | The fetch preload. Plain JS: it runs before any TypeScript loader |
| `e2e/fixtures.ts` | Shared `test`: blocks external browser traffic, fails a test that caused an unmatched upstream request |
| `e2e/*.spec.ts` | Tests, one file per feature area. They import `test` from `./fixtures` |
| `next.config.ts` | `distDir: process.env.NEXT_DIST_DIR ?? '.next'` |
| `eslint.config.mjs`, `tsconfig.json` | `.next-e2e` ignored and its type globs listed |
| `package.json` | `"test:e2e": "playwright test"`. `@playwright/test` as a dev dependency |
| `.gitignore` | `.next-e2e/`, `test-results/`, `playwright-report/` |

`e2e/` sits outside `src/`, so `src/core` rules don't apply and Vitest's `src/**/*.test.ts` never picks it up. Spec files end in `.spec.ts` so neither runner can confuse them.

Local setup, once: `npx playwright install chromium`.

## First test set

The four gaps the issue names, plus #33:

1. **`useApiAction`** (#31): a route failure shows its message, through `AddCharacterBar` adding an unknown character, which renders the hook's error. A success refreshes the page: `TrackButton` adds a character and the card appears without a reload. `RemoveCharacterButton` and `RefreshButton` render no error of their own, so they are tested for what they do: the removed card disappears, and a refresh re-renders the card.
2. **`use-character-search`** (#32): one `/api/search` request after typing a name quickly (count requests with `page.on('request')`), outside click closes the list, Escape closes it, focus reopens it.
3. **Manual realm fallback:** an outage term shows "Search is unavailable. Pick the realm yourself." and the realm list from Blizzard's realm index.
4. **Double-submit guards:** every native button that calls a route is disabled while its request is held, and only one request goes out: `AddCharacterBar`, `SearchResults`, `RefreshButton`, `RemoveCharacterButton` (after accepting its confirm), `TrackButton`, `FetchButton`, `SimcPaste`, `CopyAgain` (after its replace confirmation), `OrphanList`, `SlotRow` (Reset), `ItemSearch` (both the plain Choose and the catalyst Save). Buttons in those components that only change local state, like CopyAgain's source choice or SlotRow's Replace, aren't route calls and aren't tested as such.
5. **Error brands** (#33): after a page loads, adding an unknown character answers 400 with Blizzard's message, not 500. Already in the spike, now against an explicit 404 route instead of the catch-all.

The radios, checkbox and select in `SourcePicker`, `CompareAgainst`, `StatsMatter` and `CharacterSettings` also write to routes, and don't disable while busy. They aren't buttons, so they stay outside this issue; a separate issue covers them if the owner wants it.

## Found by the spike

**Escape empties the search field.** Chromium clears an `<input type="search">` on Escape, so closing the list also throws away the typed name. `e2e/character-search.spec.ts` records it as `test.fail('Escape keeps the typed name')`. The fix (`preventDefault` on Escape while the list is open) is a separate small issue; when it lands, the test flips to a plain `test`.

## Out of scope

- Visual regression and screenshots.
- Browsers other than Chromium.
- Live upstream checks. `npm run test:live` stays as it is.
- Hand checks against a copy of `data/app.db`.
- Busy states on the non-button controls listed under "First test set".
