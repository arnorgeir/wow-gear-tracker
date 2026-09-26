export class MissingConfigError extends Error {
  constructor(public readonly missing: string[]) {
    super(`Missing settings in .env: ${missing.join(', ')}`);
    this.name = 'MissingConfigError';
  }
}

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
