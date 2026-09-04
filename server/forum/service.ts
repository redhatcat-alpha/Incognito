import { getD1 } from '@/db';
import { ensureSeedData } from '@/server/forum/seed';

const EDIT_WINDOW_MS = 30 * 60 * 1000;
const DEFAULT_TAG_COLOR = '#7d8f83';

type BoardRow = {
  id: string;
  slug: string;
  name: string;
  description: string;
  icon: string;
  accent: string;
  status: string;
  post_count: number;
};

type PostRow = {
  id: string;
  public_id: string;
  board_id: string;
  board_slug: string;
  board_name: string;
  board_accent: string;
  board_status: string;
  author_id: string;
  title: string;
  body: string;
  status: string;
  up_count: number;
  down_count: number;
  reply_count: number;
  created_at: number;
  updated_at: number;
  last_replied_at: number;
  current_vote?: number | null;
};

type TagRow = { post_id: string; name: string };

type ReplyRow = {
  id: string;
  public_id: string;
  author_id: string;
  floor_no: number;
  body: string;
  quote_reply_id: string | null;
  up_count: number;
  down_count: number;
  status: string;
  created_at: number;
  updated_at: number;
  alias_index: number | null;
  avatar_seed: string | null;
  current_vote: number | null;
};

export type BoardStatus = 'active' | 'readonly' | 'archived' | 'hidden';
export type ContentStatus = 'pending' | 'published' | 'locked' | 'hidden' | 'deleted' | 'archived';

export type PublicBoard = {
  slug: string;
  name: string;
  description: string;
  icon: string;
  accent: string;
  status: BoardStatus;
  postCount: number;
};

export type PublicPost = {
  id: string;
  status: ContentStatus;
  board: { slug: string; name: string; accent: string; status: BoardStatus };
  title: string;
  body: string;
  excerpt: string;
  tags: string[];
  score: number;
  upCount: number;
  downCount: number;
  replyCount: number;
  createdAt: number;
  updatedAt: number;
  lastRepliedAt: number;
  currentVote: -1 | 0 | 1;
  isMine: boolean;
};

export type PublicReply = {
  id: string;
  status: 'published' | 'deleted';
  floorNo: number;
  body: string;
  quoteReplyId: string | null;
  alias: string;
  avatarSeed: string;
  isOwner: boolean;
  isMine: boolean;
  score: number;
  upCount: number;
  downCount: number;
  currentVote: -1 | 0 | 1;
  createdAt: number;
  updatedAt: number;
};

export type ThreadData = {
  post: PublicPost;
  replies: PublicReply[];
  history: { maxReadFloor: number; anchorReplyId: string | null; lastViewedAt: number } | null;
  canReply: boolean;
  totalFloors: number;
};

export type PublicAnnouncement = {
  id: string;
  scope: string;
  level: 'info' | 'reminder' | 'warning' | 'urgent';
  title: string;
  body: string;
  startsAt: number;
  endsAt: number | null;
  createdAt: number;
};

export type AnonSessionInfo = {
  id: string;
  createdAt: number;
  lastUsedAt: number;
  expiresAt: number;
  revoked: boolean;
};

export type AnonProfile = {
  status: string;
  createdAt: number;
  avatarSeed: string;
  historySyncEnabled: boolean;
  activeSessionCount: number;
};

function escapeLike(value: string): string {
  return value.replaceAll(/[\\%_]/g, (match) => `\\${match}`);
}

async function assertWritableUser(db: D1Database, userId: string): Promise<void> {
  const user = await db
    .prepare('SELECT status FROM anonymous_users WHERE id = ? LIMIT 1')
    .bind(userId)
    .first<{ status: string }>();
  if (!user || user.status !== 'active') throw new Error('USER_NOT_WRITABLE');
}

async function tagsByPostIds(postIds: string[]): Promise<Map<string, string[]>> {
  const grouped = new Map<string, string[]>();
  if (!postIds.length) return grouped;

  const placeholders = postIds.map(() => '?').join(',');
  const result = await getD1()
    .prepare(
      `SELECT pt.post_id, t.name
       FROM post_tags pt
       JOIN tags t ON t.id = pt.tag_id
       WHERE pt.post_id IN (${placeholders}) AND t.status = 'active'
       ORDER BY t.name`,
    )
    .bind(...postIds)
    .all<TagRow>();

  for (const tag of result.results) {
    const current = grouped.get(tag.post_id) ?? [];
    current.push(tag.name);
    grouped.set(tag.post_id, current);
  }
  return grouped;
}

function mapBoard(row: BoardRow): PublicBoard {
  return {
    slug: row.slug,
    name: row.name,
    description: row.description,
    icon: row.icon,
    accent: row.accent,
    status: row.status as BoardStatus,
    postCount: Number(row.post_count),
  };
}

function mapPost(row: PostRow, tags: string[], currentUserId?: string): PublicPost {
  return {
    id: row.public_id,
    status: row.status as ContentStatus,
    board: {
      slug: row.board_slug,
      name: row.board_name,
      accent: row.board_accent,
      status: row.board_status as BoardStatus,
    },
    title: row.title,
    body: row.body,
    excerpt: row.body.replaceAll('\n', ' ').slice(0, 140),
    tags,
    score: row.up_count - row.down_count,
    upCount: row.up_count,
    downCount: row.down_count,
    replyCount: row.reply_count,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastRepliedAt: row.last_replied_at,
    currentVote: (row.current_vote ?? 0) as -1 | 0 | 1,
    isMine: Boolean(currentUserId && row.author_id === currentUserId),
  };
}

async function resolveTagIds(db: D1Database, names: string[]): Promise<string[]> {
  const unique = Array.from(new Set(names.map((name) => name.trim()).filter(Boolean))).slice(0, 5);
  const ids: string[] = [];
  for (const name of unique) {
    const existing = await db.prepare('SELECT id FROM tags WHERE name = ? LIMIT 1').bind(name).first<{ id: string }>();
    if (existing) {
      ids.push(existing.id);
      continue;
    }
    const id = crypto.randomUUID();
    const slug = `tag-${crypto.randomUUID().slice(0, 8)}`;
    await db
      .prepare("INSERT OR IGNORE INTO tags (id, slug, name, color, status) VALUES (?, ?, ?, ?, 'active')")
      .bind(id, slug, name, DEFAULT_TAG_COLOR)
      .run();
    const saved = await db.prepare('SELECT id FROM tags WHERE name = ? LIMIT 1').bind(name).first<{ id: string }>();
    if (saved) ids.push(saved.id);
    else ids.push(id);
  }
  return ids;
}

function tagLinkStatements(db: D1Database, postId: string, tagIds: string[]): D1PreparedStatement[] {
  return [
    db.prepare('DELETE FROM post_tags WHERE post_id = ?').bind(postId),
    ...tagIds.map((tagId) =>
      db
        .prepare('INSERT OR IGNORE INTO post_tags (id, post_id, tag_id) VALUES (?, ?, ?)')
        .bind(crypto.randomUUID(), postId, tagId),
    ),
  ];
}

async function fetchPostDto(userId: string, publicId: string): Promise<PublicPost | null> {
  const row = await getD1()
    .prepare(
      `SELECT p.id, p.public_id, p.board_id, b.slug AS board_slug,
              b.name AS board_name, b.accent AS board_accent, b.status AS board_status,
              p.author_id, p.title, p.body, p.status, p.up_count, p.down_count,
              p.reply_count, p.created_at, p.updated_at, p.last_replied_at
       FROM posts p
       JOIN boards b ON b.id = p.board_id
       WHERE p.public_id = ? LIMIT 1`,
    )
    .bind(publicId)
    .first<PostRow>();
  if (!row) return null;
  const tagMap = await tagsByPostIds([row.id]);
  return mapPost(row, tagMap.get(row.id) ?? [], userId);
}

export async function listForum(userId?: string, boardSlug?: string, sort: 'latest' | 'hot' = 'latest') {
  await ensureSeedData();
  const db = getD1();
  const boardResult = await db
    .prepare(
      `SELECT b.id, b.slug, b.name, b.description, b.icon, b.accent, b.status,
              COUNT(p.id) AS post_count
       FROM boards b
       LEFT JOIN posts p ON p.board_id = b.id AND p.status IN ('published', 'locked')
       WHERE b.status != 'hidden'
       GROUP BY b.id
       ORDER BY b.sort_order ASC`,
    )
    .all<BoardRow>();

  const params: unknown[] = [];
  let where = "WHERE p.status IN ('published', 'locked')";
  if (boardSlug) {
    where += ' AND b.slug = ? AND b.status != \'hidden\'';
    params.push(boardSlug);
  }

  const orderBy =
    sort === 'hot'
      ? 'ORDER BY (p.up_count - p.down_count) + p.reply_count * 2 DESC, p.last_replied_at DESC'
      : 'ORDER BY p.last_replied_at DESC';

  const postResult = await db
    .prepare(
      `SELECT p.id, p.public_id, p.board_id, b.slug AS board_slug,
              b.name AS board_name, b.accent AS board_accent, b.status AS board_status,
              p.author_id, p.title, p.body, p.status, p.up_count, p.down_count,
              p.reply_count, p.created_at, p.updated_at, p.last_replied_at,
              ${userId ? `(SELECT value FROM votes v WHERE v.user_id = ? AND v.target_type = 'post' AND v.target_id = p.id)` : '0'} AS current_vote
       FROM posts p
       JOIN boards b ON b.id = p.board_id
       ${where}
       ${orderBy}
       LIMIT 50`,
    )
    .bind(...(userId ? [userId, ...params] : params))
    .all<PostRow>();

  const tagMap = await tagsByPostIds(postResult.results.map((post) => post.id));
  return {
    boards: boardResult.results.map(mapBoard),
    posts: postResult.results.map((post) => mapPost(post, tagMap.get(post.id) ?? [], userId)),
  };
}

export async function listBoards() {
  await ensureSeedData();
  const result = await getD1()
    .prepare(
      `SELECT b.id, b.slug, b.name, b.description, b.icon, b.accent, b.status,
              COUNT(p.id) AS post_count
       FROM boards b
       LEFT JOIN posts p ON p.board_id = b.id AND p.status IN ('published', 'locked')
       WHERE b.status != 'hidden'
       GROUP BY b.id
       ORDER BY b.sort_order ASC`,
    )
    .all<BoardRow>();
  return result.results.map(mapBoard);
}

export async function getBoard(slug: string): Promise<PublicBoard | null> {
  await ensureSeedData();
  const row = await getD1()
    .prepare(
      `SELECT b.id, b.slug, b.name, b.description, b.icon, b.accent, b.status,
              COUNT(p.id) AS post_count
       FROM boards b
       LEFT JOIN posts p ON p.board_id = b.id AND p.status IN ('published', 'locked')
       WHERE b.slug = ? AND b.status != 'hidden'
       GROUP BY b.id
       LIMIT 1`,
    )
    .bind(slug)
    .first<BoardRow>();
  return row ? mapBoard(row) : null;
}

export async function getThread(publicId: string, userId: string) {
  await ensureSeedData();
  const db = getD1();
  const post = await db
    .prepare(
      `SELECT p.id, p.public_id, p.board_id, b.slug AS board_slug,
              b.name AS board_name, b.accent AS board_accent, b.status AS board_status,
              p.author_id, p.title, p.body, p.status, p.up_count, p.down_count,
              p.reply_count, p.created_at, p.updated_at, p.last_replied_at,
              (SELECT value FROM votes v WHERE v.user_id = ? AND v.target_type = 'post' AND v.target_id = p.id) AS current_vote
       FROM posts p
       JOIN boards b ON b.id = p.board_id
       WHERE p.public_id = ? AND p.status IN ('published', 'locked', 'deleted') AND b.status != 'hidden'
       LIMIT 1`,
    )
    .bind(userId, publicId)
    .first<PostRow>();

  if (!post) return null;

  const [tagMap, replyResult, history, user] = await Promise.all([
    tagsByPostIds([post.id]),
    db
      .prepare(
        `SELECT r.id, r.public_id, r.author_id, r.floor_no, r.body,
                r.quote_reply_id, r.up_count, r.down_count, r.status, r.created_at,
                r.updated_at, ta.alias_index, ta.avatar_seed,
                (SELECT value FROM votes v WHERE v.user_id = ? AND v.target_type = 'reply' AND v.target_id = r.id) AS current_vote
         FROM replies r
         LEFT JOIN thread_aliases ta ON ta.post_id = r.post_id AND ta.user_id = r.author_id
         WHERE r.post_id = ? AND r.status IN ('published', 'deleted')
         ORDER BY r.floor_no ASC
         LIMIT 200`,
      )
      .bind(userId, post.id)
      .all<ReplyRow>(),
    db
      .prepare('SELECT max_read_floor, anchor_reply_id, last_viewed_at FROM browsing_history WHERE user_id = ? AND post_id = ? LIMIT 1')
      .bind(userId, post.id)
      .first<{ max_read_floor: number; anchor_reply_id: string | null; last_viewed_at: number }>(),
    db.prepare('SELECT status FROM anonymous_users WHERE id = ? LIMIT 1').bind(userId).first<{ status: string }>(),
  ]);

  const boardActive = post.board_status === 'active';
  const userWritable = user?.status === 'active';
  return {
    post: mapPost(post, tagMap.get(post.id) ?? [], userId),
    replies: replyResult.results.map<PublicReply>((reply) => {
      if (reply.status === 'deleted') {
        return {
          id: reply.public_id,
          status: 'deleted',
          floorNo: reply.floor_no,
          body: '',
          quoteReplyId: null,
          alias: '',
          avatarSeed: '',
          isOwner: false,
          isMine: false,
          score: 0,
          upCount: 0,
          downCount: 0,
          currentVote: 0,
          createdAt: reply.created_at,
          updatedAt: reply.updated_at,
        };
      }
      const isOwner = reply.author_id === post.author_id;
      return {
        id: reply.public_id,
        status: 'published',
        floorNo: reply.floor_no,
        body: reply.body,
        quoteReplyId: reply.quote_reply_id,
        alias: isOwner ? '楼主' : `匿名 A${reply.alias_index ?? '?'}`,
        avatarSeed: reply.avatar_seed ?? 'anonymous',
        isOwner,
        isMine: reply.author_id === userId,
        score: reply.up_count - reply.down_count,
        upCount: reply.up_count,
        downCount: reply.down_count,
        currentVote: (reply.current_vote ?? 0) as -1 | 0 | 1,
        createdAt: reply.created_at,
        updatedAt: reply.updated_at,
      };
    }),
    history: history
      ? { maxReadFloor: history.max_read_floor, anchorReplyId: history.anchor_reply_id, lastViewedAt: history.last_viewed_at }
      : null,
    canReply: post.status === 'published' && boardActive && userWritable,
    totalFloors: post.reply_count + 1,
  };
}

export async function createPost(
  userId: string,
  input: { boardSlug: string; title: string; body: string; tags: string[] },
) {
  await ensureSeedData();
  const db = getD1();
  await assertWritableUser(db, userId);
  const board = await db
    .prepare("SELECT id, status FROM boards WHERE slug = ? AND status != 'hidden' LIMIT 1")
    .bind(input.boardSlug)
    .first<{ id: string; status: string }>();
  if (!board) throw new Error('BOARD_NOT_FOUND');
  if (board.status !== 'active') throw new Error('BOARD_READONLY');

  const id = crypto.randomUUID();
  const publicId = crypto.randomUUID();
  const createdAt = Date.now();
  const tagIds = await resolveTagIds(db, input.tags);

  await db.batch([
    db
      .prepare('INSERT INTO posts (id, public_id, board_id, author_id, title, body, status, next_floor_no, up_count, down_count, reply_count, created_at, updated_at, last_replied_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .bind(id, publicId, board.id, userId, input.title, input.body, 'published', 2, 0, 0, 0, createdAt, createdAt, createdAt),
    db
      .prepare('INSERT INTO thread_aliases (id, post_id, user_id, alias_index, avatar_seed) VALUES (?, ?, ?, 0, ?)')
      .bind(crypto.randomUUID(), id, userId, crypto.randomUUID()),
    ...tagLinkStatements(db, id, tagIds),
  ]);

  return fetchPostDto(userId, publicId);
}

export async function createReply(userId: string, postPublicId: string, body: string, quoteReplyId?: string | null) {
  await ensureSeedData();
  const db = getD1();
  await assertWritableUser(db, userId);
  const post = await db
    .prepare(
      `SELECT p.id, p.status, b.status AS board_status
       FROM posts p JOIN boards b ON b.id = p.board_id
       WHERE p.public_id = ? LIMIT 1`,
    )
    .bind(postPublicId)
    .first<{ id: string; status: string; board_status: string }>();
  if (!post) throw new Error('POST_NOT_FOUND');
  if (post.status !== 'published') throw new Error('POST_LOCKED');
  if (post.board_status !== 'active') throw new Error('BOARD_READONLY');

  const id = crypto.randomUUID();
  const publicId = crypto.randomUUID();
  const timestamp = Date.now();
  await db.batch([
    db
      .prepare(
        `INSERT OR IGNORE INTO thread_aliases (id, post_id, user_id, alias_index, avatar_seed)
         SELECT ?, ?, ?, COALESCE(MAX(alias_index), 0) + 1, ?
         FROM thread_aliases WHERE post_id = ?`,
      )
      .bind(crypto.randomUUID(), post.id, userId, crypto.randomUUID(), post.id),
    db
      .prepare(
        `UPDATE posts
         SET next_floor_no = next_floor_no + 1,
             reply_count = reply_count + 1,
             last_replied_at = ?, updated_at = ?
         WHERE id = ? AND status = 'published'`,
      )
      .bind(timestamp, timestamp, post.id),
    db
      .prepare(
        `INSERT INTO replies
         (id, public_id, post_id, author_id, floor_no, body, quote_reply_id, status, up_count, down_count, created_at, updated_at)
         SELECT ?, ?, id, ?, next_floor_no - 1, ?, ?, 'published', 0, 0, ?, ?
         FROM posts WHERE id = ? AND status = 'published'`,
      )
      .bind(id, publicId, userId, body, quoteReplyId ?? null, timestamp, timestamp, post.id),
  ]);

  return { id: publicId };
}

export async function updatePost(
  userId: string,
  publicId: string,
  input: { title: string; body: string; tags: string[] },
) {
  const db = getD1();
  const post = await db
    .prepare("SELECT id, author_id, created_at, status FROM posts WHERE public_id = ? LIMIT 1")
    .bind(publicId)
    .first<{ id: string; author_id: string; created_at: number; status: string }>();
  if (!post) throw new Error('POST_NOT_FOUND');
  if (post.status === 'deleted') throw new Error('POST_NOT_FOUND');
  if (post.author_id !== userId) throw new Error('NOT_CONTENT_AUTHOR');
  await assertWritableUser(db, userId);
  if (post.status !== 'published') throw new Error('POST_LOCKED');
  if (Date.now() - post.created_at > EDIT_WINDOW_MS) throw new Error('EDIT_WINDOW_EXPIRED');

  const tagIds = await resolveTagIds(db, input.tags);
  const updatedAt = Date.now();
  await db.batch([
    db
      .prepare('UPDATE posts SET title = ?, body = ?, updated_at = ? WHERE id = ?')
      .bind(input.title, input.body, updatedAt, post.id),
    ...tagLinkStatements(db, post.id, tagIds),
  ]);

  return fetchPostDto(userId, publicId);
}

export async function deletePost(userId: string, publicId: string) {
  const db = getD1();
  const post = await db
    .prepare("SELECT id, author_id, status FROM posts WHERE public_id = ? LIMIT 1")
    .bind(publicId)
    .first<{ id: string; author_id: string; status: string }>();
  if (!post || post.status === 'deleted') throw new Error('POST_NOT_FOUND');
  if (post.author_id !== userId) throw new Error('NOT_CONTENT_AUTHOR');
  if (post.status === 'locked') throw new Error('POST_LOCKED');

  const timestamp = Date.now();
  await db
    .prepare("UPDATE posts SET status = 'deleted', title = '', body = '', updated_at = ? WHERE id = ?")
    .bind(timestamp, post.id)
    .run();
  return { id: publicId, status: 'deleted' };
}

export async function updateReply(userId: string, publicId: string, body: string) {
  const db = getD1();
  const reply = await db
    .prepare(
      `SELECT r.id, r.author_id, r.created_at, r.status, p.status AS post_status
       FROM replies r JOIN posts p ON p.id = r.post_id
       WHERE r.public_id = ? LIMIT 1`,
    )
    .bind(publicId)
    .first<{ id: string; author_id: string; created_at: number; status: string; post_status: string }>();
  if (!reply || reply.status === 'deleted') throw new Error('POST_NOT_FOUND');
  if (reply.author_id !== userId) throw new Error('NOT_CONTENT_AUTHOR');
  await assertWritableUser(db, userId);
  if (reply.post_status !== 'published') throw new Error('POST_LOCKED');
  if (Date.now() - reply.created_at > EDIT_WINDOW_MS) throw new Error('EDIT_WINDOW_EXPIRED');

  await db
    .prepare('UPDATE replies SET body = ?, updated_at = ? WHERE id = ?')
    .bind(body, Date.now(), reply.id)
    .run();
  return { id: publicId };
}

export async function deleteReply(userId: string, publicId: string) {
  const db = getD1();
  const reply = await db
    .prepare('SELECT id, author_id, status FROM replies WHERE public_id = ? LIMIT 1')
    .bind(publicId)
    .first<{ id: string; author_id: string; status: string }>();
  if (!reply || reply.status === 'deleted') throw new Error('POST_NOT_FOUND');
  if (reply.author_id !== userId) throw new Error('NOT_CONTENT_AUTHOR');

  await db
    .prepare("UPDATE replies SET status = 'deleted', body = '', updated_at = ? WHERE id = ?")
    .bind(Date.now(), reply.id)
    .run();
  return { id: publicId, status: 'deleted' };
}

export async function setVote(
  userId: string,
  targetType: 'post' | 'reply',
  publicId: string,
  value: -1 | 0 | 1,
) {
  const db = getD1();
  await assertWritableUser(db, userId);
  const table = targetType === 'post' ? 'posts' : 'replies';
  const target = await db
    .prepare(`SELECT id, author_id, up_count, down_count FROM ${table} WHERE public_id = ? AND status IN ('published', 'locked') LIMIT 1`)
    .bind(publicId)
    .first<{ id: string; author_id: string; up_count: number; down_count: number }>();
  if (!target) throw new Error('TARGET_NOT_FOUND');
  if (target.author_id === userId) throw new Error('CANNOT_VOTE_OWN_CONTENT');

  const existing = await db
    .prepare('SELECT value FROM votes WHERE user_id = ? AND target_type = ? AND target_id = ? LIMIT 1')
    .bind(userId, targetType, target.id)
    .first<{ value: number }>();
  const previous = existing?.value ?? 0;
  const upDelta = (value === 1 ? 1 : 0) - (previous === 1 ? 1 : 0);
  const downDelta = (value === -1 ? 1 : 0) - (previous === -1 ? 1 : 0);
  const timestamp = Date.now();
  const statements = [
    value === 0
      ? db.prepare('DELETE FROM votes WHERE user_id = ? AND target_type = ? AND target_id = ?').bind(userId, targetType, target.id)
      : db
          .prepare(
            `INSERT INTO votes (id, user_id, target_type, target_id, value, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?)
             ON CONFLICT(user_id, target_type, target_id)
             DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
          )
          .bind(crypto.randomUUID(), userId, targetType, target.id, value, timestamp, timestamp),
    db
      .prepare(`UPDATE ${table} SET up_count = MAX(0, up_count + ?), down_count = MAX(0, down_count + ?) WHERE id = ?`)
      .bind(upDelta, downDelta, target.id),
  ];
  await db.batch(statements);

  const updated = await db.prepare(`SELECT up_count, down_count FROM ${table} WHERE id = ?`).bind(target.id).first<{ up_count: number; down_count: number }>();
  return {
    currentVote: value,
    upCount: updated?.up_count ?? target.up_count,
    downCount: updated?.down_count ?? target.down_count,
    score: (updated?.up_count ?? target.up_count) - (updated?.down_count ?? target.down_count),
  };
}

export async function saveProgress(userId: string, postPublicId: string, maxReadFloor: number, anchorReplyId?: string | null) {
  const db = getD1();
  const [post, user] = await Promise.all([
    db.prepare('SELECT id FROM posts WHERE public_id = ? LIMIT 1').bind(postPublicId).first<{ id: string }>(),
    db.prepare('SELECT history_sync_enabled FROM anonymous_users WHERE id = ? LIMIT 1').bind(userId).first<{ history_sync_enabled: number }>(),
  ]);
  if (!post) throw new Error('POST_NOT_FOUND');
  if (user && user.history_sync_enabled === 0) return { saved: false };

  const timestamp = Date.now();
  await db
    .prepare(
      `INSERT INTO browsing_history (id, user_id, post_id, max_read_floor, anchor_reply_id, last_viewed_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(user_id, post_id)
       DO UPDATE SET
         max_read_floor = MAX(browsing_history.max_read_floor, excluded.max_read_floor),
         anchor_reply_id = excluded.anchor_reply_id,
         last_viewed_at = excluded.last_viewed_at`,
    )
    .bind(crypto.randomUUID(), userId, post.id, maxReadFloor, anchorReplyId ?? null, timestamp)
    .run();
  return { saved: true, maxReadFloor, anchorReplyId: anchorReplyId ?? null, lastViewedAt: timestamp };
}

export async function listHistory(userId: string) {
  await ensureSeedData();
  const user = await getD1()
    .prepare('SELECT history_sync_enabled FROM anonymous_users WHERE id = ? LIMIT 1')
    .bind(userId)
    .first<{ history_sync_enabled: number }>();
  const enabled = user?.history_sync_enabled !== 0;
  if (!enabled) return { enabled: false, entries: [] };

  const result = await getD1()
    .prepare(
      `SELECT p.public_id, p.title, b.name AS board_name, b.slug AS board_slug,
              h.max_read_floor, h.anchor_reply_id, h.last_viewed_at,
              p.reply_count + 1 AS total_floors
       FROM browsing_history h
       JOIN posts p ON p.id = h.post_id
       JOIN boards b ON b.id = p.board_id
       WHERE h.user_id = ? AND p.status IN ('published', 'locked')
       ORDER BY h.last_viewed_at DESC
       LIMIT 100`,
    )
    .bind(userId)
    .all<{
      public_id: string;
      title: string;
      board_name: string;
      board_slug: string;
      max_read_floor: number;
      anchor_reply_id: string | null;
      last_viewed_at: number;
      total_floors: number;
    }>();

  return {
    enabled: true,
    entries: result.results.map((row) => ({
      postId: row.public_id,
      title: row.title,
      board: { name: row.board_name, slug: row.board_slug },
      maxReadFloor: row.max_read_floor,
      anchorReplyId: row.anchor_reply_id,
      lastViewedAt: row.last_viewed_at,
      totalFloors: row.total_floors,
    })),
  };
}

export async function setHistorySync(userId: string, enabled: boolean) {
  const db = getD1();
  const timestamp = Date.now();
  const statements = [
    db.prepare('UPDATE anonymous_users SET history_sync_enabled = ? WHERE id = ?').bind(enabled ? 1 : 0, userId),
  ];
  if (!enabled) {
    statements.push(db.prepare('DELETE FROM browsing_history WHERE user_id = ?').bind(userId));
  }
  await db.batch(statements);
  return { enabled, historyCleared: !enabled, clearedAt: !enabled ? timestamp : null };
}

export async function clearHistory(userId: string, postPublicId?: string) {
  const db = getD1();
  if (!postPublicId) {
    await db.prepare('DELETE FROM browsing_history WHERE user_id = ?').bind(userId).run();
    return;
  }
  await db
    .prepare('DELETE FROM browsing_history WHERE user_id = ? AND post_id = (SELECT id FROM posts WHERE public_id = ?)')
    .bind(userId, postPublicId)
    .run();
}

export async function searchPosts(
  userId: string | undefined,
  query: string,
  filter?: { boardSlug?: string; tag?: string },
) {
  await ensureSeedData();
  const db = getD1();
  const keyword = query.trim();
  if (!keyword) throw new Error('INVALID_QUERY');
  const escaped = escapeLike(keyword.slice(0, 100));

  const where = ["p.status IN ('published', 'locked')", `(p.title LIKE ? ESCAPE '\\' OR p.body LIKE ? ESCAPE '\\')`];
  const whereParams: unknown[] = [`%${escaped}%`, `%${escaped}%`];
  if (filter?.boardSlug) {
    where.push('b.slug = ?');
    whereParams.push(filter.boardSlug);
  }
  if (filter?.tag) {
    where.push("EXISTS (SELECT 1 FROM post_tags pt2 JOIN tags t2 ON t2.id = pt2.tag_id WHERE pt2.post_id = p.id AND t2.name = ? AND t2.status = 'active')");
    whereParams.push(filter.tag);
  }
  const whereSql = `WHERE ${where.join(' AND ')}`;
  const voteSelect = userId
    ? `(SELECT value FROM votes v WHERE v.user_id = ? AND v.target_type = 'post' AND v.target_id = p.id)`
    : '0';
  const postParams = userId ? [userId, ...whereParams] : whereParams;

  const [countResult, postResult] = await Promise.all([
    db
      .prepare(`SELECT COUNT(*) AS total FROM posts p JOIN boards b ON b.id = p.board_id ${whereSql}`)
      .bind(...whereParams)
      .first<{ total: number }>(),
    db
      .prepare(
        `SELECT p.id, p.public_id, p.board_id, b.slug AS board_slug,
                b.name AS board_name, b.accent AS board_accent, b.status AS board_status,
                p.author_id, p.title, p.body, p.status, p.up_count, p.down_count,
                p.reply_count, p.created_at, p.updated_at, p.last_replied_at,
                ${voteSelect} AS current_vote
         FROM posts p
         JOIN boards b ON b.id = p.board_id
         ${whereSql}
         ORDER BY p.last_replied_at DESC
         LIMIT 50`,
      )
      .bind(...postParams)
      .all<PostRow>(),
  ]);

  const tagMap = await tagsByPostIds(postResult.results.map((post) => post.id));
  return {
    query: keyword,
    total: Number(countResult?.total ?? 0),
    posts: postResult.results.map((post) => mapPost(post, tagMap.get(post.id) ?? [], userId)),
  };
}

export async function listAnnouncements(boardSlug?: string) {
  await ensureSeedData();
  const db = getD1();
  const params: unknown[] = [Date.now(), Date.now()];
  let scopeSql = "WHERE a.status = 'published' AND a.scope = 'global' AND a.starts_at <= ? AND (a.ends_at IS NULL OR a.ends_at >= ?)";
  if (boardSlug) {
    scopeSql = "WHERE a.status = 'published' AND a.starts_at <= ? AND (a.ends_at IS NULL OR a.ends_at >= ?) AND (a.scope = 'global' OR (a.scope = 'board' AND a.board_id = (SELECT id FROM boards WHERE slug = ? AND status != 'hidden')))";
    params.push(boardSlug);
  }
  const result = await db
    .prepare(`SELECT a.id, a.scope, a.level, a.title, a.body, a.starts_at, a.ends_at, a.created_at FROM announcements a ${scopeSql} ORDER BY a.created_at DESC LIMIT 10`)
    .bind(...params)
    .all<{
      id: string;
      scope: string;
      level: string;
      title: string;
      body: string;
      starts_at: number;
      ends_at: number | null;
      created_at: number;
    }>();
  return result.results.map<PublicAnnouncement>((row) => ({
    id: row.id,
    scope: row.scope,
    level: row.level as PublicAnnouncement['level'],
    title: row.title,
    body: row.body,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    createdAt: row.created_at,
  }));
}

export async function createReport(
  userId: string,
  input: { targetType: 'post' | 'reply'; publicId: string; reason: string; details: string },
) {
  const db = getD1();
  const table = input.targetType === 'post' ? 'posts' : 'replies';
  const target = await db
    .prepare(`SELECT id, author_id FROM ${table} WHERE public_id = ? AND status = 'published' LIMIT 1`)
    .bind(input.publicId)
    .first<{ id: string; author_id: string }>();
  if (!target) throw new Error('TARGET_NOT_FOUND');
  if (target.author_id === userId) throw new Error('CANNOT_REPORT_OWN');

  const existing = await db
    .prepare('SELECT id FROM reports WHERE reporter_id = ? AND target_type = ? AND target_id = ? LIMIT 1')
    .bind(userId, input.targetType, target.id)
    .first<{ id: string }>();
  if (existing) throw new Error('REPORT_EXISTS');

  const timestamp = Date.now();
  const reportId = crypto.randomUUID();
  await db
    .prepare('INSERT INTO reports (id, reporter_id, target_type, target_id, reason, details, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
    .bind(reportId, userId, input.targetType, target.id, input.reason, input.details || null, 'pending', timestamp)
    .run();
  return { reportId, status: 'pending', submittedAt: timestamp };
}

export async function getAnonProfile(userId: string): Promise<AnonProfile> {
  const db = getD1();
  const user = await db
    .prepare('SELECT status, avatar_seed, history_sync_enabled, created_at FROM anonymous_users WHERE id = ? LIMIT 1')
    .bind(userId)
    .first<{ status: string; avatar_seed: string; history_sync_enabled: number; created_at: number }>();
  if (!user) throw new Error('POST_NOT_FOUND');
  const session = await db
    .prepare('SELECT COUNT(*) AS total FROM anonymous_sessions WHERE user_id = ? AND revoked_at IS NULL')
    .bind(userId)
    .first<{ total: number }>();
  return {
    status: user.status,
    createdAt: user.created_at,
    avatarSeed: user.avatar_seed,
    historySyncEnabled: user.history_sync_enabled !== 0,
    activeSessionCount: Number(session?.total ?? 0),
  };
}

export async function listAnonSessions(userId: string): Promise<AnonSessionInfo[]> {
  const result = await getD1()
    .prepare('SELECT id, created_at, last_used_at, expires_at, revoked_at FROM anonymous_sessions WHERE user_id = ? ORDER BY created_at DESC LIMIT 20')
    .bind(userId)
    .all<{ id: string; created_at: number; last_used_at: number; expires_at: number; revoked_at: number | null }>();
  return result.results.map((row) => ({
    id: row.id,
    createdAt: row.created_at,
    lastUsedAt: row.last_used_at,
    expiresAt: row.expires_at,
    revoked: row.revoked_at !== null,
  }));
}

export async function revokeAnonSession(userId: string, sessionId: string) {
  const result = await getD1()
    .prepare('UPDATE anonymous_sessions SET revoked_at = ? WHERE id = ? AND user_id = ? AND revoked_at IS NULL')
    .bind(Date.now(), sessionId, userId)
    .run();
  if (result.meta.changes === 0) throw new Error('POST_NOT_FOUND');
  return { revoked: true };
}

export async function destroyAnonIdentity(userId: string) {
  const db = getD1();
  const timestamp = Date.now();

  // 回滚该身份留下的投票计数（删除投票行本身在 batch 中进行）
  const votes = await db
    .prepare('SELECT target_type, target_id, value FROM votes WHERE user_id = ?')
    .bind(userId)
    .all<{ target_type: string; target_id: string; value: number }>();
  const counters = new Map<string, { up: number; down: number }>();
  for (const vote of votes.results) {
    const key = `${vote.target_type}:${vote.target_id}`;
    const entry = counters.get(key) ?? { up: 0, down: 0 };
    if (vote.value === 1) entry.up += 1;
    if (vote.value === -1) entry.down += 1;
    counters.set(key, entry);
  }

  const statements: D1PreparedStatement[] = [
    db.prepare('UPDATE anonymous_sessions SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL').bind(timestamp, userId),
    db.prepare("UPDATE anonymous_users SET status = 'deleted', avatar_seed = '', deletion_requested_at = ? WHERE id = ?").bind(timestamp, userId),
    db.prepare('DELETE FROM browsing_history WHERE user_id = ?').bind(userId),
    db.prepare('DELETE FROM votes WHERE user_id = ?').bind(userId),
  ];
  for (const [key, count] of counters) {
    const [targetType, targetId] = key.split(':');
    const table = targetType === 'post' ? 'posts' : 'replies';
    statements.push(
      db
        .prepare(`UPDATE ${table} SET up_count = MAX(0, up_count - ?), down_count = MAX(0, down_count - ?) WHERE id = ?`)
        .bind(count.up, count.down, targetId),
    );
  }
  statements.push(
    db
      .prepare(
        `UPDATE posts SET status = 'deleted', title = '', body = '', updated_at = ?
         WHERE author_id = ? AND status NOT IN ('deleted', 'hidden')`,
      )
      .bind(timestamp, userId),
    db
      .prepare(
        `UPDATE replies SET status = 'deleted', body = '', updated_at = ?
         WHERE author_id = ? AND status = 'published'`,
      )
      .bind(timestamp, userId),
  );

  await db.batch(statements);
  return { destroyed: true, votesRolledBack: counters.size };
}
