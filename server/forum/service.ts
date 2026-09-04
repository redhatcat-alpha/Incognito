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
  authorName: string | null;
  authorUid: number | null;
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
  read: boolean;
};

export type AdminAnnouncementRow = {
  id: string;
  scope: string;
  level: string;
  title: string;
  body: string;
  startsAt: number;
  endsAt: number | null;
  status: string;
  createdAt: number;
  readCount: number;
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

/** 注册用户公开信息；author 行与其 registered_users.id 共用同一 ID。 */
export type RegisteredAuthor = { username: string; uid: number };

function plainTextOf(value: string): string {
  return value
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function isMine(authorId: string, anonUserId?: string, regUserId?: string): boolean {
  return authorId === anonUserId || (regUserId !== undefined && authorId === regUserId);
}

async function registeredNamesByIds(db: D1Database, ids: string[]): Promise<Map<string, RegisteredAuthor>> {
  const names = new Map<string, RegisteredAuthor>();
  const unique = Array.from(new Set(ids));
  if (!unique.length) return names;
  const placeholders = unique.map(() => '?').join(',');
  const result = await db
    .prepare(
      `SELECT id, username, uid FROM registered_users
       WHERE id IN (${placeholders}) AND status = 'active'`,
    )
    .bind(...unique)
    .all<{ id: string; username: string; uid: number }>();
  for (const row of result.results) names.set(row.id, { username: row.username, uid: row.uid });
  return names;
}

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

async function assertRegisteredWritable(db: D1Database, userId: string): Promise<void> {
  const user = await db
    .prepare('SELECT status FROM registered_users WHERE id = ? LIMIT 1')
    .bind(userId)
    .first<{ status: string }>();
  if (!user) throw new Error('AUTH_REQUIRED');
  if (user.status !== 'active') throw new Error('ACCOUNT_SUSPENDED');
}

/** 按发言身份校验并可返回写入作者行 ID */
async function resolveWriter(
  db: D1Database,
  identity: 'anonymous' | 'registered',
  anonUserId: string,
  regUserId?: string,
): Promise<string> {
  if (identity === 'registered') {
    if (!regUserId) throw new Error('AUTH_REQUIRED');
    await assertRegisteredWritable(db, regUserId);
    return regUserId;
  }
  await assertWritableUser(db, anonUserId);
  return anonUserId;
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

function mapPost(
  row: PostRow,
  tags: string[],
  anonUserId?: string,
  regUserId?: string,
  author?: RegisteredAuthor | null,
): PublicPost {
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
    excerpt: plainTextOf(row.body).slice(0, 140),
    tags,
    score: row.up_count - row.down_count,
    upCount: row.up_count,
    downCount: row.down_count,
    replyCount: row.reply_count,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastRepliedAt: row.last_replied_at,
    currentVote: (row.current_vote ?? 0) as -1 | 0 | 1,
    isMine: isMine(row.author_id, anonUserId, regUserId),
    authorName: author?.username ?? null,
    authorUid: author?.uid ?? null,
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

async function fetchPostDto(userId: string, publicId: string, regUserId?: string): Promise<PublicPost | null> {
  const db = getD1();
  const row = await db
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
  const [tagMap, names] = await Promise.all([tagsByPostIds([row.id]), registeredNamesByIds(db, [row.author_id])]);
  return mapPost(row, tagMap.get(row.id) ?? [], userId, regUserId, names.get(row.author_id) ?? null);
}

export async function listForum(userId?: string, boardSlug?: string, sort: 'latest' | 'hot' = 'latest', regUserId?: string) {
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
    posts: postResult.results.map((post) => mapPost(post, tagMap.get(post.id) ?? [], userId, regUserId, null)),
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

export async function listAdminBoards() {
  await ensureSeedData();
  const result = await getD1().prepare(`SELECT b.id, b.slug, b.name, b.description, b.icon, b.accent, b.status, COUNT(p.id) AS post_count FROM boards b LEFT JOIN posts p ON p.board_id = b.id AND p.status IN ('published','locked') GROUP BY b.id ORDER BY b.sort_order ASC`).all<BoardRow>();
  return result.results.map(mapBoard);
}

export async function updateBoard(slug: string, input: { name: string; description: string; icon: string; accent: string; status: string; sortOrder: number }) {
  const result = await getD1().prepare('UPDATE boards SET name = ?, description = ?, icon = ?, accent = ?, status = ?, sort_order = ?, updated_at = ? WHERE slug = ?')
    .bind(input.name, input.description, input.icon, input.accent, input.status, input.sortOrder, Date.now(), slug).run();
  if (result.meta.changes === 0) throw new Error('POST_NOT_FOUND');
  return { slug, ...input };
}

export async function listAdminTags() {
  const result = await getD1().prepare(`SELECT t.id, t.slug, t.name, t.color, t.status, COUNT(pt.post_id) AS post_count FROM tags t LEFT JOIN post_tags pt ON pt.tag_id = t.id GROUP BY t.id ORDER BY post_count DESC, t.name ASC LIMIT 500`).all<{ id: string; slug: string; name: string; color: string; status: string; post_count: number }>();
  return result.results.map((row) => ({ id: row.id, slug: row.slug, name: row.name, color: row.color, status: row.status, postCount: Number(row.post_count) }));
}

export async function updateTag(slug: string, input: { name: string; color: string; status: string }) {
  const result = await getD1().prepare('UPDATE tags SET name = ?, color = ?, status = ? WHERE slug = ?').bind(input.name, input.color, input.status, slug).run();
  if (result.meta.changes === 0) throw new Error('POST_NOT_FOUND');
  return { slug, ...input };
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

export async function getThread(publicId: string, userId: string, regUserId?: string) {
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
         ORDER BY CASE WHEN r.floor_no = 0 THEN 1 ELSE 0 END, r.floor_no ASC, r.created_at ASC
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

  const names = await registeredNamesByIds(db, [post.author_id, ...replyResult.results.map((reply) => reply.author_id)]);

  const boardActive = post.board_status === 'active';
  const userWritable = user?.status === 'active';
  const postAuthor = names.get(post.author_id) ?? null;
  return {
    post: mapPost(post, tagMap.get(post.id) ?? [], userId, regUserId, postAuthor),
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
      const replyAuthor = names.get(reply.author_id) ?? null;
      return {
        id: reply.public_id,
        status: 'published',
        floorNo: reply.floor_no,
        body: reply.body,
        quoteReplyId: reply.quote_reply_id,
        // 注册作者展示固定用户名；匿名作者沿用线程内代号，楼主自身回复显示“楼主”
        alias: replyAuthor ? replyAuthor.username : isOwner ? '楼主' : `匿名 A${reply.alias_index ?? '?'}`,
        avatarSeed: replyAuthor ? `user:${replyAuthor.username}` : (reply.avatar_seed ?? 'anonymous'),
        isOwner,
        isMine: isMine(reply.author_id, userId, regUserId),
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
  identity: 'anonymous' | 'registered' = 'anonymous',
  regUserId?: string,
) {
  await ensureSeedData();
  const db = getD1();
  const authorId = await resolveWriter(db, identity, userId, regUserId);
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
      .bind(id, publicId, board.id, authorId, input.title, input.body, 'published', 2, 0, 0, 0, createdAt, createdAt, createdAt),
    // 匿名身份发言需要线程内代号；注册身份固定展示用户名，不占用匿名代号
    ...(identity === 'anonymous'
      ? [db
          .prepare('INSERT INTO thread_aliases (id, post_id, user_id, alias_index, avatar_seed) VALUES (?, ?, ?, 0, ?)')
          .bind(crypto.randomUUID(), id, authorId, crypto.randomUUID())]
      : []),
    ...tagLinkStatements(db, id, tagIds),
  ]);

  return fetchPostDto(authorId, publicId, identity === 'registered' ? authorId : undefined);
}

export async function createReply(
  userId: string,
  postPublicId: string,
  body: string,
  quoteReplyId: string | null | undefined,
  identity: 'anonymous' | 'registered' = 'anonymous',
  regUserId?: string,
) {
  await ensureSeedData();
  const db = getD1();
  const authorId = await resolveWriter(db, identity, userId, regUserId);
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

  // 引用目标必须属于同一帖子
  if (quoteReplyId) {
    const quoted = await db
      .prepare("SELECT post_id FROM replies WHERE public_id = ? AND status IN ('published', 'deleted') LIMIT 1")
      .bind(quoteReplyId)
      .first<{ post_id: string }>();
    if (!quoted || quoted.post_id !== post.id) throw new Error('TARGET_NOT_FOUND');
  }

  const id = crypto.randomUUID();
  const publicId = crypto.randomUUID();
  const timestamp = Date.now();
  const statements: D1PreparedStatement[] = [];
  if (identity === 'anonymous') {
    statements.push(
      db
        .prepare(
          `INSERT OR IGNORE INTO thread_aliases (id, post_id, user_id, alias_index, avatar_seed)
           SELECT ?, ?, ?, COALESCE(MAX(alias_index), 0) + 1, ?
           FROM thread_aliases WHERE post_id = ?`,
        )
        .bind(crypto.randomUUID(), post.id, authorId, crypto.randomUUID(), post.id),
    );
  }
  const isDirect = !quoteReplyId;
  if (isDirect) {
    // 直接回复楼主：占用下一个楼层号并推进楼层计数
    statements.push(
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
        .bind(id, publicId, authorId, body, null, timestamp, timestamp, post.id),
    );
  } else {
    // 层内回复：不占楼层号（floor_no=0），不推进楼层计数，仅刷新活跃时间
    statements.push(
      db
        .prepare("UPDATE posts SET last_replied_at = ?, updated_at = ? WHERE id = ? AND status = 'published'")
        .bind(timestamp, timestamp, post.id),
      db
        .prepare(
          `INSERT INTO replies
           (id, public_id, post_id, author_id, floor_no, body, quote_reply_id, status, up_count, down_count, created_at, updated_at)
           VALUES (?, ?, ?, ?, 0, ?, ?, 'published', 0, 0, ?, ?)`,
        )
        .bind(id, publicId, post.id, authorId, body, quoteReplyId, timestamp, timestamp),
    );
  }
  await db.batch(statements);

  return { id: publicId, floorNo: isDirect ? undefined : 0 };
}

export async function updatePost(
  userId: string,
  publicId: string,
  input: { title: string; body: string; tags: string[] },
  regUserId?: string,
) {
  const db = getD1();
  const post = await db
    .prepare("SELECT id, author_id, created_at, status FROM posts WHERE public_id = ? LIMIT 1")
    .bind(publicId)
    .first<{ id: string; author_id: string; created_at: number; status: string }>();
  if (!post) throw new Error('POST_NOT_FOUND');
  if (post.status === 'deleted') throw new Error('POST_NOT_FOUND');
  if (!isMine(post.author_id, userId, regUserId)) throw new Error('NOT_CONTENT_AUTHOR');
  if (post.author_id === regUserId) await assertRegisteredWritable(db, regUserId!);
  else await assertWritableUser(db, userId);
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

  return fetchPostDto(userId, publicId, post.author_id === regUserId ? regUserId : undefined);
}

export async function deletePost(userId: string, publicId: string, regUserId?: string) {
  const db = getD1();
  const post = await db
    .prepare("SELECT id, author_id, status FROM posts WHERE public_id = ? LIMIT 1")
    .bind(publicId)
    .first<{ id: string; author_id: string; status: string }>();
  if (!post || post.status === 'deleted') throw new Error('POST_NOT_FOUND');
  if (!isMine(post.author_id, userId, regUserId)) throw new Error('NOT_CONTENT_AUTHOR');
  if (post.status === 'locked') throw new Error('POST_LOCKED');

  const timestamp = Date.now();
  await db
    .prepare("UPDATE posts SET status = 'deleted', title = '', body = '', updated_at = ? WHERE id = ?")
    .bind(timestamp, post.id)
    .run();
  return { id: publicId, status: 'deleted' };
}

export async function updateReply(userId: string, publicId: string, body: string, regUserId?: string) {
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
  if (!isMine(reply.author_id, userId, regUserId)) throw new Error('NOT_CONTENT_AUTHOR');
  if (reply.author_id === regUserId) await assertRegisteredWritable(db, regUserId!);
  else await assertWritableUser(db, userId);
  if (reply.post_status !== 'published') throw new Error('POST_LOCKED');
  if (Date.now() - reply.created_at > EDIT_WINDOW_MS) throw new Error('EDIT_WINDOW_EXPIRED');

  await db
    .prepare('UPDATE replies SET body = ?, updated_at = ? WHERE id = ?')
    .bind(body, Date.now(), reply.id)
    .run();
  return { id: publicId };
}

export async function deleteReply(userId: string, publicId: string, regUserId?: string) {
  const db = getD1();
  const reply = await db
    .prepare('SELECT id, author_id, status FROM replies WHERE public_id = ? LIMIT 1')
    .bind(publicId)
    .first<{ id: string; author_id: string; status: string }>();
  if (!reply || reply.status === 'deleted') throw new Error('POST_NOT_FOUND');
  if (!isMine(reply.author_id, userId, regUserId)) throw new Error('NOT_CONTENT_AUTHOR');

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
  regUserId?: string,
) {
  const db = getD1();
  await assertWritableUser(db, userId);
  const table = targetType === 'post' ? 'posts' : 'replies';
  const target = await db
    .prepare(`SELECT id, author_id, up_count, down_count FROM ${table} WHERE public_id = ? AND status IN ('published', 'locked') LIMIT 1`)
    .bind(publicId)
    .first<{ id: string; author_id: string; up_count: number; down_count: number }>();
  if (!target) throw new Error('TARGET_NOT_FOUND');
  if (isMine(target.author_id, userId, regUserId)) throw new Error('CANNOT_VOTE_OWN_CONTENT');

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
  regUserId?: string,
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
    posts: postResult.results.map((post) => mapPost(post, tagMap.get(post.id) ?? [], userId, regUserId, null)),
  };
}

export async function listAnnouncements(boardSlug?: string, userId?: string) {
  await ensureSeedData();
  const db = getD1();
  const params: unknown[] = [Date.now(), Date.now()];
  let scopeSql = "WHERE a.status = 'published' AND a.scope = 'global' AND a.starts_at <= ? AND (a.ends_at IS NULL OR a.ends_at >= ?)";
  if (boardSlug) {
    scopeSql = "WHERE a.status = 'published' AND a.starts_at <= ? AND (a.ends_at IS NULL OR a.ends_at >= ?) AND (a.scope = 'global' OR (a.scope = 'board' AND a.board_id = (SELECT id FROM boards WHERE slug = ? AND status != 'hidden')))";
    params.push(boardSlug);
  }
  const result = await db
    .prepare(
      `SELECT a.id, a.scope, a.level, a.title, a.body, a.starts_at, a.ends_at, a.created_at,
              CASE WHEN d.id IS NULL THEN 0 ELSE 1 END AS is_read
       FROM announcements a
       LEFT JOIN announcement_dismissals d ON d.announcement_id = a.id AND d.user_id = ?
       ${scopeSql}
       ORDER BY a.created_at DESC LIMIT 10`,
    )
    .bind(userId ?? '__none__', ...params)
    .all<{
      id: string;
      scope: string;
      level: string;
      title: string;
      body: string;
      starts_at: number;
      ends_at: number | null;
      created_at: number;
      is_read: number;
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
    read: row.is_read === 1,
  }));
}

export async function markAnnouncementRead(userId: string, announcementId: string) {
  const db = getD1();
  await db
    .prepare(
      `INSERT OR IGNORE INTO announcement_dismissals (id, announcement_id, user_id, dismissed_at)
       VALUES (?, ?, ?, ?)`,
    )
    .bind(crypto.randomUUID(), announcementId, userId, Date.now())
    .run();
  return { read: true };
}

/** 管理端：发布公告（默认立即开始，可设置结束时间）。 */
export async function createAnnouncement(input: {
  title: string;
  body: string;
  level: 'info' | 'reminder' | 'warning' | 'urgent';
  endsAt: number | null;
}) {
  const db = getD1();
  const id = crypto.randomUUID();
  const now = Date.now();
  await db
    .prepare(
      `INSERT INTO announcements (id, scope, level, title, body, starts_at, ends_at, status, created_at)
       VALUES (?, 'global', ?, ?, ?, ?, ?, 'published', ?)`,
    )
    .bind(id, input.level, input.title, input.body, now, input.endsAt, now)
    .run();
  return { id, level: input.level, title: input.title, body: input.body, startsAt: now, endsAt: input.endsAt, status: 'published' };
}

export type SiteSettings = { name: string; shortName: string; description: string; primaryColor: string };

export async function getSiteSettings(): Promise<SiteSettings> {
  const row = await getD1().prepare('SELECT settings_json FROM site_settings ORDER BY version DESC LIMIT 1').first<{ settings_json: string }>();
  if (!row) return { name: '无名岛', shortName: '无名岛', description: '不需要真实身份的公开讨论社区。', primaryColor: '#d9ff57' };
  try { return JSON.parse(row.settings_json) as SiteSettings; } catch { return { name: '无名岛', shortName: '无名岛', description: '不需要真实身份的公开讨论社区。', primaryColor: '#d9ff57' }; }
}

export async function updateSiteSettings(input: SiteSettings) {
  const db = getD1();
  const current = await db.prepare('SELECT COALESCE(MAX(version), 0) AS version FROM site_settings').first<{ version: number }>();
  const version = Number(current?.version ?? 0) + 1;
  await db.prepare('INSERT INTO site_settings (id, version, settings_json, created_at) VALUES (?, ?, ?, ?)')
    .bind(`settings-v${version}`, version, JSON.stringify(input), Date.now()).run();
  return { ...input, version };
}

/** 管理端：全部公告与各自已读人数。 */
export async function listAllAnnouncements(): Promise<AdminAnnouncementRow[]> {
  const result = await getD1()
    .prepare(
      `SELECT a.id, a.scope, a.level, a.title, a.body, a.starts_at, a.ends_at, a.status, a.created_at,
              (SELECT COUNT(*) FROM announcement_dismissals d WHERE d.announcement_id = a.id) AS read_count
       FROM announcements a
       ORDER BY a.created_at DESC
       LIMIT 100`,
    )
    .all<{
      id: string;
      scope: string;
      level: string;
      title: string;
      body: string;
      starts_at: number;
      ends_at: number | null;
      status: string;
      created_at: number;
      read_count: number;
    }>();
  return result.results.map((row) => ({
    id: row.id,
    scope: row.scope,
    level: row.level,
    title: row.title,
    body: row.body,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    status: row.status,
    createdAt: row.created_at,
    readCount: Number(row.read_count),
  }));
}

/** 管理端：下架公告（新读者不再看到，历史已读保留）。 */
export async function archiveAnnouncement(announcementId: string) {
  const result = await getD1()
    .prepare("UPDATE announcements SET status = 'archived' WHERE id = ? AND status = 'published'")
    .bind(announcementId)
    .run();
  if (result.meta.changes === 0) throw new Error('POST_NOT_FOUND');
  return { archived: true };
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

export type AdminReportRow = {
  id: string;
  targetType: 'post' | 'reply';
  targetPublicId: string;
  targetTitle: string;
  reason: string;
  details: string;
  status: string;
  createdAt: number;
};

export async function listReports(): Promise<AdminReportRow[]> {
  const result = await getD1().prepare(`
    SELECT r.id, r.target_type, r.reason, COALESCE(r.details, '') AS details, r.status, r.created_at,
           CASE WHEN r.target_type = 'post' THEN p.public_id ELSE rp.public_id END AS target_public_id,
           CASE WHEN r.target_type = 'post' THEN p.title ELSE substr(rp.body, 1, 80) END AS target_title
    FROM reports r
    LEFT JOIN posts p ON r.target_type = 'post' AND r.target_id = p.id
    LEFT JOIN replies rp ON r.target_type = 'reply' AND r.target_id = rp.id
    ORDER BY CASE WHEN r.status = 'pending' THEN 0 ELSE 1 END, r.created_at DESC
    LIMIT 200
  `).all<{ id: string; target_type: string; target_public_id: string | null; target_title: string | null; reason: string; details: string; status: string; created_at: number }>();
  return result.results.filter((row) => row.target_public_id).map((row) => ({
    id: row.id,
    targetType: row.target_type as 'post' | 'reply',
    targetPublicId: row.target_public_id as string,
    targetTitle: row.target_title ?? '已删除内容',
    reason: row.reason,
    details: row.details,
    status: row.status,
    createdAt: row.created_at,
  }));
}

export async function reviewReport(reportId: string, status: 'resolved' | 'rejected', hideTarget: boolean) {
  const db = getD1();
  const report = await db.prepare('SELECT target_type, target_id FROM reports WHERE id = ? LIMIT 1').bind(reportId).first<{ target_type: string; target_id: string }>();
  if (!report) throw new Error('POST_NOT_FOUND');
  const table = report.target_type === 'post' ? 'posts' : 'replies';
  const statements: D1PreparedStatement[] = [db.prepare('UPDATE reports SET status = ? WHERE id = ?').bind(status, reportId)];
  if (hideTarget) statements.push(db.prepare(`UPDATE ${table} SET status = 'hidden', updated_at = ? WHERE id = ?`).bind(Date.now(), report.target_id));
  await db.batch(statements);
  return { reviewed: true, status, hidden: hideTarget };
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

export async function setAnonAvatar(userId: string, avatarSeed: string) {
  const result = await getD1()
    .prepare("UPDATE anonymous_users SET avatar_seed = ? WHERE id = ? AND status NOT IN ('deleted', 'deletion_pending')")
    .bind(avatarSeed, userId)
    .run();
  if (result.meta.changes === 0) throw new Error('POST_NOT_FOUND');
  return { avatarSeed };
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
