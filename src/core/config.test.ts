import { describe, expect, it, vi } from 'vitest';
import { isMissingConfigError, MissingConfigError, readConfig } from './config';

describe('isMissingConfigError', () => {
  it('recognizes a MissingConfigError from another copy of the module, where instanceof fails', async () => {
    vi.resetModules();
    const { MissingConfigError: OtherMissingConfigError } = await import('./config');
    const err = new OtherMissingConfigError(['BLIZZARD_CLIENT_ID']);
    expect(err instanceof MissingConfigError).toBe(false);
    expect(isMissingConfigError(err)).toBe(true);
  });

  it('rejects other errors, even one that only borrows the name', () => {
    expect(isMissingConfigError(Object.assign(new Error('x'), { name: 'MissingConfigError', missing: [] }))).toBe(false);
    expect(isMissingConfigError(new Error('x'))).toBe(false);
  });
});

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
