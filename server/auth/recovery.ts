import { getD1 } from '@/db';
import { createSessionForUser, type AnonymousSession } from '@/server/auth/anonymous';

const WORDS = ['云','杉','潮','灯','桥','雾','星','石','风','禾','舟','松','雨','岚','川','月','鹿','海','麦','野','竹','岛','钟','叶','湖','阳','砂','鹭','林','虹','溪','原'];

async function hashPhrase(phrase: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(phrase.trim().replaceAll(/\s+/g, ' ')));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function createRecoveryPhrase(userId: string) {
  const values = crypto.getRandomValues(new Uint32Array(6));
  const phrase = Array.from(values, (value) => WORDS[value % WORDS.length]).join(' ');
  const hash = await hashPhrase(phrase);
  const db = getD1();
  const now = Date.now();
  await db.batch([
    db.prepare('UPDATE anonymous_recoveries SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL').bind(now, userId),
    db.prepare('INSERT INTO anonymous_recoveries (id, user_id, phrase_hash, created_at) VALUES (?, ?, ?, ?)').bind(crypto.randomUUID(), userId, hash, now),
  ]);
  return { phrase, createdAt: now };
}

export async function recoverSession(phrase: string, request: Request): Promise<AnonymousSession> {
  const hash = await hashPhrase(phrase);
  const row = await getD1().prepare("SELECT r.user_id FROM anonymous_recoveries r JOIN anonymous_users u ON u.id = r.user_id WHERE r.phrase_hash = ? AND r.revoked_at IS NULL AND u.status = 'active' LIMIT 1").bind(hash).first<{ user_id: string }>();
  if (!row) throw new Error('RECOVERY_PHRASE_INVALID');
  return createSessionForUser(row.user_id, request);
}
