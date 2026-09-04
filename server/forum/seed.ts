import { getD1 } from '@/db';

const now = () => Date.now();

export async function ensureSeedData(): Promise<void> {
  const db = getD1();
  const marker = await db.prepare("SELECT id FROM boards WHERE id = 'board-tech' LIMIT 1").first();
  if (marker) return;

  const createdAt = now();
  const hour = 60 * 60 * 1000;

  await db.batch([
    db.prepare('INSERT OR IGNORE INTO anonymous_users (id, status, avatar_seed, created_at) VALUES (?, ?, ?, ?)').bind('seed-author-1', 'active', 'coral-orbit', createdAt),
    db.prepare('INSERT OR IGNORE INTO anonymous_users (id, status, avatar_seed, created_at) VALUES (?, ?, ?, ?)').bind('seed-author-2', 'active', 'blue-grid', createdAt),
    db.prepare('INSERT OR IGNORE INTO anonymous_users (id, status, avatar_seed, created_at) VALUES (?, ?, ?, ?)').bind('seed-author-3', 'active', 'lime-wave', createdAt),

    db.prepare('INSERT OR IGNORE INTO boards (id, slug, name, description, icon, accent, status, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').bind('board-tucao', 'tucao', '闲时吐槽', '生活、工作和那些不吐不快的小事', 'message-circle', '#ff795b', 'active', 10, createdAt, createdAt),
    db.prepare('INSERT OR IGNORE INTO boards (id, slug, name, description, icon, accent, status, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').bind('board-tech', 'tech', '技术分享', '代码、产品、工具与踩坑记录', 'code', '#43a5ff', 'active', 20, createdAt, createdAt),
    db.prepare('INSERT OR IGNORE INTO boards (id, slug, name, description, icon, accent, status, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').bind('board-trending', 'trending', '热点八卦', '正在发生的事，以及大家怎么想', 'flame', '#d9ff57', 'active', 30, createdAt, createdAt),

    db.prepare('INSERT OR IGNORE INTO tags (id, slug, name, color, status) VALUES (?, ?, ?, ?, ?)').bind('tag-work', 'work', '职场', '#ff795b', 'active'),
    db.prepare('INSERT OR IGNORE INTO tags (id, slug, name, color, status) VALUES (?, ?, ?, ?, ?)').bind('tag-sqlite', 'sqlite', 'SQLite', '#43a5ff', 'active'),
    db.prepare('INSERT OR IGNORE INTO tags (id, slug, name, color, status) VALUES (?, ?, ?, ?, ?)').bind('tag-backend', 'backend', '后端', '#43a5ff', 'active'),
    db.prepare('INSERT OR IGNORE INTO tags (id, slug, name, color, status) VALUES (?, ?, ?, ?, ?)').bind('tag-chat', 'chat', '讨论', '#d9ff57', 'active'),

    db.prepare('INSERT OR IGNORE INTO posts (id, public_id, board_id, author_id, title, body, status, next_floor_no, up_count, down_count, reply_count, created_at, updated_at, last_replied_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').bind('post-remote', 'remote-work-is-changing', 'board-tucao', 'seed-author-1', '远程办公第三年，我开始怀念通勤了', '不是怀念挤地铁，是怀念下班路上那段真正属于自己的过渡时间。\n\n以前走出公司，到坐上地铁，再到家门口，这四十分钟会让工作慢慢从脑子里退场。现在电脑一合上，人还在原地，消息也还在继续响。\n\n大家有没有找到更好的“下班仪式”？', 'published', 4, 128, 7, 2, createdAt - hour, createdAt - hour, createdAt - 8 * 60 * 1000),
    db.prepare('INSERT OR IGNORE INTO posts (id, public_id, board_id, author_id, title, body, status, next_floor_no, up_count, down_count, reply_count, created_at, updated_at, last_replied_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').bind('post-sqlite', 'sqlite-production-notes', 'board-tech', 'seed-author-2', '把 SQLite 用在生产环境后，我重新理解了“够用”', '单机、WAL、备份和写锁并不可怕，可怕的是没有先定义负载边界。\n\n我们这个服务半年内从每天几百次写入长到几万次，真正先出问题的不是数据库，而是没有节制的统计任务。把写入合并、缩短事务、补好备份演练后，SQLite 仍然很稳。\n\n这不是“SQLite 能替代所有数据库”，而是提醒自己：先用数据描述负载，再选工具。', 'published', 5, 96, 3, 3, createdAt - 2 * hour, createdAt - 2 * hour, createdAt - 23 * 60 * 1000),
    db.prepare('INSERT OR IGNORE INTO posts (id, public_id, board_id, author_id, title, body, status, next_floor_no, up_count, down_count, reply_count, created_at, updated_at, last_replied_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').bind('post-launch', 'new-device-launch', 'board-trending', 'seed-author-3', '刚结束的发布会，真正值得聊的好像不是新品', '价格没什么意外，倒是台上反复强调的那几个词，可能透露了下一步的产品方向。\n\n比起硬件参数，我更在意他们把本地处理和隐私放到了几乎每一个演示里。这究竟是真方向，还是这一季的新叙事？', 'published', 3, 214, 11, 1, createdAt - 3 * hour, createdAt - 3 * hour, createdAt - 41 * 60 * 1000),

    db.prepare('INSERT OR IGNORE INTO post_tags (id, post_id, tag_id) VALUES (?, ?, ?)').bind('pt-remote-work', 'post-remote', 'tag-work'),
    db.prepare('INSERT OR IGNORE INTO post_tags (id, post_id, tag_id) VALUES (?, ?, ?)').bind('pt-sqlite-sqlite', 'post-sqlite', 'tag-sqlite'),
    db.prepare('INSERT OR IGNORE INTO post_tags (id, post_id, tag_id) VALUES (?, ?, ?)').bind('pt-sqlite-backend', 'post-sqlite', 'tag-backend'),
    db.prepare('INSERT OR IGNORE INTO post_tags (id, post_id, tag_id) VALUES (?, ?, ?)').bind('pt-launch-chat', 'post-launch', 'tag-chat'),

    db.prepare('INSERT OR IGNORE INTO thread_aliases (id, post_id, user_id, alias_index, avatar_seed) VALUES (?, ?, ?, ?, ?)').bind('alias-remote-op', 'post-remote', 'seed-author-1', 0, 'coral-orbit'),
    db.prepare('INSERT OR IGNORE INTO thread_aliases (id, post_id, user_id, alias_index, avatar_seed) VALUES (?, ?, ?, ?, ?)').bind('alias-remote-a1', 'post-remote', 'seed-author-2', 1, 'blue-grid'),
    db.prepare('INSERT OR IGNORE INTO thread_aliases (id, post_id, user_id, alias_index, avatar_seed) VALUES (?, ?, ?, ?, ?)').bind('alias-sqlite-op', 'post-sqlite', 'seed-author-2', 0, 'blue-grid'),
    db.prepare('INSERT OR IGNORE INTO thread_aliases (id, post_id, user_id, alias_index, avatar_seed) VALUES (?, ?, ?, ?, ?)').bind('alias-sqlite-a1', 'post-sqlite', 'seed-author-1', 1, 'coral-orbit'),
    db.prepare('INSERT OR IGNORE INTO thread_aliases (id, post_id, user_id, alias_index, avatar_seed) VALUES (?, ?, ?, ?, ?)').bind('alias-sqlite-a2', 'post-sqlite', 'seed-author-3', 2, 'lime-wave'),

    db.prepare('INSERT OR IGNORE INTO replies (id, public_id, post_id, author_id, floor_no, body, status, up_count, down_count, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').bind('reply-remote-2', 'remote-floor-2', 'post-remote', 'seed-author-2', 2, '我会在下班后固定绕小区走一圈，哪怕只有十五分钟。走回家才算真正下班。', 'published', 34, 1, createdAt - 35 * 60 * 1000, createdAt - 35 * 60 * 1000),
    db.prepare('INSERT OR IGNORE INTO replies (id, public_id, post_id, author_id, floor_no, body, status, up_count, down_count, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').bind('reply-remote-3', 'remote-floor-3', 'post-remote', 'seed-author-1', 3, '这个办法听起来不错。我现在的问题就是身体没有收到“已经结束”的信号。', 'published', 18, 0, createdAt - 8 * 60 * 1000, createdAt - 8 * 60 * 1000),
    db.prepare('INSERT OR IGNORE INTO replies (id, public_id, post_id, author_id, floor_no, body, status, up_count, down_count, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').bind('reply-sqlite-2', 'sqlite-floor-2', 'post-sqlite', 'seed-author-1', 2, '很赞同“先描述负载”。SQLite 最大的问题常常不是能力，而是团队误以为它完全不用运维。', 'published', 42, 2, createdAt - hour, createdAt - hour),
    db.prepare('INSERT OR IGNORE INTO replies (id, public_id, post_id, author_id, floor_no, body, status, up_count, down_count, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').bind('reply-sqlite-3', 'sqlite-floor-3', 'post-sqlite', 'seed-author-3', 3, '你们的备份恢复演练怎么做？会不会把 WAL 一起纳入检查？', 'published', 21, 0, createdAt - 40 * 60 * 1000, createdAt - 40 * 60 * 1000),
    db.prepare('INSERT OR IGNORE INTO replies (id, public_id, post_id, author_id, floor_no, body, status, up_count, down_count, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').bind('reply-sqlite-4', 'sqlite-floor-4', 'post-sqlite', 'seed-author-2', 4, '会，线上备份通过 SQLite Online Backup API 做一致性快照，恢复环境还会验证行数、关键聚合和随机内容哈希。', 'published', 29, 0, createdAt - 23 * 60 * 1000, createdAt - 23 * 60 * 1000),

    db.prepare('INSERT OR IGNORE INTO announcements (id, scope, level, title, body, starts_at, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').bind('notice-privacy', 'global', 'info', '保护你的匿名性', '发言前，请先抹去内容里的个人信息。', createdAt - 24 * hour, 'published', createdAt),
    db.prepare('INSERT OR IGNORE INTO site_settings (id, version, settings_json, created_at) VALUES (?, ?, ?, ?)').bind('settings-v1', 1, JSON.stringify({ name: '无名岛', shortName: '无名岛', description: '不需要真实身份的公开讨论社区。', primaryColor: '#d9ff57' }), createdAt),
  ]);
}
