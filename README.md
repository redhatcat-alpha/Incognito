# 无名岛（Incognito）

> 匿名社区论坛 · 产品代号 Incognito
> 首发形态：响应式 Web（Cloudflare Workers + D1）
> 产品文档：[docs/PRD.md](docs/PRD.md)

「无名岛」是一个无需手机号、邮箱或注册即可使用的匿名讨论社区：首次访问自动获得匿名会话，浏览、发帖、回帖、投票和举报都可直接完成；登录页 `/login` 提供可选的固定用户名身份。每条帖子与回复可选「匿名发言」（同一帖子内显示随机代号 匿名 A1、A2…，跨帖不暴露固定身份）或「以用户名发言」（登录后才可用）。阅读位置自动保存，下次打开可一键续读。

匿名是假名化而非密码学匿名：浏览历史、投票与内容归属挂在服务端随机账号上，以便续读与治理；用户可以随时查看、关闭同步、清空或彻底销毁身份。

## ✨ 已实现功能（PRD P0 用户端）

- **匿名身份与会话**：首次访问自动创建；HttpOnly + SameSite=Lax 会话令牌（库中仅存哈希）；会话列表与撤销、退出当前设备、销毁身份（撤销全部会话、清除历史与投票、公开内容转删除占位并回滚投票计数）
- **可选固定身份**：`/login` 独立登录/注册页；注册无需邮箱/手机号，用户名 + 密码即获唯一 ID（#编号）。未登录访客仍可完整浏览和匿名发言
- **发言身份选择**：发帖与回复时可选「匿名发言」（帖内随机代号）或「以用户名发言」（跨帖展示固定用户名与 ID）；密码 PBKDF2 慢哈希存储、独立登录会话
- **板块与帖子**：全部板块目录 `/boards`、板块页 `/b/[slug]`（只读/归档态提示）、首页（最新/热门/未读）；发帖（标题 4–120 字、正文 20k、0–5 个标签）
- **帖子详情** `/t/[id]`：楼层与层内回复严格分层——楼层号只分配给直接回复楼主的层内容（1 楼=主帖，2、3…顺延），回复某层的“层内回复”不占楼号、折叠展示；主帖与层内容使用**所见即所得富文本编辑器**（加粗、斜体、删除线、行内代码、代码块、H2/H3、引用、列表、链接、**百度贴吧表情包**、撤销/重做）；层内回复**仅支持文字与贴吧表情包**（无其他格式），表情在折叠行内直接显示
  - 内容格式：新内容以**受限 HTML** 存储（TipTap 输出，标签/属性白名单），展示前经 DOMPurify 二次清洗、`<img>` 仅放行 `/emoji/tieba/` 本地路径；历史 Markdown 内容由旧渲染器兼容展示（编辑旧内容时会自动转换并保存为新格式）
  - 表情资源说明：104 个百度贴吧官方默认表情自托管于 `public/emoji/tieba/`；图片版权归百度所有，如需移除请删除目录并同步 `lib/tieba-emojis.ts`
- **投票**：点赞/点踩/取消/切换状态机，数据库唯一约束一人一票，不能投自己；乐观更新 + 服务端回写
- **阅读续接**：楼层锚点定位与高亮、「上次看到 N 楼 · 继续阅读」；IntersectionObserver 计算已读楼层，5 秒防抖 + 页面隐藏补发；单调合并，锚点被删自动回退
- **浏览历史** `/history`：最近阅读、进度条、未读提醒、单条删除与清空；可在隐私设置中关闭云端同步（关闭即清除服务端历史）
- **搜索** `/search`：标题与正文检索，板块/标签筛选，结果高亮
- **隐私与设置**：`/settings/profile`（匿名身份、设备会话、退出）、`/settings/privacy`（历史同步开关、清空历史、销毁身份、数据类别说明）
- **治理**：举报（七类原因、去重、防自举）、删除即占位、帖子/板块只读与锁定语义
- **公告系统**：管理员在 `/admin` 后台发布/下架公告（级别 公告/提示/提醒/紧急，可设结束时间，含已读人数统计）；用户端以弹窗展示未读公告，点击「我知道了，不再显示」后按账号持久化、不再弹出（铃铛可查历史并补标已读）
- **默认超级管理员**：`admin / admin123`（角色 `super_admin`，与普通注册用户分表分会话；管理控制台支持公告、站点设置、板块、标签与举报处理）。仅存 PBKDF2 哈希，**上线前必须修改默认密码**
- 匿名数据边界：不收集邮箱/手机号/姓名/IP/完整 UA/浏览器指纹；公开 API 永不返回内部账号 ID

## 🚀 本地开发

要求 Node.js ≥ 22.13。

```bash
npm install
npm run dev        # http://localhost:3000（首次访问自动写入种子板块/帖子）
```

常用命令：

| 命令 | 说明 |
| --- | --- |
| `npm run dev` | 本地开发（vinext + 本地 D1） |
| `npm run build` | 生产构建，产物输出到 `dist/` |
| `npm start` | 用 wrangler 以本地 workerd 运行 `dist/` 产物 |
| `npm run lint` / `npm run format` | oxlint / oxfmt |
| `npm run db:generate` | drizzle-kit 生成迁移（`drizzle/*.sql`） |

数据保存在本地 Miniflare D1（`.wrangler/state/`），属于本地文件，不入库。

### 数据库迁移

```bash
npm run db:generate                      # 修改 db/schema.ts 后生成迁移
# 本地 D1 应用迁移（示例）：
npx wrangler d1 execute DB --local --file=drizzle/0001_xxx.sql
```

## 🐳 容器预览（本地/自托管）

项目面向 Cloudflare Workers 部署；`deploy/` 提供容器化的本地预览方式（workerd + 本地 D1），方便在无 Cloudflare 账号的环境里体验：

```bash
docker compose -f deploy/docker-compose.yaml up --build
# 打开 http://localhost:3000
```

数据目录挂载在匿名卷 `.wrangler`（Miniflare D1 状态），重建容器不丢数据。

## ☁️ 部署到 Cloudflare

1. 准备 Cloudflare 账号与 D1 数据库：`wrangler d1 create incognito-db`
2. 将 `.openai/hosting.json` 中的 `d1`（当前 `DB`）指向真实数据库 ID；如需图片上传另配 R2（`FILES`）
3. 对线上 D1 执行迁移（`drizzle/0000_*.sql`、`drizzle/0001_*.sql`）
4. 构建并部署（vinext / wrangler 会使用托管配置）

> 注意：SQLite/D1 单实例适用于个人站与低流量；PRD 建议公共高并发部署使用 PostgreSQL/MySQL，仓库当前为 D1 方言（`db/schema.ts`），切换数据库属离线迁移，需另行引入方言层。

## 🗂 项目结构

```text
app/                    # Next.js App Router 页面与 /api/v1 路由
  api/v1/               # REST：posts/replies/votes/history/search/reports/announcements/boards/anon/*
  b/[slug] · t/[id] · boards · history · search · settings/* · rules
components/forum/       # 论坛 UI：壳层、首页、帖子详情、历史、搜索、设置等
components/ui/          # shadcn/base-ui 组件（脚手架）
db/                     # D1 schema 与连接
drizzle/                # 生成的迁移 SQL
server/
  auth/anonymous.ts     # 匿名会话（token 哈希、cookie、撤销）
  forum/service.ts      # 领域服务（论坛/投票/历史/搜索/举报/身份）
  forum/schemas.ts      # zod 校验（前后端共享常量见 lib/）
  forum/seed.ts         # 种子数据
  http.ts               # 响应信封与稳定错误码
lib/                    # 客户端 API、类型、格式化、共享常量
docs/PRD.md             # 产品需求文档 v1.0
deploy/                 # 容器化本地预览（Dockerfile / compose）
```

## 🧭 剩余路线（对照 PRD P0 缺口）

- 管理后台 `/admin/*`：公告、站点设置、板块、标签、举报队列、举报处理与审计日志已实现；表情管理仍需补齐
- 图片/头像上传已支持 R2、类型校验与 EXIF/元数据剥离；缩略图与后台处理队列仍待实现
- 恢复短语已实现；Passkey/WebAuthn 跨设备恢复仍待实现
- 帖子列表与单帖楼层均支持分页加载（楼层每页 200 条）；需继续进行极大线程性能压测
- PostgreSQL/MySQL 适配层与三数据库迁移/测试矩阵待实现

## 📜 许可与说明

代码与文档供学习与自托管使用。上线前请阅读 [docs/PRD.md](docs/PRD.md) 第 23 节：需由运营与合规确认服务地区法律、内容政策、删除周期等业务参数，方可宣称合规。
