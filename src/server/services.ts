import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { createBlizzardClient, type BlizzardClient } from '@/core/blizzard/client';
import { readConfig } from '@/core/config';
import { openDb, type Db } from '@/core/db/client';
import { createIcyVeinsSource } from '@/core/icy-veins/icy-veins';
import { createMethodSource } from '@/core/method/method';
import { createRaidbotsFetcher, type RaidbotsData } from '@/core/raidbots/tracks';
import { createCurrencyIconFetcher, withCurrencyIcons } from '@/core/wowhead/currency';
import { createCharacterSyncer, type CharacterSyncer } from '@/core/sync/character-sync';
import { LOCAL_ACCOUNT_ID, type BisSource, type FetchedSourceId } from '@/core/types';

export interface Services {
  db: Db;
  blizzard: BlizzardClient;
  bisSources: Record<FetchedSourceId, BisSource>;
  fetchRaidbots: () => Promise<RaidbotsData>;
  syncer: CharacterSyncer;
  now: () => number;
  fetchFn: typeof fetch;
  /** The account a request acts for. Always the local account until login exists. */
  currentAccountId: () => number;
}

async function build(): Promise<Services> {
  const config = readConfig();
  if (config.databaseUrl.startsWith('file:') && !config.databaseUrl.includes(':memory:')) {
    mkdirSync(path.dirname(path.resolve(config.databaseUrl.slice('file:'.length))), { recursive: true });
  }
  const db = await openDb(config.databaseUrl);
  // Every client gets the now and fetchFn that Services carries, so one swap reaches them all.
  const now = Date.now;
  const fetchFn = fetch;
  const blizzard = createBlizzardClient({ clientId: config.blizzardClientId, clientSecret: config.blizzardClientSecret, fetchFn, now });
  return {
    db,
    blizzard,
    bisSources: { method: createMethodSource(fetchFn), icyVeins: createIcyVeinsSource(fetchFn) },
    fetchRaidbots: withCurrencyIcons(createRaidbotsFetcher(fetchFn), createCurrencyIconFetcher(fetchFn)),
    syncer: createCharacterSyncer({ db, blizzard, now }),
    now,
    fetchFn,
    currentAccountId: () => LOCAL_ACCOUNT_ID,
  };
}

// Kept on globalThis so Next.js hot reloads reuse one database connection and one token cache.
const holder = globalThis as unknown as { __gearTrackerServices?: Promise<Services> };

export function getServices(): Promise<Services> {
  holder.__gearTrackerServices ??= build().catch((err) => {
    holder.__gearTrackerServices = undefined;
    throw err;
  });
  return holder.__gearTrackerServices;
}
