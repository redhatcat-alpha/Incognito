import { getD1 } from '@/db';
import { createSessionForUser, type AnonymousSession } from '@/server/auth/anonymous';

const CHALLENGE_TTL_MS = 5 * 60 * 1000;
let passkeySchemaReady: Promise<void> | null = null;

async function ensurePasskeySchema(): Promise<void> {
  if (!passkeySchemaReady) {
    const db = getD1();
    passkeySchemaReady = db.batch([
      db.prepare(`CREATE TABLE IF NOT EXISTS passkey_challenges (id TEXT PRIMARY KEY NOT NULL, challenge TEXT NOT NULL, user_id TEXT, purpose TEXT NOT NULL, expires_at INTEGER NOT NULL, created_at INTEGER NOT NULL, FOREIGN KEY (user_id) REFERENCES anonymous_users(id))`),
      db.prepare(`CREATE INDEX IF NOT EXISTS idx_passkey_challenge_expiry ON passkey_challenges(expires_at)`),
      db.prepare(`CREATE TABLE IF NOT EXISTS passkey_credentials (id TEXT PRIMARY KEY NOT NULL, user_id TEXT NOT NULL, credential_id TEXT NOT NULL, public_key TEXT NOT NULL, sign_count INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL, last_used_at INTEGER, revoked_at INTEGER, FOREIGN KEY (user_id) REFERENCES anonymous_users(id))`),
      db.prepare(`CREATE UNIQUE INDEX IF NOT EXISTS uq_passkey_credential_id ON passkey_credentials(credential_id)`),
      db.prepare(`CREATE INDEX IF NOT EXISTS idx_passkey_user ON passkey_credentials(user_id)`),
    ]).then(() => undefined).catch((error) => { passkeySchemaReady = null; throw error; });
  }
  await passkeySchemaReady;
}

function encode(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}

function decode(value: string): Uint8Array {
  const normalized = value.replaceAll('-', '+').replaceAll('_', '/') + '='.repeat((4 - (value.length % 4)) % 4);
  const binary = atob(normalized);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

function buffer(bytes: Uint8Array): ArrayBuffer {
  return Uint8Array.from(bytes).buffer;
}

async function sha256(value: BufferSource): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.digest('SHA-256', value));
}

function challengeId(): string { return encode(crypto.getRandomValues(new Uint8Array(32))); }

async function createChallenge(userId: string | null, purpose: 'register' | 'authenticate') {
  await ensurePasskeySchema();
  const id = challengeId();
  const challenge = challengeId();
  const now = Date.now();
  await getD1().batch([
    getD1().prepare('DELETE FROM passkey_challenges WHERE expires_at < ?').bind(now),
    getD1().prepare('INSERT INTO passkey_challenges (id, challenge, user_id, purpose, expires_at, created_at) VALUES (?, ?, ?, ?, ?, ?)').bind(id, challenge, userId, purpose, now + CHALLENGE_TTL_MS, now),
  ]);
  return { challengeId: id, challenge, expiresAt: now + CHALLENGE_TTL_MS };
}

export async function beginPasskeyRegistration(userId: string, request: Request) {
  const challenge = await createChallenge(userId, 'register');
  return { ...challenge, rp: { name: '无名岛匿名论坛', id: new URL(request.url).hostname } };
}

export async function beginPasskeyAuthentication() {
  const challenge = await createChallenge(null, 'authenticate');
  return challenge;
}

function parseClientData(value: string, expectedChallenge: string, type: string, request: Request) {
  let data: { type?: string; challenge?: string; origin?: string };
  try { data = JSON.parse(new TextDecoder().decode(decode(value))) as typeof data; } catch { throw new Error('PASSKEY_CHALLENGE_INVALID'); }
  const expectedOrigin = new URL(request.url).origin;
  if (data.type !== type || data.challenge !== expectedChallenge || data.origin !== expectedOrigin) throw new Error('PASSKEY_CHALLENGE_INVALID');
  return data;
}

export async function verifyPasskeyRegistration(input: {
  challengeId: string;
  credentialId: string;
  publicKey: string;
  clientDataJSON: string;
}, userId: string, request: Request) {
  await ensurePasskeySchema();
  const db = getD1();
  const row = await db.prepare("SELECT challenge, user_id, purpose, expires_at FROM passkey_challenges WHERE id = ? LIMIT 1").bind(input.challengeId).first<{ challenge: string; user_id: string | null; purpose: string; expires_at: number }>();
  if (!row || row.user_id !== userId || row.purpose !== 'register' || row.expires_at < Date.now()) throw new Error('PASSKEY_CHALLENGE_INVALID');
  parseClientData(input.clientDataJSON, row.challenge, 'webauthn.create', request);
  const publicKey = decode(input.publicKey);
  const credentialId = decode(input.credentialId);
  if (publicKey.length < 50 || credentialId.length < 16 || credentialId.length > 1024) throw new Error('PASSKEY_ASSERTION_INVALID');
  await db.batch([
    db.prepare('INSERT INTO passkey_credentials (id, user_id, credential_id, public_key, sign_count, created_at) VALUES (?, ?, ?, ?, 0, ?)').bind(crypto.randomUUID(), userId, input.credentialId, input.publicKey, Date.now()),
    db.prepare('DELETE FROM passkey_challenges WHERE id = ?').bind(input.challengeId),
  ]);
  return { registered: true };
}

export async function verifyPasskeyAuthentication(input: {
  challengeId: string;
  credentialId: string;
  clientDataJSON: string;
  authenticatorData: string;
  signature: string;
}, request: Request): Promise<AnonymousSession> {
  await ensurePasskeySchema();
  const db = getD1();
  const challenge = await db.prepare("SELECT challenge, purpose, expires_at FROM passkey_challenges WHERE id = ? LIMIT 1").bind(input.challengeId).first<{ challenge: string; purpose: string; expires_at: number }>();
  const credential = await db.prepare("SELECT id, user_id, public_key, sign_count FROM passkey_credentials WHERE credential_id = ? AND revoked_at IS NULL LIMIT 1").bind(input.credentialId).first<{ id: string; user_id: string; public_key: string; sign_count: number }>();
  if (!challenge || challenge.purpose !== 'authenticate' || challenge.expires_at < Date.now() || !credential) throw new Error('PASSKEY_CHALLENGE_INVALID');
  parseClientData(input.clientDataJSON, challenge.challenge, 'webauthn.get', request);
  const authenticatorData = decode(input.authenticatorData);
  if (authenticatorData.length < 37 || (authenticatorData[32] & 1) === 0) throw new Error('PASSKEY_ASSERTION_INVALID');
  const rpIdHash = await sha256(new TextEncoder().encode(new URL(request.url).hostname));
  if (rpIdHash.some((byte, index) => byte !== authenticatorData[index])) throw new Error('PASSKEY_ASSERTION_INVALID');
  const signCount = new DataView(buffer(authenticatorData), 33, 4).getUint32(0);
  if (credential.sign_count > 0 && signCount > 0 && signCount <= credential.sign_count) throw new Error('PASSKEY_ASSERTION_INVALID');
  const clientHash = await sha256(buffer(decode(input.clientDataJSON)));
  const signed = new Uint8Array(authenticatorData.length + clientHash.length);
  signed.set(authenticatorData); signed.set(clientHash, authenticatorData.length);
  const key = await crypto.subtle.importKey('spki', buffer(decode(credential.public_key)), { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
  const valid = await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, key, buffer(decode(input.signature)), buffer(signed));
  if (!valid) throw new Error('PASSKEY_ASSERTION_INVALID');
  await db.batch([
    db.prepare('UPDATE passkey_credentials SET sign_count = ?, last_used_at = ? WHERE id = ?').bind(signCount, Date.now(), credential.id),
    db.prepare('DELETE FROM passkey_challenges WHERE id = ?').bind(input.challengeId),
  ]);
  return createSessionForUser(credential.user_id, request);
}
