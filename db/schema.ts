import { index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

export const anonymousUsers = sqliteTable('anonymous_users', {
  id: text('id').primaryKey(),
  status: text('status').notNull().default('active'),
  avatarSeed: text('avatar_seed').notNull(),
  historySyncEnabled: integer('history_sync_enabled').notNull().default(1),
  createdAt: integer('created_at').notNull(),
  deletionRequestedAt: integer('deletion_requested_at'),
});

export const anonymousSessions = sqliteTable(
  'anonymous_sessions',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull().references(() => anonymousUsers.id),
    tokenHash: text('token_hash').notNull(),
    expiresAt: integer('expires_at').notNull(),
    createdAt: integer('created_at').notNull(),
    lastUsedAt: integer('last_used_at').notNull(),
    revokedAt: integer('revoked_at'),
  },
  (table) => [
    uniqueIndex('uq_anonymous_sessions_token_hash').on(table.tokenHash),
    index('idx_anonymous_sessions_user_id').on(table.userId),
  ],
);

export const anonymousRecoveries = sqliteTable(
  'anonymous_recoveries',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull().references(() => anonymousUsers.id),
    phraseHash: text('phrase_hash').notNull(),
    createdAt: integer('created_at').notNull(),
    revokedAt: integer('revoked_at'),
  },
  (table) => [uniqueIndex('uq_anonymous_recoveries_hash').on(table.phraseHash), index('idx_anonymous_recoveries_user').on(table.userId)],
);

export const passkeyCredentials = sqliteTable(
  'passkey_credentials',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull().references(() => anonymousUsers.id),
    credentialId: text('credential_id').notNull(),
    publicKey: text('public_key').notNull(),
    signCount: integer('sign_count').notNull().default(0),
    createdAt: integer('created_at').notNull(),
    lastUsedAt: integer('last_used_at'),
    revokedAt: integer('revoked_at'),
  },
  (table) => [uniqueIndex('uq_passkey_credential_id').on(table.credentialId), index('idx_passkey_user').on(table.userId)],
);

export const passkeyChallenges = sqliteTable(
  'passkey_challenges',
  {
    id: text('id').primaryKey(),
    challenge: text('challenge').notNull(),
    userId: text('user_id').references(() => anonymousUsers.id),
    purpose: text('purpose').notNull(),
    expiresAt: integer('expires_at').notNull(),
    createdAt: integer('created_at').notNull(),
  },
  (table) => [index('idx_passkey_challenge_expiry').on(table.expiresAt)],
);

export const emojiSettings = sqliteTable(
  'emoji_settings',
  {
    emojiId: integer('emoji_id').primaryKey(),
    status: text('status').notNull().default('active'),
    updatedAt: integer('updated_at').notNull(),
  },
  (table) => [index('idx_emoji_settings_status').on(table.status)],
);

/**
 * 注册账号。id 与 anonymous_users 共享同一 ID 空间：注册时同时创建一行
 * anonymous_users 作为“署名身份”，其发布内容以 username 展示而非匿名代号。
 * 这样 posts/replies.author_id 的外键约束不需要任何改动。
 */
export const registeredUsers = sqliteTable(
  'registered_users',
  {
    id: text('id').primaryKey().references(() => anonymousUsers.id),
    uid: integer('uid').notNull(),
    username: text('username').notNull(),
    passHash: text('pass_hash').notNull(),
    status: text('status').notNull().default('active'),
    createdAt: integer('created_at').notNull(),
  },
  (table) => [
    uniqueIndex('uq_registered_users_uid').on(table.uid),
    uniqueIndex('uq_registered_users_username').on(table.username),
  ],
);

export const registeredSessions = sqliteTable(
  'registered_sessions',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull().references(() => registeredUsers.id),
    tokenHash: text('token_hash').notNull(),
    expiresAt: integer('expires_at').notNull(),
    createdAt: integer('created_at').notNull(),
    lastUsedAt: integer('last_used_at').notNull(),
    revokedAt: integer('revoked_at'),
  },
  (table) => [
    uniqueIndex('uq_registered_sessions_token_hash').on(table.tokenHash),
    index('idx_registered_sessions_user_id').on(table.userId),
  ],
);

export const boards = sqliteTable(
  'boards',
  {
    id: text('id').primaryKey(),
    slug: text('slug').notNull(),
    name: text('name').notNull(),
    description: text('description').notNull(),
    icon: text('icon').notNull().default('message-circle'),
    accent: text('accent').notNull().default('#d9ff57'),
    status: text('status').notNull().default('active'),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull(),
  },
  (table) => [
    uniqueIndex('uq_boards_slug').on(table.slug),
    index('idx_boards_status_sort_order').on(table.status, table.sortOrder),
  ],
);

export const posts = sqliteTable(
  'posts',
  {
    id: text('id').primaryKey(),
    publicId: text('public_id').notNull(),
    boardId: text('board_id').notNull().references(() => boards.id),
    authorId: text('author_id').notNull().references(() => anonymousUsers.id),
    title: text('title').notNull(),
    body: text('body').notNull(),
    status: text('status').notNull().default('published'),
    nextFloorNo: integer('next_floor_no').notNull().default(2),
    upCount: integer('up_count').notNull().default(0),
    downCount: integer('down_count').notNull().default(0),
    replyCount: integer('reply_count').notNull().default(0),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull(),
    lastRepliedAt: integer('last_replied_at').notNull(),
  },
  (table) => [
    uniqueIndex('uq_posts_public_id').on(table.publicId),
    index('idx_posts_board_status_last_reply').on(table.boardId, table.status, table.lastRepliedAt),
    index('idx_posts_status_created_at').on(table.status, table.createdAt),
  ],
);

export const replies = sqliteTable(
  'replies',
  {
    id: text('id').primaryKey(),
    publicId: text('public_id').notNull(),
    postId: text('post_id').notNull().references(() => posts.id),
    authorId: text('author_id').notNull().references(() => anonymousUsers.id),
    // 楼层号：仅“直接回复楼主”的层内容占用（2、3、4…）；层内回复恒为 0
    floorNo: integer('floor_no').notNull().default(0),
    body: text('body').notNull(),
    quoteReplyId: text('quote_reply_id'),
    status: text('status').notNull().default('published'),
    upCount: integer('up_count').notNull().default(0),
    downCount: integer('down_count').notNull().default(0),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull(),
  },
  (table) => [
    uniqueIndex('uq_replies_public_id').on(table.publicId),
    index('idx_replies_post_status_floor').on(table.postId, table.status, table.floorNo),
  ],
);

/** Upload intents keep media ownership and lifecycle state in the database. */
export const mediaUploads = sqliteTable(
  'media_uploads',
  {
    id: text('id').primaryKey(),
    ownerId: text('owner_id').notNull().references(() => anonymousUsers.id),
    objectKey: text('object_key').notNull(),
    contentType: text('content_type').notNull(),
    extension: text('extension').notNull(),
    size: integer('size').notNull().default(0),
    status: text('status').notNull().default('pending'),
    createdAt: integer('created_at').notNull(),
    expiresAt: integer('expires_at').notNull(),
    completedAt: integer('completed_at'),
  },
  (table) => [
    index('idx_media_uploads_owner_created').on(table.ownerId, table.createdAt),
    index('idx_media_uploads_status_expiry').on(table.status, table.expiresAt),
  ],
);

export const threadAliases = sqliteTable(
  'thread_aliases',
  {
    id: text('id').primaryKey(),
    postId: text('post_id').notNull().references(() => posts.id),
    userId: text('user_id').notNull().references(() => anonymousUsers.id),
    aliasIndex: integer('alias_index').notNull(),
    avatarSeed: text('avatar_seed').notNull(),
  },
  (table) => [
    uniqueIndex('uq_thread_aliases_post_user').on(table.postId, table.userId),
    uniqueIndex('uq_thread_aliases_post_index').on(table.postId, table.aliasIndex),
  ],
);

export const tags = sqliteTable(
  'tags',
  {
    id: text('id').primaryKey(),
    slug: text('slug').notNull(),
    name: text('name').notNull(),
    color: text('color').notNull().default('#d9ff57'),
    status: text('status').notNull().default('active'),
  },
  (table) => [uniqueIndex('uq_tags_slug').on(table.slug)],
);

export const postTags = sqliteTable(
  'post_tags',
  {
    id: text('id').primaryKey(),
    postId: text('post_id').notNull().references(() => posts.id),
    tagId: text('tag_id').notNull().references(() => tags.id),
  },
  (table) => [uniqueIndex('uq_post_tags_post_tag').on(table.postId, table.tagId)],
);

export const votes = sqliteTable(
  'votes',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull().references(() => anonymousUsers.id),
    targetType: text('target_type').notNull(),
    targetId: text('target_id').notNull(),
    value: integer('value').notNull(),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull(),
  },
  (table) => [
    uniqueIndex('uq_votes_user_target').on(table.userId, table.targetType, table.targetId),
    index('idx_votes_target').on(table.targetType, table.targetId),
  ],
);

export const browsingHistory = sqliteTable(
  'browsing_history',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull().references(() => anonymousUsers.id),
    postId: text('post_id').notNull().references(() => posts.id),
    maxReadFloor: integer('max_read_floor').notNull().default(1),
    anchorReplyId: text('anchor_reply_id'),
    lastViewedAt: integer('last_viewed_at').notNull(),
  },
  (table) => [
    uniqueIndex('uq_browsing_history_user_post').on(table.userId, table.postId),
    index('idx_browsing_history_user_last_viewed').on(table.userId, table.lastViewedAt),
  ],
);

export const announcements = sqliteTable('announcements', {
  id: text('id').primaryKey(),
  scope: text('scope').notNull().default('global'),
  boardId: text('board_id'),
  level: text('level').notNull().default('info'),
  title: text('title').notNull(),
  body: text('body').notNull(),
  startsAt: integer('starts_at').notNull(),
  endsAt: integer('ends_at'),
  status: text('status').notNull().default('published'),
  createdAt: integer('created_at').notNull(),
});

export const reports = sqliteTable(
  'reports',
  {
    id: text('id').primaryKey(),
    reporterId: text('reporter_id').notNull().references(() => anonymousUsers.id),
    targetType: text('target_type').notNull(),
    targetId: text('target_id').notNull(),
    reason: text('reason').notNull(),
    details: text('details'),
    status: text('status').notNull().default('pending'),
    createdAt: integer('created_at').notNull(),
    resolvedAt: integer('resolved_at'),
  },
  (table) => [
    uniqueIndex('uq_reports_reporter_target').on(table.reporterId, table.targetType, table.targetId),
    index('idx_reports_status_created').on(table.status, table.createdAt),
  ],
);

export const siteSettings = sqliteTable('site_settings', {
  id: text('id').primaryKey(),
  version: integer('version').notNull(),
  settingsJson: text('settings_json').notNull(),
  createdAt: integer('created_at').notNull(),
});

/** 管理员账号，与普通注册用户完全分离（独立表、独立会话）。 */
export const adminUsers = sqliteTable(
  'admin_users',
  {
    id: text('id').primaryKey(),
    username: text('username').notNull(),
    passHash: text('pass_hash').notNull(),
    role: text('role').notNull().default('admin'),
    status: text('status').notNull().default('active'),
    createdAt: integer('created_at').notNull(),
  },
  (table) => [uniqueIndex('uq_admin_users_username').on(table.username)],
);

export const adminSessions = sqliteTable(
  'admin_sessions',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull().references(() => adminUsers.id),
    tokenHash: text('token_hash').notNull(),
    expiresAt: integer('expires_at').notNull(),
    createdAt: integer('created_at').notNull(),
    lastUsedAt: integer('last_used_at').notNull(),
    revokedAt: integer('revoked_at'),
  },
  (table) => [
    uniqueIndex('uq_admin_sessions_token_hash').on(table.tokenHash),
    index('idx_admin_sessions_user_id').on(table.userId),
  ],
);

/** 管理写操作审计；仅保存动作与目标标识，不记录请求 IP、UA 或正文。 */
export const adminAuditLogs = sqliteTable(
  'admin_audit_logs',
  {
    id: text('id').primaryKey(),
    adminUserId: text('admin_user_id').notNull().references(() => adminUsers.id),
    action: text('action').notNull(),
    targetType: text('target_type'),
    targetId: text('target_id'),
    metadataJson: text('metadata_json'),
    createdAt: integer('created_at').notNull(),
  },
  (table) => [index('idx_admin_audit_created').on(table.createdAt), index('idx_admin_audit_admin').on(table.adminUserId)],
);

/** 公告“已读”状态按匿名身份记录，浏览无需注册；注册身份仍可复用同一行。 */
export const announcementDismissals = sqliteTable(
  'announcement_dismissals',
  {
    id: text('id').primaryKey(),
    announcementId: text('announcement_id').notNull().references(() => announcements.id),
    userId: text('user_id').notNull().references(() => anonymousUsers.id),
    dismissedAt: integer('dismissed_at').notNull(),
  },
  (table) => [
    uniqueIndex('uq_announcement_dismissals').on(table.announcementId, table.userId),
    index('idx_announcement_dismissals_user').on(table.userId, table.dismissedAt),
  ],
);
