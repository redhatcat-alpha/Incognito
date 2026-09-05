import { getD1 } from '@/db';
import { hashPassword, verifyPassword } from '@/server/auth/registered';

const COOKIE_NAME = 'incognito_admin_session';
const SESSION_TTL_SECONDS = 60 * 60 * 12;

export type AdminUser = {
  id: string;
  username: string;
  role: string;
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

function serializeCookie(token: string, request: Request): string {
  const secure = new URL(request.url).protocol === 'https:' ? '; Secure' : '';
  return `${COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_TTL_SECONDS}${secure}`;
}

export function clearAdminCookie(request: Request): string {
  const secure = new URL(request.url).protocol === 'https:' ? '; Secure' : '';
  return `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`;
}

const DEFAULT_SUPER_ADMIN = { username: 'admin', password: 'admin123' };

/**
 * 确保默认超级管理员存在（幂等）。只在首次建库/缺账号时写入，
 * 密码以 PBKDF2 哈希存储；上线后应立即修改默认密码。
 */
export async function ensureAdminSeed(): Promise<void> {
  const db = getD1();
  const existing = await db
    .prepare("SELECT id FROM admin_users WHERE username = ? LIMIT 1")
    .bind(DEFAULT_SUPER_ADMIN.username)
    .first();
  if (existing) return;
  const passHash = await hashPassword(DEFAULT_SUPER_ADMIN.password);
  await db
    .prepare("INSERT INTO admin_users (id, username, pass_hash, role, status, created_at) VALUES (?, ?, ?, 'super_admin', 'active', ?)")
    .bind(crypto.randomUUID(), DEFAULT_SUPER_ADMIN.username, passHash, Date.now())
    .run();
}

export async function loginAdmin(
  username: string,
  password: string,
  request: Request,
): Promise<{ user: AdminUser; setCookie: string }> {
  const db = getD1();
  await ensureAdminSeed();
  const row = await db
    .prepare('SELECT id, username, pass_hash, role, status, created_at FROM admin_users WHERE username = ? LIMIT 1')
    .bind(username)
    .first<{ id: string; username: string; pass_hash: string; role: string; status: string; created_at: number }>();
  if (!row || !(await verifyPassword(password, row.pass_hash))) throw new Error('INVALID_CREDENTIALS');
  if (row.status !== 'active') throw new Error('ACCOUNT_SUSPENDED');

  const token = createToken();
  const tokenHash = await hashToken(token);
  const now = Date.now();
  await db
    .prepare(
      `INSERT INTO admin_sessions (id, user_id, token_hash, expires_at, created_at, last_used_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .bind(crypto.randomUUID(), row.id, tokenHash, now + SESSION_TTL_SECONDS * 1000, now, now)
    .run();
  return {
    user: { id: row.id, username: row.username, role: row.role, status: row.status, createdAt: row.created_at },
    setCookie: serializeCookie(token, request),
  };
}

export async function getAdminUser(request: Request): Promise<AdminUser | null> {
  const token = readCookie(request, COOKIE_NAME);
  if (!token) return null;
  const tokenHash = await hashToken(token);
  const row = await getD1()
    .prepare(
      `SELECT u.id, u.username, u.role, u.status, u.created_at
       FROM admin_sessions s
       JOIN admin_users u ON u.id = s.user_id
       WHERE s.token_hash = ? AND s.revoked_at IS NULL AND s.expires_at > ?
       LIMIT 1`,
    )
    .bind(tokenHash, Date.now())
    .first<{ id: string; username: string; role: string; status: string; created_at: number }>();
  if (!row) return null;
  return { id: row.id, username: row.username, role: row.role, status: row.status, createdAt: row.created_at };
}

export async function recordAdminAudit(input: {
  adminUserId: string;
  action: string;
  targetType?: string;
  targetId?: string;
  metadata?: Record<string, string | number | boolean | null>;
}): Promise<void> {
  await getD1()
    .prepare(
      `INSERT INTO admin_audit_logs
       (id, admin_user_id, action, target_type, target_id, metadata_json, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      crypto.randomUUID(),
      input.adminUserId,
      input.action,
      input.targetType ?? null,
      input.targetId ?? null,
      input.metadata ? JSON.stringify(input.metadata) : null,
      Date.now(),
    )
    .run();
}

export async function listAdminAuditLogs(limit = 100) {
  const rows = await getD1()
    .prepare(
      `SELECT l.id, l.action, l.target_type, l.target_id, l.metadata_json, l.created_at,
              a.username AS admin_username
       FROM admin_audit_logs l JOIN admin_users a ON a.id = l.admin_user_id
       ORDER BY l.created_at DESC LIMIT ?`,
    )
    .bind(Math.min(Math.max(limit, 1), 200))
    .all<{ id: string; action: string; target_type: string | null; target_id: string | null; metadata_json: string | null; created_at: number; admin_username: string }>();
  return rows.results.map((row) => ({
    id: row.id,
    action: row.action,
    targetType: row.target_type,
    targetId: row.target_id,
    metadata: row.metadata_json ? JSON.parse(row.metadata_json) : null,
    createdAt: row.created_at,
    adminUsername: row.admin_username,
  }));
}

/** 管理门槛：需要有效管理员会话（role: admin / super_admin）。 */
export async function requireAdminUser(request: Request): Promise<AdminUser> {
  const user = await getAdminUser(request);
  if (!user) throw new Error('AUTH_REQUIRED');
  if (user.status !== 'active') throw new Error('ACCOUNT_SUSPENDED');
  return user;
}

export async function logoutAdmin(request: Request): Promise<boolean> {
  const token = readCookie(request, COOKIE_NAME);
  if (!token) return false;
  const tokenHash = await hashToken(token);
  const result = await getD1()
    .prepare('UPDATE admin_sessions SET revoked_at = ? WHERE token_hash = ? AND revoked_at IS NULL')
    .bind(Date.now(), tokenHash)
    .run();
  return result.meta.changes > 0;
}
