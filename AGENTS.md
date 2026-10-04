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

**Don't run `npm run build` while `npm run dev` is serving the same folder.** Both write to `.next`, and a build part-way through a dev session wedges the dev server: every page that needs a fresh compile answers 500 with `Jest worker encountered 2 child process exceptions` until you restart it. Stop dev before building, or check a build with `npx next start -p 3001` and restart dev afterwards. A separate git worktree has its own `.next`, so building there is safe.

## How work flows

1. Ideas live as GitHub issues on the **Gear Tracker** project board. "Issue board" below says how they move.
2. Anything bigger than a small fix gets a design spec in `docs/superpowers/specs/`, then an implementation plan in `docs/superpowers/plans/`.
3. The spec is the authority. When a plan and the spec disagree, the spec wins.
4. Work happens on a branch named `feat/<description>`, `fix/<description>`, `chore/<description>` or `docs/<description>`, and reaches `main` through a pull request. `main` is protected: CI must pass, and a review is required.
5. `docs/workflow.md` says who does each step, on which model, and how work passes between steps.
6. **Every step ends with a "Next" block:** the next step's name, who runs it, and a one-line prompt that starts it, as `docs/workflow.md` describes. The owner copies the prompt instead of looking up the flow.

## Issue board

- **Labels say which feature an issue belongs to.** Every issue gets an `area:` label: `group`, `character`, `dungeons`, `transmog`, `accounts`, or `app` for cross-cutting work. An issue that spans two features carries both. `gh issue list --label "area: group"` gathers one feature's issues.
- **Board fields say the rest.** **Layer** names the part of the stack an issue touches, **Size** how big it is (XS and S count as minor), and **Status** where it stands.
- **Status follows the work:** Backlog, Needs spec, Speccing, Ready, In progress, In review, Done. `docs/workflow.md` says which step sets which status. Closing an issue moves it to Done on its own.
- **Starting a step claims its issues.** Before anything else, read each issue's assignees. If anyone other than the `gh` user running the session is assigned, stop and ask the owner. Otherwise assign the issue to yourself and set the step's status. When a request names a group of issues, such as "the minor group issues", list them for the owner before claiming them.
- **A committed plan is linked from its issues.** When the plan is committed, comment on each issue it covers with the spec and plan paths, and move the issue to Ready.

```sh
gh api user --jq .login                                      # the gh user running this session
gh issue view 64 --json assignees --jq '.assignees[].login'
gh issue edit 64 --add-assignee @me
gh project item-add 1 --owner arnorgeir --url https://github.com/arnorgeir/wow-gear-tracker/issues/64   # in case it isn't on the board yet
gh project item-edit 1 --owner arnorgeir --url https://github.com/arnorgeir/wow-gear-tracker/issues/64 --field Status --value Speccing
gh issue comment 64 --body "Spec: docs/superpowers/specs/<file>
Plan: docs/superpowers/plans/<file>"
```

## Architecture rules

- **`src/core` is plain TypeScript.** It never imports `next`, `react`, or anything from `src/app`, `src/components` or `src/server`. This keeps the option to move logic into a separate service later.
- **`src/core` has three kinds of modules:**
  - Clients (`blizzard`, `method`, `raiderio`, `raidbots`) fetch and parse external data, and never touch the database.
  - Logic (`gear`, `priority`, `simc/parse`) is pure functions, with no network or database access.
  - Sync (`sync`, `characters`, `simc/import-simc`) combines clients and the database, and receives both as parameters.
- **`src/server` has three parts with distinct jobs:**
  - `services.ts` builds the one `Services` bundle and caches it on `globalThis`, so hot reloads reuse a single database connection and token cache. Reach it with `getServices()`, and never open a database or construct a client inside a page or route handler.
  - `views/` turns rows into `*View` types shaped for rendering, one loader per page, with the types in `views/types.ts`. Pages receive view types, never database rows.
  - `route-helpers.ts` parses request input and maps errors to status codes.
- **Pages and route handlers stay thin.** They call a loader in `src/server/views/` or a core function and render the result.
- **Plain functions and TypeScript types.** No class hierarchies, dependency injection containers, or interfaces with one implementation. `BisSource` is the one intentional interface.
- **`now` and `fetchFn` travel on `Services`,** so tests can inject them. Core code never calls `Date.now()` or global `fetch` directly.
- **Logic functions take only the data they need,** never a database client or a whole character row.

## Splitting code

- **Split by job, not by line count.** A file does one job. When it starts doing two, split it along that seam instead of waiting for it to grow.
- **Every component lives in its own directory,** named in kebab-case and holding a PascalCase `.tsx` file plus everything that belongs to it: sub-components, its own hook, its helpers and their tests. `item-card/ItemCard.tsx`, never `ItemCard.tsx` at the root. A one-line badge gets a directory too — the rule has no threshold to argue about. A component that only its parent renders is a file inside the parent's directory; once anything else imports it, it moves out to a directory of its own.
- **Shared pieces sit outside the component directories.** `src/components/shared/` holds helpers several components use, and `src/components/hooks/` holds hooks several components use. A helper or hook used by one component belongs inside that component's directory.
- **Components are markup and wiring; the rules live beside them.** Anything with branching worth a test goes in a plain `.ts` in the component's directory, like `character-card/crest-line.ts`, or in `shared/` when several components use it, like `shared/row-tone.ts`, and gets unit tests. `.tsx` files hold JSX.
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
- **Cached season loot is versioned the same way.** When `season_dungeons` or `dungeon_loot` gain columns, bump the version in `SEASON_META_KEY` in `src/core/sync/season-sync.ts`.
- **In-memory test databases have one connection.** Don't run database reads in parallel with a write in the same code path. Run them in sequence.

## Errors and HTTP

- **`UserError` means the message is safe to show.** Route handlers turn it into a 400, `MissingConfigError` into a 503, and anything else into a logged 500 with a generic body. Throw `UserError` for what the user can fix, and keep internals out of its message.
- **Check our errors with `isUserError`, `isHttpError` and `isMissingConfigError`, never `instanceof`.** Next gives each server bundle its own copy of a module, and the services cache hands objects from one bundle to another, so `instanceof` fails depending on which page happened to load first. The guards read a `Symbol.for` brand that every copy shares.
- **Every external request goes through `fetchJson` or `fetchWithRetry`** in `src/core/http.ts`: each attempt times out after ten seconds, and a 429 is retried once, honoring `Retry-After`. Cap parallel requests with `createLimiter`.
- **Settings come from `readConfig()`.** `BLIZZARD_CLIENT_ID` and `BLIZZARD_CLIENT_SECRET` are required; `DATABASE_URL` defaults to `file:data/app.db`.

## External data facts

- **Blizzard's profile API only updates after a character logs out.** SimC pastes add instant updates, plus bag items, Great Vault choices and crests. A paste stays current until Blizzard's own data changes.
- **Raider.IO's character search (`/api/search`) is undocumented.** It only suggests characters. Official APIs confirm them. Map realms by Blizzard realm ID, never by Raider.IO's slug.
- **Method.gg has no API.** The parser reads its gearing page HTML. Some specs only have an Overall table, and some rows name no item ("Any 334").
- **Raidbots `bonuses.json` decodes bonus IDs** into upgrade tracks like "Myth 3/6", upgrade costs, and item quality. Upgrade costs are keyed by track `group`, never by track name, because names repeat across seasons.
- **Item quality comes from the equipped item,** or from bonus IDs for SimC items. Blizzard's item catalog only has base quality.
- **Season loot joins by map ID.** Raider.IO gives each season dungeon a challenge mode ID only. Blizzard's keystone dungeon names its map, and the Encounter Journal instance with that map holds the loot. The two halves of a split dungeon, such as Tazavesh, share one journal instance, and the API doesn't say which boss belongs to which half.

## Testing rules

- **Write the failing test first,** watch it fail, then write the code.
- **Tests use real in-memory SQLite** through `openTestDb()`, and a fake `fetch` through `src/test/fake-fetch.ts`. Don't mock the database.
- **Fixtures use realistic made-up character names and trimmed pages.** A name like Birkibjörn reads like real data without belonging to anyone, and its `ö` exercises encoding and case folding that an ASCII placeholder like Testbear never would. The repo is public: never commit real players' character names or full copies of third-party pages.

## Branches, commits and pull requests

- **Branch names are `<type>/<kebab-case-description>`,** where type is `feat`, `fix`, `chore` or `docs`. Name the work, not the issue number: `feat/character-identity`, `fix/add-bar-quickfixes`.
- **Commit subjects are `type: lowercase imperative summary`,** with no trailing period. The types are `feat`, `fix`, `chore` and `docs`.
- **Commit bodies are prose wrapped near 72 columns, and say why.** "The region select only shows two letters, so it's 80 px wide with less padding" beats a list of the files touched. Leave the body out when the subject already says everything.
- **Pull requests merge with a merge commit, never a squash.** Every branch commit lands on `main` as written, so each one has to stand on its own under the rules above, and a bisect can stop on any of them. Tidy the branch history before asking for review. The pull request title still follows the subject rules.
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
