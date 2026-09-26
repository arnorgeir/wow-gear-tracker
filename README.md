# Gear Tracker

A local web app that compares World of Warcraft characters' gear to Method.gg's best-in-slot lists. It shows upgrade tracks, what each character still needs, and which BiS items are fully upgraded.

## Set up

1. Install Node.js 24 or later.
2. Create a Battle.net API client at https://community.developer.battle.net/access/clients. Client names are unique across all developers, so pick one with your name in it. Use `http://localhost` for both URLs.
3. Copy `.env.example` to `.env` and fill in `BLIZZARD_CLIENT_ID` and `BLIZZARD_CLIENT_SECRET`.
4. Install and start:

   ```bash
   npm install
   npm run dev
   ```

5. Open http://localhost:3000 and search for a character.

The database is a SQLite file in `data/`, created on first run. `.env` and `data/` never leave your machine.

## Scripts

| Script | Does |
|---|---|
| `npm run dev` | Starts the app on localhost:3000 |
| `npm test` | Runs unit and integration tests |
| `npm run test:live` | Checks the real Blizzard, Method and Raidbots APIs with your `.env` |
| `npm run typecheck` | Type-checks the project |
| `npm run lint` | Lints the project |
| `npm run db:generate -- --name <name>` | Generates a migration after a schema change |

## How it's built

All logic lives in `src/core` as plain TypeScript with no Next.js or React imports. Pages and API routes in `src/app` stay thin and call into `src/core` through `src/server`. The design spec is in `docs/superpowers/specs/`.

## Contributing

1. Branch from `main` as `feat/<description>` or `fix/<description>`.
2. Keep tests passing: `npm run typecheck && npm run lint && npm test`.
3. Open a pull request. CI must pass and a review is required before merging.
4. Never commit `.env`, the `data/` folder, or real character names in test fixtures.
