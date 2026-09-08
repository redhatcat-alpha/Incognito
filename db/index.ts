import { mkdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { createPortableDatabase, SqliteNodeAdapter, type PortableDatabase, type SqlDriver } from './portable';

const nodeEnv = () => process.env;

function configuredDriver(): SqlDriver {
  const value = nodeEnv().DATABASE_DRIVER?.toLowerCase();
  if (value === 'postgres' || value === 'postgresql') return 'postgres';
  if (value === 'mysql' || value === 'mysql2') return 'mysql';
  return 'sqlite';
}

function sqlitePath(): string {
  return resolve(nodeEnv().DATABASE_URL || nodeEnv().DATABASE_PATH || 'data/incognito.sqlite');
}

function applySqliteMigrations(db: DatabaseSync): void {
  db.exec('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;');
  db.exec('CREATE TABLE IF NOT EXISTS _incognito_migrations (name TEXT PRIMARY KEY NOT NULL, applied_at INTEGER NOT NULL)');
  const migrationDir = resolve(process.cwd(), 'drizzle');
  const files = requireMigrationFiles(migrationDir);
  const applied = new Set(
    (db.prepare('SELECT name FROM _incognito_migrations').all() as Array<{ name: string }>).map((row) => row.name),
  );
  for (const file of files) {
    if (applied.has(file)) continue;
    const sql = readFileSync(join(migrationDir, file), 'utf8');
    db.exec(sql.replaceAll('--> statement-breakpoint', ';'));
    db.prepare('INSERT INTO _incognito_migrations (name, applied_at) VALUES (?, ?)').run(file, Date.now());
  }
}

function requireMigrationFiles(directory: string): string[] {
  // Keep startup independent from a directory listing polyfill in the bundle.
  const files = ['0000_futuristic_blockbuster.sql', '0001_aspiring_ink.sql', '0002_yellow_salo.sql', '0003_tense_morgan_stark.sql', '0004_long_harpoon.sql', '0005_grey_layla_miller.sql', '0006_workable_black_crow.sql', '0007_anon_recovery.sql', '0008_safe_kate_bishop.sql', '0009_strong_nekra.sql', '0010_optimal_wong.sql', '0011_ancient_squadron_supreme.sql'];
  return files.filter((file) => {
    try {
      readFileSync(join(directory, file));
      return true;
    } catch {
      return false;
    }
  });
}

let database: PortableDatabase | undefined;

export function getD1(): PortableDatabase {
  if (database) return database;
  const driver = configuredDriver();
  if (driver === 'sqlite') {
    const path = sqlitePath();
    mkdirSync(dirname(path), { recursive: true });
    const sqlite = new DatabaseSync(path, { timeout: 5000 });
    applySqliteMigrations(sqlite);
    database = new SqliteNodeAdapter(sqlite);
    return database;
  }
  database = createPortableDatabase(driver, nodeEnv().DATABASE_URL);
  return database;
}

export function getDb(): never {
  throw new Error('Drizzle database access is not available; use getD1()');
}
