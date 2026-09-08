import assert from 'node:assert/strict';
import test from 'node:test';
import { stripJpegExif, stripPngMetadata, stripWebpMetadata } from '../lib/media.ts';
import { normalizeNodeSql } from '../db/portable.ts';

test('stripJpegExif removes APP1 segments', () => {
  const source = Uint8Array.from([0xff, 0xd8, 0xff, 0xe1, 0, 6, 69, 88, 73, 70, 0xff, 0xd9]);
  assert.deepEqual(Array.from(stripJpegExif(source)), [0xff, 0xd8, 0xff, 0xd9]);
});

test('stripPngMetadata removes textual chunks', () => {
  const signature = [137, 80, 78, 71, 13, 10, 26, 10];
  const text = [0, 0, 0, 4, 116, 69, 88, 116, 97, 98, 99, 100, 0, 0, 0, 0];
  const iend = [0, 0, 0, 0, 73, 69, 78, 68, 174, 66, 96, 130];
  assert.deepEqual(Array.from(stripPngMetadata(Uint8Array.from([...signature, ...text, ...iend]))), [...signature, ...iend]);
});

test('stripWebpMetadata removes EXIF chunk', () => {
  const header = [82, 73, 70, 70, 0, 0, 0, 0, 87, 69, 66, 80];
  const exif = [69, 88, 73, 70, 4, 0, 0, 0, 1, 2, 3, 4];
  const output = stripWebpMetadata(Uint8Array.from([...header, ...exif]));
  assert.equal(output.length, 12);
});

test('normalizes SQLite writes for PostgreSQL', () => {
  const sql = normalizeNodeSql(
    'INSERT OR IGNORE INTO tags (id, slug, name) VALUES (?, ?, ?)',
    'postgres',
  );
  assert.match(sql, /^INSERT INTO tags/);
  assert.match(sql, /ON CONFLICT DO NOTHING$/);
});

test('normalizes scalar MAX and history upsert for PostgreSQL', () => {
  const sql = normalizeNodeSql(
    `INSERT INTO browsing_history (id, user_id, post_id, max_read_floor)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(user_id, post_id) DO UPDATE SET
       max_read_floor = MAX(browsing_history.max_read_floor, excluded.max_read_floor),
       anchor_reply_id = excluded.anchor_reply_id,
       last_viewed_at = excluded.last_viewed_at`,
    'postgres',
  );
  assert.match(sql, /GREATEST\(browsing_history\.max_read_floor, excluded\.max_read_floor\)/);
});

test('normalizes SQLite writes for MySQL', () => {
  const sql = normalizeNodeSql(
    `INSERT OR IGNORE INTO votes (id, user_id, target_type, target_id, value)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(user_id, target_type, target_id)
     DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
    'mysql',
  );
  assert.match(sql, /^INSERT IGNORE INTO votes/);
  assert.match(sql, /ON DUPLICATE KEY UPDATE value = VALUES\(value\), updated_at = VALUES\(updated_at\)$/);
});

test('normalizes history upsert for MySQL', () => {
  const sql = normalizeNodeSql(
    `INSERT INTO browsing_history (id, user_id, post_id, max_read_floor)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(user_id, post_id) DO UPDATE SET
       max_read_floor = MAX(browsing_history.max_read_floor, excluded.max_read_floor),
       anchor_reply_id = excluded.anchor_reply_id,
       last_viewed_at = excluded.last_viewed_at`,
    'mysql',
  );
  assert.match(sql, /ON DUPLICATE KEY UPDATE max_read_floor = GREATEST\(max_read_floor, VALUES\(max_read_floor\)/);
});
