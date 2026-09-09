#!/usr/bin/env node
/** Idempotently create the first administrator without seeding forum content. */
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { pbkdf2Sync, randomBytes, randomUUID } from 'node:crypto';

const driverName = (process.env.DATABASE_DRIVER ?? 'sqlite').toLowerCase();
const driver = driverName === 'postgresql' ? 'postgres' : driverName === 'mysql2' ? 'mysql' : driverName;
const databaseUrl = process.env.DATABASE_URL || 'data/incognito.sqlite';
const username = (process.env.ADMIN_USERNAME || 'admin').trim();
const password = process.env.ADMIN_PASSWORD || 'admin123';

if (!['sqlite', 'postgres', 'mysql'].includes(driver)) throw new Error(`Unsupported DATABASE_DRIVER: ${driverName}`);
if (!username) throw new Error('ADMIN_USERNAME must not be empty');
if (!password) throw new Error('ADMIN_PASSWORD must not be empty');

function hashPassword(value) {
  const iterations = 150_000;
  const salt = randomBytes(16);
  const derived = pbkdf2Sync(value, salt, iterations, 32, 'sha256');
  return `pbkdf2$${iterations}$${salt.toString('base64')}$${derived.toString('base64')}`;
}

const passHash = hashPassword(password);

if (driver === 'sqlite') {
  const path = resolve(databaseUrl);
  mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path, { timeout: 5000 });
  const existing = db.prepare('SELECT id FROM admin_users WHERE username = ? LIMIT 1').get(username);
  if (existing) {
    console.log(`admin already exists: ${username}`);
    process.exit(0);
  }
  db.prepare(
    "INSERT INTO admin_users (id, username, pass_hash, role, status, created_at) VALUES (?, ?, ?, 'super_admin', 'active', ?)",
  ).run(randomUUID(), username, passHash, Date.now());
  console.log(`admin initialized: ${username}`);
  process.exit(0);
}

if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required for PostgreSQL/MySQL');

if (driver === 'postgres') {
  const postgres = (await import('postgres')).default;
  const client = postgres(process.env.DATABASE_URL);
  try {
    const rows = await client`SELECT id FROM admin_users WHERE username = ${username} LIMIT 1`;
    if (rows.length) {
      console.log(`admin already exists: ${username}`);
    } else {
      await client`
        INSERT INTO admin_users (id, username, pass_hash, role, status, created_at)
        VALUES (${randomUUID()}, ${username}, ${passHash}, 'super_admin', 'active', ${Date.now()})
      `;
      console.log(`admin initialized: ${username}`);
    }
  } finally {
    await client.end();
  }
} else {
  const mysql = await import('mysql2/promise');
  const client = await mysql.createConnection(process.env.DATABASE_URL);
  try {
    const [rows] = await client.execute('SELECT id FROM admin_users WHERE username = ? LIMIT 1', [username]);
    if (rows.length) {
      console.log(`admin already exists: ${username}`);
    } else {
      await client.execute(
        "INSERT INTO admin_users (id, username, pass_hash, role, status, created_at) VALUES (?, ?, ?, 'super_admin', 'active', ?)",
        [randomUUID(), username, passHash, Date.now()],
      );
      console.log(`admin initialized: ${username}`);
    }
  } finally {
    await client.end();
  }
}
