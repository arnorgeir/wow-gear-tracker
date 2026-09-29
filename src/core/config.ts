import { brand, hasBrand } from './errors';

const MISSING_CONFIG_ERROR = Symbol.for('wow-gear-tracker.MissingConfigError');

export class MissingConfigError extends Error {
  constructor(public readonly missing: string[]) {
    super(`Missing settings in .env: ${missing.join(', ')}`);
    this.name = 'MissingConfigError';
    brand(this, MISSING_CONFIG_ERROR);
  }
}

/** Whether `err` is a MissingConfigError from any copy of this module; see `src/core/errors.ts`. */
export const isMissingConfigError = (err: unknown): err is MissingConfigError => hasBrand(err, MISSING_CONFIG_ERROR);

export interface AppConfig {
  blizzardClientId: string;
  blizzardClientSecret: string;
  databaseUrl: string;
}

export function readConfig(env: Record<string, string | undefined> = process.env): AppConfig {
  const required = ['BLIZZARD_CLIENT_ID', 'BLIZZARD_CLIENT_SECRET'];
  const missing = required.filter((key) => !env[key]?.trim());
  if (missing.length > 0) throw new MissingConfigError(missing);
  return {
    blizzardClientId: env.BLIZZARD_CLIENT_ID!.trim(),
    blizzardClientSecret: env.BLIZZARD_CLIENT_SECRET!.trim(),
    databaseUrl: env.DATABASE_URL?.trim() || 'file:data/app.db',
  };
}
