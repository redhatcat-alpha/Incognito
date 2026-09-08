#!/usr/bin/env node
/** Apply checked-in migrations to SQLite, PostgreSQL, or MySQL. */
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

const driver = (process.env.DATABASE_DRIVER ?? 'sqlite').toLowerCase();
const url = process.env.DATABASE_URL || 'data/incognito.sqlite';
const migrationDir = join(process.cwd(), 'drizzle');
const files = readdirSync(migrationDir).filter((file) => /^\d{4}_.*\.sql$/.test(file)).sort();

function statements(source) {
  return source
    .split('--> statement-breakpoint')
    .map((statement) => statement.trim())
    .filter((statement) => statement && !/^PRAGMA\b/i.test(statement));
}

function translate(source) {
  if (driver === 'postgres') return source.replaceAll('`', '');
  return source
    .replace(/`([^`]+)` text PRIMARY KEY/gi, '`$1` varchar(255) PRIMARY KEY')
    .replace(/`(id|user_id|post_id|board_id|target_id|public_id|quote_reply_id|token_hash|phrase_hash|slug|username|status|level|scope|action|target_type)` text/gi, '`$1` varchar(255)')
    .replace(/`(title|name|description|icon|accent|color)` text/gi, '`$1` varchar(500)')
    .replace(/`(body|settings_json|metadata_json)` text/gi, '`$1` longtext')
    .replace(/`([^`]+)` text/gi, '`$1` longtext');
}

if (driver === 'sqlite') {
  const path = resolve(url);
  mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path, { timeout: 5000 });
  db.exec('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;');
  db.exec('CREATE TABLE IF NOT EXISTS _incognito_migrations (name TEXT PRIMARY KEY NOT NULL, applied_at INTEGER NOT NULL)');
  for (const file of files) {
    if (db.prepare('SELECT name FROM _incognito_migrations WHERE name = ?').get(file)) continue;
    db.exec('BEGIN IMMEDIATE');
    try {
      for (const statement of statements(readFileSync(join(migrationDir, file), 'utf8'))) db.exec(statement);
      db.prepare('INSERT INTO _incognito_migrations (name, applied_at) VALUES (?, ?)').run(file, Date.now());
      db.exec('COMMIT');
      console.log(`applied ${file}`);
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
  }
  process.exit(0);
}

if (!['postgres', 'mysql'].includes(driver) || !process.env.DATABASE_URL) throw new Error('DATABASE_DRIVER and DATABASE_URL are required for PostgreSQL/MySQL');
let client;
if (driver === 'postgres') {
  const module = await import('postgres');
  client = module.default(process.env.DATABASE_URL);
  await client.unsafe('CREATE TABLE IF NOT EXISTS incognito_schema_migrations (id varchar(255) PRIMARY KEY, applied_at bigint NOT NULL)');
} else {
  const module = await import('mysql2/promise');
  client = await module.createConnection(process.env.DATABASE_URL);
  await client.execute('CREATE TABLE IF NOT EXISTS incognito_schema_migrations (id varchar(255) PRIMARY KEY, applied_at BIGINT NOT NULL)');
}

async function query(sql, values = []) {
  if (driver === 'postgres') {
    let index = 0;
    return client.unsafe(sql.replaceAll('?', () => `$${++index}`), values);
  }
  const [rows] = await client.execute(sql, values);
  return rows;
}

for (const file of files) {
  const applied = await query('SELECT id FROM incognito_schema_migrations WHERE id = ?', [file]);
  if (applied.length) continue;
  if (driver === 'postgres') await client.unsafe('BEGIN');
  else await client.beginTransaction();
  try {
    for (const statement of statements(translate(readFileSync(join(migrationDir, file), 'utf8')))) await query(statement);
    await query('INSERT INTO incognito_schema_migrations (id, applied_at) VALUES (?, ?)', [file, Date.now()]);
    if (driver === 'postgres') await client.unsafe('COMMIT');
    else await client.commit();
    console.log(`applied ${file}`);
  } catch (error) {
    if (driver === 'postgres') await client.unsafe('ROLLBACK');
    else await client.rollback();
    throw error;
  }
}
await client.end();
