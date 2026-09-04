# AGENTS.md

面向在此仓库工作的 AI/人类开发者的工程指南。产品需求以 [docs/PRD.md](docs/PRD.md) 为准。

## 项目是什么

匿名社区论坛「无名岛」（代号 Incognito）。核心技术：vinext（Vite + React Server Components 的 Next.js 兼容层）+ Cloudflare Workers（本地 Miniflare D1/SQLite）。

匿名语义（务必先理解再动手）：

- **假名化**：每个浏览器首次访问自动获得随机匿名账号（`anonymous_users`），服务端不存邮箱/手机/姓名/IP/UA。
- **线程内代号**：同一帖子内同一账号显示固定「匿名 A1/A2…」，楼主显示「楼主」；代号来自 `thread_aliases`，跨帖子不可直接关联。公开 DTO 永不返回内部 `user_id`。
- 内容删除是**软删除**（`status='deleted'`、清空标题/正文、楼层号不重排）；销毁身份 = 撤销全部会话 + 删历史/投票（并回滚目标计数）+ 内容转占位。

## 超级管理员（admin）

- `admin_users` / `admin_sessions` 独立于注册用户体系（PRD：管理员与匿名身份分离，不共会话）。模块：`server/auth/admin.ts`。
- 默认账号 `admin/admin123`（role `super_admin`）：`loginAdmin` 在每次登录前幂等种子（缺账号自动重建）。改默认密码流程：直接更新 `admin_users.pass_hash`（用 `hashPassword`）。
- 现有接口仅 `/api/v1/admin/login|logout|me`；管理控制台页面与内容治理 API 未实现。任何新的管理写操作必须校验 `getAdminUser(request)` 且记审计（见 PRD MOD-002）。

## 登录门槛（2026-09 起）

- 浏览与发言都要求登录：全部 `/api/v1/*` 内容路由在 `ensureAnonymousSession` 之前先 `requireRegisteredUser(request)`（未登录统一 401 `AUTH_REQUIRED`）。
- 客户端统一在 `ForumShell` 内做门槛：`useRegisteredUser` 未登录时 `router.replace('/login?next=…')`；登录页是独立页面 `/login`（不用 ForumShell，避免重定向环），登录成功后回跳 `next`。
- 匿名发言仍是“登录后的选项”：匿名身份（匿名 cookie 行）在登录后首次内容请求时自动创建；退出登录只清注册会话，匿名设备身份保留，但 API 门槛保证未登录无法读写。

## 账号与发言身份模型（重要）

- 游客永远可用（自动匿名账号）。用户可额外「注册」：`registered_users` 建一行账号，同时在同一 ID 空间建一行 `anonymous_users`（作为署名身份行），**posts/replies.author_id 外键零改动**。
- 写接口 body 带 `identity: 'anonymous' | 'registered'`；registered 需要独立登录会话（cookie `incognito_user_session`，见 `server/auth/registered.ts`；匿名会话仍自动存在）。
- 公开展示：署名行作者在帖子/楼层中显示 `username` + 唯一 ID（`uid`，随帖子响应 `authorName/authorUid`），不再分配「匿名 A1」代号；楼层 `isMine` 同时识别匿名会话与注册会话两种归属。
- 密码只存 PBKDF2-SHA256（`pbkdf2$iter$salt$hash`）。注册会话无 `/api/v1/auth/me` 返回用户 ID——公开层只有 username/uid/createdAt。
- 改这里前先读 `server/auth/registered.ts`、`server/forum/service.ts` 的 `resolveWriter / isMine / registeredNamesByIds`。

## 常用命令

```bash
npm run dev          # 本地开发 http://localhost:3000（首次请求自动写种子数据）
npm run build        # 生产构建 → dist/
npm start            # wrangler 本地运行 dist/ 产物
npm run lint         # oxlint（提交前必须 0 error）
npm run format       # oxfmt
npm run db:generate  # 修改 db/schema.ts 后生成迁移（drizzle/000N_*.sql）
npx tsc --noEmit     # 类型检查（提交前必须通过）
```

注意：`components/ui/*` 存在 19 条脚手架遗留 lint error（chart/button-group 等），**不要改动这些文件**；自己写的代码必须 lint/tsc 干净。

## 分层与依赖方向

```text
app/(pages)              # 页面：服务端页面文件只负责 metadata + 包一层 ForumShell
app/api/v1/**            # Route Handlers：鉴权会话 → zod 校验 → service → jsonError
server/forum/service.ts  # 领域服务（唯一读写 D1 的地方，除 auth）
server/auth/anonymous.ts # 匿名会话（cookie、token 哈希、撤销）
server/http.ts           # 响应信封 {data, error} 与稳定错误码表
components/forum/*       # 全部客户端组件；新页面复用 ForumShell / AnnouncementStrip
lib/*                    # 客户端可用的共享代码（类型、apiJson、常量）
db/schema.ts + drizzle/  # schema 与迁移（仅 SQLite/D1 方言）
```

规则：

- **客户端组件禁止 import `server/*`**；前后端共享常量/类型放 `lib/`（如 `lib/report-reasons.ts`、`lib/forum-types.ts`）。
- 页面结构：`app/xxx/page.tsx`（server，可 export metadata）→ `<ForumShell><XXView/></ForumShell>`；视图组件放 `components/forum/`。
- 请求一律走 `lib/api.ts` 的 `apiJson`（统一错误抛 `ApiError`，已带 credentials）。
- 读接口由 Server Components 直连领域服务也可，但现有页面均为客户端 fetch，保持风格一致优先。

## API 约定

- 响应信封：`{ data, error: { code, message } | null }`；错误只返回稳定错误码 + 安全文案。
- 新错误码：在 `server/http.ts` 的 `safeErrors` 注册；**不得**向前端泄漏内部 ID、堆栈、风控细节。
- 所有写路由：`ensureAnonymousSession(request)` 取 userId → `schemas.ts` zod parse → service → `applySessionCookie`（新会话需回写 Set-Cookie）。
- 用户状态守卫：service 内 `assertWritableUser`（read_only/suspended 不能发言、不能投票）。
- 时间一律 epoch 毫秒（UTC），展示层再格式化。

## 必须守住的业务规则（改代码前对照）

- 编辑时限：作者发布后 **30 分钟**内可编辑（服务端校验 `EDIT_WINDOW_EXPIRED`），删除不限时。
- 投票：一人一票靠 `votes(user_id, target_type, target_id)` 唯一约束；不能投自己；三态 none/up/down。
- 已读进度：`browsing_history` 每用户每帖一条；合并必须 `MAX(旧,新)` 单调；锚点取 `floor-{publicId}` 元素 id。
- 楼层号：**只**由“直接回复楼主”的层内容占用（`posts.next_floor_no`，删除不重排）；层内回复（带 `quote_reply_id`）`floor_no=0`，不推进计数、不占号（`replies` 已去掉 `(post_id,floor_no)` 唯一索引）。已读进度只按真实楼层统计。
- 富文本边界（2026-09 起 WYSIWYG）：主帖正文、层内容与层内回复（含各自的编辑）统一使用 `components/editor/rich-editor.tsx`（TipTap：加粗/斜体/删除线/行内代码/代码块/H2/H3/引用/列表/链接/贴吧表情/撤销重做）。层内回复同样可插入贴吧表情；其单行预览 `SubReplyRow` 用 `stripHtmlText` 剥标签，纯表情内容回退显示「[贴吧表情]」，展开详情完整渲染表情图。
- 内容存储：新正文为受限 HTML（schema 原始长度上限放宽为 60k/30k）；展示统一走 `components/forum/content-body.tsx`——`lib/rich-content.ts#isRichHtml` 为真走 DOMPurify 白名单渲染（`RichHtml`，img 仅放行 `/emoji/tieba/`），否则走旧 Markdown 渲染器（历史内容兼容）。编辑旧内容时 `mdToHtmlLight` 自动转换后保存为 HTML。摘要/计数用 `stripHtmlText/htmlTextLength`。
- 表情：注册表 `lib/tieba-emojis.ts`（id 列表须与 `public/emoji/tieba/` 文件一致）；WYSIWYG 中以 TipTap Image 节点插入，历史 Markdown 语法 `![贴吧表情 N](…)` 仍兼容；渲染只放行 `/emoji/tieba/` 前缀。
- 举报：同一账号对同一目标仅一条（唯一约束 → `REPORT_EXISTS`），不能举报自己。
- 隐私边界：日志/响应/审计不得出现 IP、UA、邮箱等；搜索词不进日志。
- 只读/归档板块与锁定帖子：禁止新内容（`BOARD_READONLY` / `POST_LOCKED`），仍可浏览。

## Schema 变更流程

1. 改 `db/schema.ts`（保持 SQLite 方言与既有风格：text 主键、integer 时间戳）。
2. `npm run db:generate` → 人工审查 `drizzle/000N_*.sql`。
3. 应用到本地 D1：`npx wrangler d1 execute DB --local --file=drizzle/000N_xxx.sql`
   （备选：直接 `sqlite3 .wrangler/state/v3/d1/miniflare-D1DatabaseObject/*.sqlite`，服务器运行中 WAL 也允许。）
4. 提示使用者：线上生产 D1 需执行同一文件。

## 测试现状

暂无自动化测试框架。验证手段：

- `npx tsc --noEmit` + `npm run lint`
- 本地 dev server + curl 冒烟：会话 cookie jar → 发帖 → 回帖/引用 → 投票切换 → 进度 PUT/GET → 搜索 → 编辑/删除（30 分钟窗内）→ 举报去重 → 同步开关 → 销毁身份
- 页面验证：http://localhost:3000 全页面走查（桌面 + 390px 移动端），注意无横向溢出、移动底栏四入口。

PRD 第 18 节列出了上线前应补齐的 Vitest/Playwright 与三库矩阵测试，属已知缺口。

## 已知缺口（不要误以为已实现）

管理后台 `/admin/*`、图片/头像/表情上传（R2）、恢复短语与 Passkey、列表分页（帖子页上限 200 楼层/列表 50）。实现前先读 PRD 对应条目与「23 节业务参数」。
