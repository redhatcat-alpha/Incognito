#!/usr/bin/env node
/** Exercise the write invariants that must be identical on PostgreSQL/MySQL. */
import { randomUUID } from 'node:crypto';

const driver = (process.env.DATABASE_DRIVER ?? '').toLowerCase();
const url = process.env.DATABASE_URL;
if (!url || !['postgres', 'mysql'].includes(driver)) throw new Error('DATABASE_DRIVER and DATABASE_URL are required');

const suffix = randomUUID();
const userId = `behavior-user-${suffix}`;
const boardId = `behavior-board-${suffix}`;
const postId = `behavior-post-${suffix}`;
const postPublicId = `behavior-public-${suffix}`;
const now = Date.now();

function pgPlaceholders(query) {
  let index = 0;
  return query.replaceAll('?', () => `$${++index}`);
}

async function createClient() {
  if (driver === 'postgres') {
    const module = await import('postgres');
    return { kind: 'postgres', client: module.default(url, { max: 1 }) };
  }
  const module = await import('mysql2/promise');
  return { kind: 'mysql', client: await module.createConnection(url) };
}

async function execute(connection, query, values = []) {
  if (connection.kind === 'postgres') return connection.client.unsafe(pgPlaceholders(query), values);
  const [rows] = await connection.client.execute(query, values);
  return rows;
}

async function close(connection) {
  await connection.client.end();
}

const setup = await createClient();
await execute(setup, 'INSERT INTO anonymous_users (id, status, avatar_seed, created_at) VALUES (?, ?, ?, ?)', [userId, 'active', suffix, now]);
await execute(setup, 'INSERT INTO boards (id, slug, name, description, icon, accent, status, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [boardId, `behavior-${suffix}`, 'behavior', 'behavior', 'message-circle', '#d9ff57', 'active', 0, now, now]);
await execute(setup, 'INSERT INTO posts (id, public_id, board_id, author_id, title, body, status, next_floor_no, up_count, down_count, reply_count, created_at, updated_at, last_replied_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [postId, postPublicId, boardId, userId, 'behavior', 'behavior', 'published', 2, 0, 0, 0, now, now, now]);
await close(setup);

async function allocateFloor(index) {
  const connection = await createClient();
  const timestamp = now + index;
  const replyId = `behavior-reply-${suffix}-${index}`;
  const publicId = `behavior-reply-public-${suffix}-${index}`;
  try {
    let floor;
    if (connection.kind === 'postgres') {
      await connection.client.begin(async (tx) => {
        await tx.unsafe('UPDATE posts SET next_floor_no = next_floor_no + 1, reply_count = reply_count + 1, last_replied_at = $1, updated_at = $1 WHERE id = $2 AND status = \'published\'', [timestamp, postId]);
        const rows = await tx.unsafe('SELECT next_floor_no - 1 AS floor_no FROM posts WHERE id = $1', [postId]);
        floor = Number(rows[0]?.floor_no);
        await tx.unsafe('INSERT INTO replies (id, public_id, post_id, author_id, floor_no, body, quote_reply_id, status, up_count, down_count, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, NULL, \'published\', 0, 0, $7, $7)', [replyId, publicId, postId, userId, floor, `behavior-${index}`, timestamp]);
      });
    } else {
      await connection.client.beginTransaction();
      await execute(connection, "UPDATE posts SET next_floor_no = next_floor_no + 1, reply_count = reply_count + 1, last_replied_at = ?, updated_at = ? WHERE id = ? AND status = 'published'", [timestamp, timestamp, postId]);
      const rows = await execute(connection, 'SELECT next_floor_no - 1 AS floor_no FROM posts WHERE id = ?', [postId]);
      floor = Number(rows[0]?.floor_no);
      await execute(connection, "INSERT INTO replies (id, public_id, post_id, author_id, floor_no, body, quote_reply_id, status, up_count, down_count, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, NULL, 'published', 0, 0, ?, ?)", [replyId, publicId, postId, userId, floor, `behavior-${index}`, timestamp, timestamp]);
      await connection.client.commit();
    }
    return floor;
  } catch (error) {
    if (connection.kind === 'mysql') await connection.client.rollback().catch(() => undefined);
    throw error;
  } finally {
    await close(connection);
  }
}

const floors = await Promise.all(Array.from({ length: 12 }, (_, index) => allocateFloor(index)));
const sorted = floors.toSorted((a, b) => a - b);
const expected = Array.from({ length: floors.length }, (_, index) => index + 2);
if (JSON.stringify(sorted) !== JSON.stringify(expected)) throw new Error(`floor allocation mismatch: ${sorted.join(',')}`);

const verify = await createClient();
const rows = await execute(verify, 'SELECT next_floor_no, reply_count FROM posts WHERE id = ?', [postId]);
if (Number(rows[0]?.next_floor_no) !== floors.length + 2 || Number(rows[0]?.reply_count) !== floors.length) throw new Error('post counters mismatch');
await execute(verify, 'DELETE FROM replies WHERE post_id = ?', [postId]);
await execute(verify, 'DELETE FROM posts WHERE id = ?', [postId]);
await execute(verify, 'DELETE FROM boards WHERE id = ?', [boardId]);
await execute(verify, 'DELETE FROM anonymous_users WHERE id = ?', [userId]);
await close(verify);
console.log(`database behavior ok: ${driver}, ${floors.length} concurrent floors`);
