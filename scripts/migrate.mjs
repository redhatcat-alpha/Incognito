#!/usr/bin/env node
/** Apply the checked-in migrations to a selected Node SQL database. */
import { readFile } from 'node:fs/promises';
import { readdir } from 'node:fs/promises';
import { join } from 'node:path';

const driver = (process.env.DATABASE_DRIVER ?? 'sqlite').toLowerCase();
const url = process.env.DATABASE_URL;
if (driver === 'sqlite') {
  console.error('SQLite/D1 migrations are applied with Wrangler; set DATABASE_DRIVER=postgres or mysql for this command.');
  process.exit(1);
}
if (!url) throw new Error('DATABASE_URL is required');

function statements(source) {
  return source
    .split('--> statement-breakpoint')
    .map((statement) => statement.trim())
    .filter((statement) => statement && !/^PRAGMA\b/i.test(statement));
}

function translate(source) {
  if (driver === 'postgres') {
    return source
      .replaceAll('`', '')
      .replace(/\b(integer|text)\b/g, (type) => type.toLowerCase() === 'text' ? 'text' : 'integer');
  }
  return source
    .replace(/`([^`]+)` text PRIMARY KEY/gi, '`$1` varchar(255) PRIMARY KEY')
    .replace(/`(id|user_id|post_id|board_id|target_id|public_id|quote_reply_id|token_hash|phrase_hash|slug|username|status|level|scope|action|target_type)` text/gi, '`$1` varchar(255)')
    .replace(/`(title|name|description|icon|accent|color)` text/gi, '`$1` varchar(500)')
    .replace(/`(body|settings_json|metadata_json)` text/gi, '`$1` longtext')
    .replace(/`([^`]+)` text/gi, '`$1` longtext');
}

const migrationDir = join(process.cwd(), 'drizzle');
const files = (await readdir(migrationDir)).filter((file) => /^\d{4}_.*\.sql$/.test(file)).sort();
let client;
if (driver === 'postgres') {
  const module = await import('postgres');
  client = module.default(url);
  await client.unsafe('CREATE TABLE IF NOT EXISTS incognito_schema_migrations (id varchar(255) PRIMARY KEY, applied_at bigint NOT NULL)');
} else if (driver === 'mysql') {
  const module = await import('mysql2/promise');
  client = await module.createConnection(url);
  await client.execute('CREATE TABLE IF NOT EXISTS incognito_schema_migrations (id varchar(255) PRIMARY KEY, applied_at BIGINT NOT NULL)');
} else {
  throw new Error(`Unsupported DATABASE_DRIVER: ${driver}`);
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
  const source = translate(await readFile(join(migrationDir, file), 'utf8'));
  if (driver === 'postgres') await client.unsafe('BEGIN');
  else await client.beginTransaction();
  try {
    for (const statement of statements(source)) await query(statement);
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

if (driver === 'postgres') await client.end();
else await client.end();
