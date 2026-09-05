#!/usr/bin/env node
import { readdir } from 'node:fs/promises';

const driver = (process.env.DATABASE_DRIVER ?? '').toLowerCase();
const url = process.env.DATABASE_URL;
if (!url || !['postgres', 'mysql'].includes(driver)) throw new Error('DATABASE_DRIVER and DATABASE_URL are required');
const expected = (await readdir(new URL('../drizzle/', import.meta.url))).filter((file) => /^\d{4}_.*\.sql$/.test(file)).length;
let rows;
let client;
if (driver === 'postgres') {
  const module = await import('postgres');
  client = module.default(url);
  rows = await client.unsafe('SELECT COUNT(*)::int AS count FROM incognito_schema_migrations');
} else {
  const module = await import('mysql2/promise');
  client = await module.createConnection(url);
  const [result] = await client.execute('SELECT COUNT(*) AS count FROM incognito_schema_migrations');
  rows = result;
}
const count = Number(rows[0]?.count ?? 0);
if (count !== expected) throw new Error(`migration count mismatch: expected ${expected}, got ${count}`);
console.log(`migration verification ok: ${driver}, ${count} versions`);
await client.end();
