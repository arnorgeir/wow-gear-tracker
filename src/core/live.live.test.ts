import { describe, expect, it } from 'vitest';
import { createBlizzardClient } from './blizzard/client';
import { readConfig } from './config';
import { createMethodSource } from './method/method';
import { createRaidbotsFetcher } from './raidbots/tracks';
import { fetchMainSeason } from './raiderio/season';
import { loadSeasonLoot } from './sync/season-sync';
import type { Region } from './types';

// Run with: node --env-file=.env ./node_modules/vitest/vitest.mjs run --config vitest.live.config.ts
// or: npm run test:live (after exporting the .env variables). Never runs in CI.
const env = process.env;

describe('live services', () => {
  it('Method still has all three BiS tables for Guardian Druid', async () => {
    const lists = await createMethodSource().fetchLists('guardian-druid');
    expect(lists.overall.length).toBeGreaterThan(10);
    expect(lists.raid.length).toBeGreaterThan(10);
    expect(lists.mythicPlus.length).toBeGreaterThan(10);
  });

  it('Raidbots still publishes Myth upgrade tracks', async () => {
    const { tracks, qualities } = await createRaidbotsFetcher()();
    expect(tracks.some((t) => t.name === 'Myth')).toBe(true);
    expect(qualities.length).toBeGreaterThan(100);
  });

  it('Blizzard accepts the credentials and returns realms', async () => {
    const config = readConfig();
    const blizzard = createBlizzardClient({ clientId: config.blizzardClientId, clientSecret: config.blizzardClientSecret });
    expect((await blizzard.getRealms((env.LIVE_TEST_REGION as Region) || 'eu')).length).toBeGreaterThan(10);
  });

  it.runIf(Boolean(env.LIVE_TEST_REALM && env.LIVE_TEST_CHARACTER))('Blizzard returns equipment for the test character', async () => {
    const config = readConfig();
    const blizzard = createBlizzardClient({ clientId: config.blizzardClientId, clientSecret: config.blizzardClientSecret });
    const gear = await blizzard.getEquipment({
      region: (env.LIVE_TEST_REGION as Region) || 'eu', realmSlug: env.LIVE_TEST_REALM!, name: env.LIVE_TEST_CHARACTER!,
    });
    expect(gear.length).toBeGreaterThan(5);
  });

  it('this season’s dungeons still join to Encounter Journal loot by map ID', async () => {
    const config = readConfig();
    const blizzard = createBlizzardClient({ clientId: config.blizzardClientId, clientSecret: config.blizzardClientSecret });
    const season = await fetchMainSeason(fetch, Date.now());
    const data = await loadSeasonLoot(blizzard, (env.LIVE_TEST_REGION as Region) || 'eu', season);
    expect(data.dungeons).toHaveLength(season.dungeons.length);
    expect(data.loot.length).toBeGreaterThan(50);
    expect(data.loot.some((l) => l.armorType !== null)).toBe(true);
    const keys = data.loot.map((l) => `${l.challengeModeId}/${l.encounterId}/${l.itemId}`);
    expect(new Set(keys).size).toBe(keys.length);
  }, 180_000);
});
