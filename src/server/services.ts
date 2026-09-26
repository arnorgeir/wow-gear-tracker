import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { createBlizzardClient, type BlizzardClient } from '@/core/blizzard/client';
import { readConfig } from '@/core/config';
import { openDb, type Db } from '@/core/db/client';
import { createMethodSource } from '@/core/method/method';
import { createRaidbotsTracksFetcher } from '@/core/raidbots/tracks';
import { createCharacterSyncer, type CharacterSyncer } from '@/core/sync/character-sync';
import type { BisSource, Track } from '@/core/types';

export interface Services {
  db: Db;
  blizzard: BlizzardClient;
  bisSource: BisSource;
  fetchTracks: () => Promise<Track[]>;
  syncer: CharacterSyncer;
  now: () => number;
  fetchFn: typeof fetch;
}

async function build(): Promise<Services> {
  const config = readConfig();
  if (config.databaseUrl.startsWith('file:') && !config.databaseUrl.includes(':memory:')) {
    mkdirSync(path.dirname(path.resolve(config.databaseUrl.slice('file:'.length))), { recursive: true });
  }
  const db = await openDb(config.databaseUrl);
  const blizzard = createBlizzardClient({ clientId: config.blizzardClientId, clientSecret: config.blizzardClientSecret });
  return {
    db,
    blizzard,
    bisSource: createMethodSource(),
    fetchTracks: createRaidbotsTracksFetcher(),
    syncer: createCharacterSyncer({ db, blizzard }),
    now: Date.now,
    fetchFn: fetch,
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
