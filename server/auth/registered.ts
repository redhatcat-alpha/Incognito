import { getD1 } from '@/db';

const COOKIE_NAME = 'incognito_user_session';
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 180;
const PBKDF2_ITERATIONS = 150_000;

export type RegisteredUser = {
  id: string; // 与 anonymous_users 共用 ID 空间的“署名身份行”
  uid: number;
  username: string;
  status: string;
  createdAt: number;
};

function readCookie(request: Request, name: string): string | undefined {
  const cookieHeader = request.headers.get('cookie');
  if (!cookieHeader) return undefined;
  for (const part of cookieHeader.split(';')) {
    const [key, ...value] = part.trim().split('=');
    if (key === name) return decodeURIComponent(value.join('='));
  }
  return undefined;
}

function createToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}

async function hashToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function fromBase64(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function derivePassword(password: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
  const keyMaterial = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: salt.buffer as ArrayBuffer, iterations },
    keyMaterial,
    256,
  );
  return new Uint8Array(bits);
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const derived = await derivePassword(password, salt, PBKDF2_ITERATIONS);
  return `pbkdf2$${PBKDF2_ITERATIONS}$${toBase64(salt)}$${toBase64(derived)}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, iterationsText, saltB64, hashB64] = stored.split('$');
  if (scheme !== 'pbkdf2') return false;
  const iterations = Number(iterationsText);
  if (!Number.isFinite(iterations) || iterations < 1) return false;
  try {
    const expected = fromBase64(hashB64);
    const actual = await derivePassword(password, fromBase64(saltB64), iterations);
    if (expected.length !== actual.length) return false;
    let diff = 0;
    for (let i = 0; i < expected.length; i += 1) diff |= expected[i] ^ actual[i];
    return diff === 0;
  } catch {
    return false;
  }
}

function serializeSessionCookie(token: string, request: Request): string {
  const secure = new URL(request.url).protocol === 'https:' ? '; Secure' : '';
  return `${COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_TTL_SECONDS}${secure}`;
}

export function clearUserSessionCookie(request: Request): string {
  const secure = new URL(request.url).protocol === 'https:' ? '; Secure' : '';
  return `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`;
}

async function issueSession(userId: string, request: Request): Promise<{ sessionId: string; setCookie: string }> {
  const token = createToken();
  const tokenHash = await hashToken(token);
  const now = Date.now();
  const expiresAt = now + SESSION_TTL_SECONDS * 1000;
  const sessionId = crypto.randomUUID();
  await getD1()
    .prepare(
      `INSERT INTO registered_sessions (id, user_id, token_hash, expires_at, created_at, last_used_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .bind(sessionId, userId, tokenHash, expiresAt, now, now)
    .run();
  return { sessionId, setCookie: serializeSessionCookie(token, request) };
}

/** 读取当前注册会话；无效/不存在返回 null（不自动创建）。 */
export async function getRegisteredUser(request: Request): Promise<RegisteredUser | null> {
  const token = readCookie(request, COOKIE_NAME);
  if (!token) return null;
  const tokenHash = await hashToken(token);
  const row = await getD1()
    .prepare(
      `SELECT u.id, u.uid, u.username, u.status, u.created_at
       FROM registered_sessions s
       JOIN registered_users u ON u.id = s.user_id
       WHERE s.token_hash = ? AND s.revoked_at IS NULL AND s.expires_at > ?
       LIMIT 1`,
    )
    .bind(tokenHash, Date.now())
    .first<{ id: string; uid: number; username: string; status: string; created_at: number }>();
  if (!row) return null;
  return { id: row.id, uid: row.uid, username: row.username, status: row.status, createdAt: row.created_at };
}

/** 注册会话同时“自动续期”最近使用时间（每小时至多一次）。 */
export async function touchRegisteredSession(request: Request): Promise<void> {
  const token = readCookie(request, COOKIE_NAME);
  if (!token) return;
  const tokenHash = await hashToken(token);
  const now = Date.now();
  await getD1()
    .prepare('UPDATE registered_sessions SET last_used_at = ? WHERE token_hash = ? AND last_used_at < ?')
    .bind(now, tokenHash, now - 60 * 60 * 1000)
    .run();
}

export async function registerUser(
  username: string,
  password: string,
  request: Request,
): Promise<{ user: RegisteredUser; setCookie: string }> {
  const db = getD1();
  const existing = await db.prepare('SELECT id FROM registered_users WHERE username = ? LIMIT 1').bind(username).first();
  if (existing) throw new Error('USERNAME_TAKEN');

  const id = crypto.randomUUID();
  const createdAt = Date.now();
  const passHash = await hashPassword(password);

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const uidRow = await db
      .prepare('SELECT COALESCE(MAX(uid), 0) + 1 AS next_uid FROM registered_users')
      .first<{ next_uid: number }>();
    const uid = Number(uidRow?.next_uid ?? 1);
    try {
      await db.batch([
        db.prepare("INSERT INTO anonymous_users (id, status, avatar_seed, created_at) VALUES (?, 'active', ?, ?)").bind(id, '', createdAt),
        db
          .prepare("INSERT INTO registered_users (id, uid, username, pass_hash, status, created_at) VALUES (?, ?, ?, ?, 'active', ?)")
          .bind(id, uid, username, passHash, createdAt),
      ]);
      const session = await issueSession(id, request);
      return { user: { id, uid, username, status: 'active', createdAt }, ...session };
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : '';
      if (message.includes('registered_users.username')) throw new Error('USERNAME_TAKEN');
      if (message.includes('registered_users.uid')) continue; // uid 并发冲突，重试
      throw cause;
    }
  }
  throw new Error('INTERNAL_ERROR');
}

export async function loginUser(
  username: string,
  password: string,
  request: Request,
): Promise<{ user: RegisteredUser; setCookie: string }> {
  const row = await getD1()
    .prepare('SELECT id, uid, username, pass_hash, status, created_at FROM registered_users WHERE username = ? LIMIT 1')
    .bind(username)
    .first<{ id: string; uid: number; username: string; pass_hash: string; status: string; created_at: number }>();
  if (!row || !(await verifyPassword(password, row.pass_hash))) throw new Error('INVALID_CREDENTIALS');
  if (row.status !== 'active') throw new Error('ACCOUNT_SUSPENDED');
  const session = await issueSession(row.id, request);
  return {
    user: { id: row.id, uid: row.uid, username: row.username, status: row.status, createdAt: row.created_at },
    ...session,
  };
}

export async function logoutUser(request: Request): Promise<boolean> {
  const token = readCookie(request, COOKIE_NAME);
  if (!token) return false;
  const tokenHash = await hashToken(token);
  const result = await getD1()
    .prepare('UPDATE registered_sessions SET revoked_at = ? WHERE token_hash = ? AND revoked_at IS NULL')
    .bind(Date.now(), tokenHash)
    .run();
  return result.meta.changes > 0;
}

/** 注册用户可用的“署名身份行”ID，即其所有公开内容的 author_id。 */
export async function registeredAnonId(request: Request): Promise<string | null> {
  const user = await getRegisteredUser(request);
  return user?.id ?? null;
}
