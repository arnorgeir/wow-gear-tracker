# Browser tests: Playwright against the production build

Status: draft, waiting on owner approval.
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

**A preload that replaces `globalThis.fetch` inside the `next start` process.** `e2e/fake-upstream.mjs` is passed with `NODE_OPTIONS=--import ./e2e/fake-upstream.mjs`, only by `playwright.config.ts`.

- Every core client already defaults `fetchFn` to the global `fetch` at call time, and `services.ts` reads it when it builds. Routes that call `fetch` directly (`/api/search`) are covered too. No app code changes, and nothing fake ships in the production bundle.
- Requests to `127.0.0.1`/`localhost` pass through. Every other host gets a canned answer or a 404 naming the URL, so a missing fake fails loudly instead of reaching the internet.
- **Scenarios are picked by input, not by shared state.** A search term containing `outage` makes Raider.IO answer 500. A name the fake doesn't know gets Blizzard's 404. Tests stay independent and can run in any order.
- **In-flight states are held from the browser side.** Double-submit tests use Playwright's `page.route` on our own `/api/...` request to hold it open, assert the button is disabled, then release it. No timing tricks on the server.
- Fixtures follow the repo rules: made-up names with non-ASCII letters (Birkibjörn), trimmed payloads. Payloads big enough to need a file go in `e2e/__fixtures__/`.
- Blizzard credentials are dummy values set in `playwright.config.ts`. `.env` is never read.

### Database

A fresh SQLite file per run at `.cache/e2e/app.db` (already git-ignored), deleted by a Playwright `globalSetup` before the server starts. `openDb` runs migrations on open, so no seed step is needed for an empty app. Tests that need tracked characters add them through the app (`POST /api/characters` against faked Blizzard profiles), not by writing rows, so they exercise the same path a user does.

`workers: 1`: one server, one database, tests in sequence. Parallel workers wait until the suite is slow enough to need them.

### Build output

`next build` for e2e writes to `.next-e2e`, not `.next`: `next.config.ts` reads `distDir` from `NEXT_DIST_DIR`, defaulting to `.next`. That keeps `npm run test:e2e` from wedging a running `npm run dev` (`AGENTS.md`, "Commands"). `.next-e2e/` is git-ignored.

### Does it run in CI

**Yes, as a separate `e2e` job in `.github/workflows/ci.yml`,** next to `test`: `npm ci`, `npx playwright install --with-deps chromium`, `npm run test:e2e`. It needs no secrets.

- Not a required check at first. The owner makes it required in branch protection once it has stayed green for a week of pull requests.
- On failure the job uploads `playwright-report/` and traces as an artifact.
- `npm test` stays Vitest only, so the fast gate stays fast.

## Scripts and files

| Path | Job |
|---|---|
| `playwright.config.ts` | Server command, port 3100, env (dummy creds, `DATABASE_URL`, `NODE_OPTIONS`, `NEXT_DIST_DIR`) |
| `e2e/fake-upstream.mjs` | The fetch preload. Plain JS: it runs before any TypeScript loader |
| `e2e/global-setup.ts` | Deletes `.cache/e2e/` |
| `e2e/*.spec.ts` | Tests, one file per feature area |
| `package.json` | `"test:e2e": "next build && playwright test"`, with `NEXT_DIST_DIR` set by the config, not the shell, so it works on Windows. `@playwright/test` as a dev dependency |
| `.gitignore` | `.next-e2e/`, `test-results/`, `playwright-report/` |

`e2e/` sits outside `src/`, so `src/core` rules don't apply and Vitest's `src/**/*.test.ts` never picks it up. Spec files end in `.spec.ts` so neither runner can confuse them.

Local setup, once: `npx playwright install chromium`.

## First test set

The four gaps the issue names, plus #33:

1. **`useApiAction`** (#31): a route failure shows its message; a success refreshes the page. Through `RefreshButton` and `RemoveCharacterButton`.
2. **`use-character-search`** (#32): one `/api/search` request after typing a name quickly (count requests with `page.on('request')`), outside click closes the list, Escape closes it, focus reopens it.
3. **Manual realm fallback:** an outage term shows "Search is unavailable. Pick the realm yourself." and the realm list from Blizzard's realm index.
4. **Double-submit guards:** every button that calls a route is disabled while its request is held: `AddCharacterBar`, `SearchResults`, `RefreshButton`, `RemoveCharacterButton`, `TrackButton`, `FetchButton`, `SimcPaste`, `CopyAgain`, `OrphanList`, `SlotRow`, `ItemSearch`.
5. **Error brands** (#33): after a page loads, adding an unknown character answers 400 with Blizzard's message, not 500. Already in the spike.

## Found by the spike

**Escape empties the search field.** Chromium clears an `<input type="search">` on Escape, so closing the list also throws away the typed name. `e2e/character-search.spec.ts` records it as `test.fail('Escape keeps the typed name')`. The fix (`preventDefault` on Escape while the list is open) is a separate small issue; when it lands, the test flips to a plain `test`.

## Out of scope

- Visual regression and screenshots.
- Browsers other than Chromium.
- Live upstream checks. `npm run test:live` stays as it is.
- Hand checks against a copy of `data/app.db`.
