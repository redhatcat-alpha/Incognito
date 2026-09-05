import { getD1 } from '@/db';
import { tiebaEmojiIds, tiebaEmojis } from '@/lib/tieba-emojis';

let schemaReady: Promise<void> | null = null;

async function ensureSchema() {
  if (!schemaReady) {
    const db = getD1();
    schemaReady = db.batch([
      db.prepare('CREATE TABLE IF NOT EXISTS emoji_settings (emoji_id INTEGER PRIMARY KEY NOT NULL, status TEXT NOT NULL DEFAULT \'active\', updated_at INTEGER NOT NULL)'),
      db.prepare('CREATE INDEX IF NOT EXISTS idx_emoji_settings_status ON emoji_settings(status)'),
    ]).then(() => undefined).catch((error) => { schemaReady = null; throw error; });
  }
  await schemaReady;
}

export async function listEmojiSettings() {
  await ensureSchema();
  const rows = await getD1().prepare('SELECT emoji_id, status, updated_at FROM emoji_settings').all<{ emoji_id: number; status: string; updated_at: number }>();
  const statusById = new Map(rows.results.map((row) => [row.emoji_id, row]));
  return tiebaEmojis.map((emoji) => ({
    ...emoji,
    status: statusById.get(emoji.id)?.status === 'hidden' ? 'hidden' : 'active',
    updatedAt: statusById.get(emoji.id)?.updated_at ?? null,
  }));
}

export async function listActiveEmojiIds(): Promise<number[]> {
  const settings = await listEmojiSettings();
  return settings.filter((emoji) => emoji.status === 'active').map((emoji) => emoji.id);
}

export async function updateEmojiSetting(emojiId: number, status: 'active' | 'hidden') {
  if (!tiebaEmojiIds.includes(emojiId)) throw new Error('EMOJI_NOT_FOUND');
  await ensureSchema();
  const db = getD1();
  const now = Date.now();
  await db.batch([
    db.prepare('DELETE FROM emoji_settings WHERE emoji_id = ?').bind(emojiId),
    db.prepare('INSERT INTO emoji_settings (emoji_id, status, updated_at) VALUES (?, ?, ?)').bind(emojiId, status, now),
  ]);
  return { id: emojiId, status, updatedAt: now };
}
