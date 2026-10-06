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

## Instant updates with SimC

Blizzard's API only updates a character after they log out. For instant updates, use the [SimulationCraft addon](https://www.curseforge.com/wow/addons/simulationcraft):

1. In game, type `/simc` and copy all the text.
2. On the character's page, open **Update from SimC**, paste, and select **Import**.

A paste also brings in bag items, Great Vault choices and crest counts, which Blizzard's API doesn't have. The pasted gear stays current until Blizzard's data changes, which happens after your next logout.

## Scripts

| Script | Does |
|---|---|
| `npm run dev` | Starts the app on http://localhost:3000, reachable from this computer only |
| `npm test` | Runs unit and integration tests |
| `npm run test:live` | Checks the real Blizzard, Method and Raidbots APIs with your `.env` |
| `npm run typecheck` | Type-checks the project |
| `npm run lint` | Lints the project |
| `npm run db:generate -- --name <name>` | Generates a migration after a schema change |

### Using the app from your phone

`npm run dev -- -H 0.0.0.0` opens the app to your network, so a phone on the same Wi-Fi can use `http://<your-pc-ip>:3000`. Use the IP address: the app refuses other host names. The app has no login, so anyone on that network can add, change and remove characters while it runs this way. Do not do it on public Wi-Fi.

## How it's built

All logic lives in `src/core` as plain TypeScript with no Next.js or React imports. Pages and API routes in `src/app` stay thin and call into `src/core` through `src/server`. The design spec is in `docs/superpowers/specs/`.

## Contributing

1. Branch from `main` as `feat/<description>` or `fix/<description>`.
2. Keep tests passing: `npm run typecheck && npm run lint && npm test`.
3. Open a pull request. CI must pass and a review is required before merging.
4. Never commit `.env`, the `data/` folder, or real character names in test fixtures.
