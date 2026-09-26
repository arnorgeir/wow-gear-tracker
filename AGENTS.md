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
4. Work happens on a branch named `feat/<description>`, `fix/<description>` or `chore/<description>`, and reaches `main` through a pull request. `main` is protected: CI must pass, and a review is required.

## Architecture rules

- **`src/core` is plain TypeScript.** It never imports `next`, `react`, or anything from `src/app`, `src/components` or `src/server`. This keeps the option to move logic into a separate service later.
- **`src/core` has three kinds of modules:**
  - Clients (`blizzard`, `method`, `raiderio`, `raidbots`) fetch and parse external data, and never touch the database.
  - Logic (`gear`, `simc/parse`) is pure functions, with no network or database access.
  - Sync (`sync`, `characters`, `simc/import-simc`) combines clients and the database, and receives both as parameters.
- **Pages and route handlers stay thin.** They call `src/server/views.ts` or a core function and render the result.
- **Plain functions and TypeScript types.** No class hierarchies, dependency injection containers, or interfaces with one implementation. `BisSource` is the one intentional interface.
- **Logic functions take only the data they need,** never a database client or a whole character row.

## Database rules

- **Every write goes through `withWriteLock`** in `src/core/db/queries.ts`. libsql's SQLite driver runs synchronously on the main thread: a write that waits on another connection's lock blocks the event loop, so the lock holder can never finish.
- **Change the schema in `src/core/db/schema.ts`,** then run `npm run db:generate -- --name <name>`. Never edit a migration that's already committed.
- **Cached Raidbots data is versioned.** When `upgrade_tracks` or `bonus_qualities` gain columns, bump the version in `TRACKS_META_KEY` in `src/core/sync/reference-sync.ts`, so installs refetch instead of trusting old rows for a day.
- **In-memory test databases have one connection.** Don't run database reads in parallel with a write in the same code path. Run them in sequence.

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

## Never commit

- `.env`, the `data/` folder, or anything with API credentials.
- Real character names of players in fixtures or docs.
- Mentions of AI tools in commit messages or pull request descriptions.
