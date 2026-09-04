import { getD1 } from '@/db';

const COOKIE_NAME = 'incognito_session';
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 180;

type SessionRow = {
  user_id: string;
  status: string;
  expires_at: number;
  last_used_at: number;
};

export type AnonymousSession = {
  userId: string;
  setCookie?: string;
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

function serializeCookie(token: string, request: Request): string {
  const secure = new URL(request.url).protocol === 'https:' ? '; Secure' : '';
  return `${COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_TTL_SECONDS}${secure}`;
}

export async function ensureAnonymousSession(request: Request): Promise<AnonymousSession> {
  const db = getD1();
  const now = Date.now();
  const token = readCookie(request, COOKIE_NAME);

  if (token) {
    const tokenHash = await hashToken(token);
    const session = await db
      .prepare(
        `SELECT s.user_id, u.status, s.expires_at, s.last_used_at
         FROM anonymous_sessions s
         JOIN anonymous_users u ON u.id = s.user_id
         WHERE s.token_hash = ? AND s.revoked_at IS NULL
         LIMIT 1`,
      )
      .bind(tokenHash)
      .first<SessionRow>();

    if (session && session.expires_at > now && session.status !== 'deleted' && session.status !== 'deletion_pending' && session.status !== 'suspended') {
      if (now - session.last_used_at > 60 * 60 * 1000) {
        await db
          .prepare('UPDATE anonymous_sessions SET last_used_at = ? WHERE token_hash = ?')
          .bind(now, tokenHash)
          .run();
      }
      return { userId: session.user_id };
    }
  }

  const userId = crypto.randomUUID();
  const sessionId = crypto.randomUUID();
  const nextToken = createToken();
  const tokenHash = await hashToken(nextToken);
  const expiresAt = now + SESSION_TTL_SECONDS * 1000;

  await db.batch([
    db
      .prepare('INSERT INTO anonymous_users (id, status, avatar_seed, created_at) VALUES (?, ?, ?, ?)')
      .bind(userId, 'active', crypto.randomUUID(), now),
    db
      .prepare(
        `INSERT INTO anonymous_sessions
         (id, user_id, token_hash, expires_at, created_at, last_used_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .bind(sessionId, userId, tokenHash, expiresAt, now, now),
  ]);

  return { userId, setCookie: serializeCookie(nextToken, request) };
}

export function applySessionCookie(response: Response, session: AnonymousSession): Response {
  if (session.setCookie) response.headers.append('Set-Cookie', session.setCookie);
  return response;
}

export async function revokeSessionForRequest(request: Request): Promise<boolean> {
  const token = readCookie(request, COOKIE_NAME);
  if (!token) return false;
  const tokenHash = await hashToken(token);
  const result = await getD1()
    .prepare('UPDATE anonymous_sessions SET revoked_at = ? WHERE token_hash = ? AND revoked_at IS NULL')
    .bind(Date.now(), tokenHash)
    .run();
  return result.meta.changes > 0;
}

export async function currentSessionIdForRequest(request: Request): Promise<string | null> {
  const token = readCookie(request, COOKIE_NAME);
  if (!token) return null;
  const tokenHash = await hashToken(token);
  const session = await getD1()
    .prepare('SELECT id FROM anonymous_sessions WHERE token_hash = ? AND revoked_at IS NULL LIMIT 1')
    .bind(tokenHash)
    .first<{ id: string }>();
  return session?.id ?? null;
}

export function clearSessionCookie(request: Request): string {
  const secure = new URL(request.url).protocol === 'https:' ? '; Secure' : '';
  return `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`;
}
