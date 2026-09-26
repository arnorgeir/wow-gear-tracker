import { describe, expect, it } from 'vitest';
import { MissingConfigError, readConfig } from './config';

describe('readConfig', () => {
  it('reads credentials and defaults the database URL', () => {
    const config = readConfig({ BLIZZARD_CLIENT_ID: ' id ', BLIZZARD_CLIENT_SECRET: 'secret' });
    expect(config).toEqual({ blizzardClientId: 'id', blizzardClientSecret: 'secret', databaseUrl: 'file:data/app.db' });
  });

  it('uses DATABASE_URL when set', () => {
    const config = readConfig({ BLIZZARD_CLIENT_ID: 'id', BLIZZARD_CLIENT_SECRET: 's', DATABASE_URL: 'file:other.db' });
    expect(config.databaseUrl).toBe('file:other.db');
  });

  it('lists every missing setting', () => {
    try {
      readConfig({ BLIZZARD_CLIENT_ID: '  ' });
      expect.unreachable();
    } catch (err) {
      expect(err).toBeInstanceOf(MissingConfigError);
      expect((err as MissingConfigError).missing).toEqual(['BLIZZARD_CLIENT_ID', 'BLIZZARD_CLIENT_SECRET']);
    }
  });
});
