import { env } from 'cloudflare:workers';
import { drizzle } from 'drizzle-orm/d1';
import * as schema from './schema';
import { createPortableDatabase, type PortableDatabase, type SqlDriver } from './portable';

const nodeEnv = () => (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env ?? {};

function configuredDriver(): SqlDriver {
  const value = nodeEnv().DATABASE_DRIVER?.toLowerCase();
  if (value === 'postgres' || value === 'postgresql') return 'postgres';
  if (value === 'mysql' || value === 'mysql2') return 'mysql';
  return 'sqlite';
}

export function getDb() {
  if (!env.DB) {
    throw new Error(
      'Cloudflare D1 binding `DB` is unavailable. Set the `d1` field in .openai/hosting.json to `DB` or let your control plane inject the real binding values before using the database.',
    );
  }

  return drizzle(env.DB, { schema });
}

export function getD1(): PortableDatabase {
  const databaseUrl = nodeEnv().DATABASE_URL;
  if (env.DB) return createPortableDatabase(env.DB, 'sqlite');
  return createPortableDatabase(undefined, configuredDriver(), databaseUrl);
}
