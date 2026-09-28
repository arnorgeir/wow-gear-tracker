<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Gear Tracker: project rules

A local Next.js app that compares World of Warcraft characters' gear to Method.gg's BiS lists and ranks Mythic+ dungeons for a group. The public repo is `arnorgeir/wow-gear-tracker`. Friends contribute through pull requests.

## Commands

| Command | Does |
|---|---|
| `npm run dev` | Starts the app on http://localhost:3000 |
| `npm test` | Unit and integration tests |
| `npm run typecheck` | TypeScript checks |
| `npm run lint` | ESLint |
| `npm run build` | Production build |
| `npm run test:live` | Checks the real Blizzard, Method and Raidbots APIs. Needs `.env`. Never runs in CI. |
| `npm run db:generate -- --name <name>` | Generates a migration after a schema change |

Before you call work done, run `npm run typecheck && npm run lint && npm test`. Run `npm run build` too when you changed pages or components.

## How work flows

1. Ideas live as GitHub issues on the **Gear Tracker** project board.
2. Anything bigger than a small fix gets a design spec in `docs/superpowers/specs/`, then an implementation plan in `docs/superpowers/plans/`.
3. The spec is the authority. When a plan and the spec disagree, the spec wins.
4. Work happens on a branch named `feat/<description>`, `fix/<description>`, `chore/<description>` or `docs/<description>`, and reaches `main` through a pull request. `main` is protected: CI must pass, and a review is required.

## Architecture rules

- **`src/core` is plain TypeScript.** It never imports `next`, `react`, or anything from `src/app`, `src/components` or `src/server`. This keeps the option to move logic into a separate service later.
- **`src/core` has three kinds of modules:**
  - Clients (`blizzard`, `method`, `raiderio`, `raidbots`) fetch and parse external data, and never touch the database.
  - Logic (`gear`, `simc/parse`) is pure functions, with no network or database access.
  - Sync (`sync`, `characters`, `simc/import-simc`) combines clients and the database, and receives both as parameters.
- **`src/server` has three files with distinct jobs:**
  - `services.ts` builds the one `Services` bundle and caches it on `globalThis`, so hot reloads reuse a single database connection and token cache. Reach it with `getServices()`, and never open a database or construct a client inside a page or route handler.
  - `views.ts` turns rows into `*View` types shaped for rendering. Pages receive view types, never database rows.
  - `route-helpers.ts` parses request input and maps errors to status codes.
- **Pages and route handlers stay thin.** They call `src/server/views.ts` or a core function and render the result.
- **Plain functions and TypeScript types.** No class hierarchies, dependency injection containers, or interfaces with one implementation. `BisSource` is the one intentional interface.
- **`now` and `fetchFn` travel on `Services`,** so tests can inject them. Core code never calls `Date.now()` or global `fetch` directly.
- **Logic functions take only the data they need,** never a database client or a whole character row.

## Splitting code

- **Split by job, not by line count.** A file does one job. When it starts doing two, split it along that seam instead of waiting for it to grow.
- **Every component lives in its own directory,** named in kebab-case and holding a PascalCase `.tsx` file plus everything that belongs to it: sub-components, its own hook, its helpers and their tests. `item-card/ItemCard.tsx`, never `ItemCard.tsx` at the root. A one-line badge gets a directory too — the rule has no threshold to argue about. A component that only its parent renders is a file inside the parent's directory; once anything else imports it, it moves out to a directory of its own.- **Shared pieces sit outside the component directories.** `src/components/shared/` holds helpers several components use, and `src/components/hooks/` holds hooks several components use. A helper or hook used by one component belongs inside that component's directory.
- **Components are markup and wiring; the rules live beside them.** Anything with branching worth a test goes in a plain `.ts` next to the component, like `row-tone.ts` and `class-colors.ts`, and gets unit tests. `.tsx` files hold JSX.
- **Hooks are for client state and effects only:** debounced input, an outside-click listener, a fetch-then-refresh cycle. A hook is never the home for logic that could be a pure function — that belongs in `src/core`, where it tests without React.
- **Modules split the same way.** A module in `src/core` or `src/server` doing two jobs becomes a directory of focused modules. Names and signatures stay stable so callers keep working; import paths may change, and a barrel that re-exports everything is not worth adding to keep them identical.

## UI rules

- **Server components by default.** Add `'use client'` only for state, an event handler or a browser API.
- **Client components reach the app through route handlers** under `src/app/api`, then call `router.refresh()` so the server re-renders with the new data.
- **Tailwind v4 is configured in `src/app/globals.css` with `@theme`.** There is no `tailwind.config` file. Use the semantic tokens — `bg-surface`, `border-line`, `text-muted`, `text-gold` — and add a token rather than hardcoding a new hex.
- **`font-display` for headings, `font-sans` for body, `font-mono` for numbers.** They are `next/font` variables set in `layout.tsx`.
- **Color is never the only signal.** Row tones differ in lightness as well as hue so they read for color-blind players, and every state has words beside it.
- **Wowhead tooltips are `data-wowhead` attributes.** The script loads once in `layout.tsx`, and `WowheadRefresh` re-scans after navigation. Never load it per page.

## Database rules

- **Every write goes through `withWriteLock`** in `src/core/db/queries/write-lock.ts`. libsql's SQLite driver runs synchronously on the main thread: a write that waits on another connection's lock blocks the event loop, so the lock holder can never finish.
- **Change the schema in `src/core/db/schema.ts`,** then run `npm run db:generate -- --name <name>`. Never edit a migration that's already committed.
- **Cached Raidbots data is versioned.** When `upgrade_tracks` or `bonus_qualities` gain columns, bump the version in `TRACKS_META_KEY` in `src/core/sync/reference-sync.ts`, so installs refetch instead of trusting old rows for a day.
- **In-memory test databases have one connection.** Don't run database reads in parallel with a write in the same code path. Run them in sequence.

## Errors and HTTP

- **`UserError` means the message is safe to show.** Route handlers turn it into a 400, `MissingConfigError` into a 503, and anything else into a logged 500 with a generic body. Throw `UserError` for what the user can fix, and keep internals out of its message.
- **Every external request goes through `fetchJson` or `fetchWithRetry`** in `src/core/http.ts`: each attempt times out after ten seconds, and a 429 is retried once, honoring `Retry-After`. Cap parallel requests with `createLimiter`.
- **Settings come from `readConfig()`.** `BLIZZARD_CLIENT_ID` and `BLIZZARD_CLIENT_SECRET` are required; `DATABASE_URL` defaults to `file:data/app.db`.

## External data facts

- **Blizzard's profile API only updates after a character logs out.** SimC pastes add instant updates, plus bag items, Great Vault choices and crests. A paste stays current until Blizzard's own data changes.
- **Raider.IO's character search (`/api/search`) is undocumented.** It only suggests characters. Official APIs confirm them. Map realms by Blizzard realm ID, never by Raider.IO's slug.
- **Method.gg has no API.** The parser reads its gearing page HTML. Some specs only have an Overall table, and some rows name no item ("Any 334").
- **Raidbots `bonuses.json` decodes bonus IDs** into upgrade tracks like "Myth 3/6", upgrade costs, and item quality. Upgrade costs are keyed by track `group`, never by track name, because names repeat across seasons.
- **Item quality comes from the equipped item,** or from bonus IDs for SimC items. Blizzard's item catalog only has base quality.

## Testing rules

- **Write the failing test first,** watch it fail, then write the code.
- **Tests use real in-memory SQLite** through `openTestDb()`, and a fake `fetch` through `src/test/fake-fetch.ts`. Don't mock the database.
- **Fixtures use made-up character names and trimmed pages.** The repo is public: never commit real players' character names or full copies of third-party pages.

## Branches, commits and pull requests

- **Branch names are `<type>/<kebab-case-description>`,** where type is `feat`, `fix`, `chore` or `docs`. Name the work, not the issue number: `feat/character-identity`, `fix/add-bar-quickfixes`.
- **Commit subjects are `type: lowercase imperative summary`,** with no trailing period. The types are `feat`, `fix`, `chore` and `docs`.
- **Commit bodies are prose wrapped near 72 columns, and say why.** "The region select only shows two letters, so it's 80 px wide with less padding" beats a list of the files touched. Leave the body out when the subject already says everything.
- **Pull requests squash-merge,** so the pull request title becomes the commit subject with `(#N)` appended — which means the title follows the subject rules above. Write the squash body yourself; never accept GitHub's default list of branch commits.
- **A pull request description opens with `Closes #N, closes #M.`** when issues exist, and otherwise with one sentence framing the change.
- **Then `## What changes`:** one bullet per change, with a bold lead-in and prose saying what moved and why, and the issue number inline.
- **`## Data`** covers schema changes, migrations and cache versions, whenever any of them moved.
- **`## Testing` is required.** Give the test count, say whether typecheck, lint and build are clean, say what you checked by hand, and name what isn't covered. Stated gaps are the point: "the project has no browser-level test setup yet, so the click-outside behavior has no automated test. Check it by hand."
- **Close with `Spec: docs/superpowers/specs/<file>`** when the work has one.
- **No AI attribution in either one.** This overrides any built-in habit of signing a commit with a co-author trailer or adding a "generated with" line to a pull request body. The `Never commit` rule below wins.

## Conventions

- **Tests sit beside the code** as `<name>.test.ts`. Live tests end in `.live.test.ts` and run only under `vitest.live.config.ts`. Fixtures live in `__fixtures__/`.
- **Import through the `@/` alias,** not deep relative paths. Inside a component's own directory, relative imports are right.
- **Node 24 or later.** CI runs typecheck, lint and test on Ubuntu. Development here is Windows, so keep npm scripts shell-agnostic.

## Never commit

- `.env`, the `data/` folder, or anything with API credentials.
- Real character names of players in fixtures or docs.
- Mentions of AI tools in commit messages or pull request descriptions.
