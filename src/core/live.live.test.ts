import { describe, expect, it } from 'vitest';
import { createBlizzardClient } from './blizzard/client';
import { readConfig } from './config';
import { createMethodSource } from './method/method';
import { createRaidbotsTracksFetcher } from './raidbots/tracks';
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
    const tracks = await createRaidbotsTracksFetcher()();
    expect(tracks.some((t) => t.name === 'Myth')).toBe(true);
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
});
