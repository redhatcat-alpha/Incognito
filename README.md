# 无名岛 · Incognito

> 一个不要求手机号、邮箱或实名注册的匿名社区论坛。

[![Node.js](https://img.shields.io/badge/Node.js-%E2%89%A522.13-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![Next.js compatible](https://img.shields.io/badge/Next.js-compatible-black?logo=next.js)](https://nextjs.org/)
[![Docker](https://img.shields.io/badge/Docker-ready-2496ED?logo=docker&logoColor=white)](https://www.docker.com/)
[![License](https://img.shields.io/badge/license-self--hosted-blue)](#许可)

无名岛（Incognito）是一个以隐私为优先的讨论社区。用户首次访问时自动获得随机匿名身份，无需注册即可浏览、发帖、回复、投票和举报；同时支持可选的用户名账号，用于跨设备恢复自己的发言身份。

## ✨ 功能

- **匿名访问**：自动创建匿名会话，服务端不保存邮箱、手机号、姓名、IP 或完整 User-Agent。
- **多板块论坛**：支持闲时吐槽、技术分享、热点八卦等板块，管理员可配置板块、标签、站点名称和 Logo。
- **帖子与楼层**：主帖、楼主、直接楼层和层内回复分层展示；层内回复不占用楼层号。
- **富文本与表情**：主帖和直接楼层支持所见即所得编辑器、代码块、引用、链接和贴吧表情；层内回复使用纯文字 + 表情模式。
- **互动能力**：点赞、点踩、取消投票、标签、头像、举报和软删除。
- **阅读续接**：自动保存浏览历史、已读楼层和锚点，下次打开帖子可继续阅读。
- **管理员后台**：公告、站点设置、板块、标签、举报队列、审计日志和内容状态管理。
- **可选注册账号**：用户名 + 密码注册，不影响匿名浏览和匿名发言；密码使用 PBKDF2-SHA256 存储。
- **媒体上传**：支持本地文件上传、所有权校验、类型校验和 EXIF/元数据剥离；数据库保存对象相对路径。

> 匿名身份是应用层的假名化设计，不等同于密码学匿名。为支持投票、历史同步和内容管理，服务端仍会保存随机账号关联的数据。详见 [PRD](docs/PRD.md)。

## 🧱 技术栈

- **应用**：Next.js App Router 兼容层（vinext）+ React 19 + TypeScript
- **运行时**：Node.js 22（Docker 可选）
- **数据库**：默认本地 SQLite；支持 PostgreSQL、MySQL 运行时驱动
- **数据访问**：Drizzle ORM、统一 SQL 兼容接口
- **编辑器**：Tiptap
- **样式与组件**：Tailwind CSS、Base UI、Lucide
- **对象存储**：本地文件系统（媒体路径记录在数据库中）

## 🚀 快速开始

### 环境要求

- Node.js `>=22.13.0`
- npm

### 安装与开发

```bash
git clone https://github.com/redhatcat-alpha/Incognito.git
cd Incognito
npm install
npm run dev
```

打开 <http://localhost:3000>。首次请求会自动初始化 SQLite 数据库并写入种子数据。

默认管理员账号：

```text
用户名：admin
密码：admin123
```

首次部署后请进入 `/admin`，在“修改管理员密码”区域立即修改默认密码。修改密码会撤销该管理员在其他设备上的会话。

## 🛠️ 常用命令

| 命令 | 用途 |
| --- | --- |
| `npm run dev` | 启动本地开发服务器 |
| `npm run build` | 构建生产产物到 `dist/` |
| `npm start` | 启动生产构建 |
| `npm run lint` | 执行 Oxlint |
| `npm run format` | 使用 Oxfmt 格式化代码 |
| `npm run test` | 运行单元测试 |
| `npm run test:smoke` | 运行 API 冒烟测试 |
| `npm run test:db-behavior` | 验证数据库行为和并发楼层分配 |
| `npm run db:generate` | 根据 schema 生成 Drizzle 迁移 |
| `npm run db:migrate` | 执行 PostgreSQL/MySQL 迁移 |

本地数据库默认位于 `data/incognito.sqlite`，媒体文件默认位于 `data/media/`；这两个目录都不应提交到 Git。

## 🗄️ 数据库配置

默认使用本地 SQLite。自托管环境可以通过环境变量选择 PostgreSQL 或 MySQL：

```bash
DATABASE_DRIVER=sqlite   # sqlite | postgres | mysql
DATABASE_URL=            # SQLite 文件路径，或 PostgreSQL/MySQL 连接串
MEDIA_DIR=data/media     # 本地媒体根目录
```

修改 [`db/schema.ts`](db/schema.ts) 后生成迁移：

```bash
npm run db:generate
```

数据库选择是部署级配置，不支持同一实例运行期间热切换。SQLite 适合本地开发、演示和低并发单实例；公共生产环境可根据规模选择 PostgreSQL 或 MySQL。

## 🐳 Docker 部署

项目使用 Docker 自托管，数据库和媒体文件通过 `/app/data` 持久化：

```bash
docker compose -f deploy/docker-compose.yaml up --build
```

打开 <http://localhost:3000>，首次部署后修改管理员默认密码。

停止服务但保留数据：`docker compose -f deploy/docker-compose.yaml down`。
删除容器及数据卷：`docker compose -f deploy/docker-compose.yaml down -v`。

## 🐧 Linux 直接部署（非 Docker）

服务器已安装 Node.js `22.13+` 和 npm 后，在项目根目录执行：

```bash
chmod +x scripts/start-linux.sh
./scripts/start-linux.sh
```

脚本会自动检查 Linux/Node/npm 环境；首次运行时执行 `npm ci`，然后进行 lint、TypeScript 和生产构建检查，执行数据库迁移，幂等初始化管理员账号，最后以后台进程启动 `dist/standalone/server.js`。默认使用 `data/incognito.sqlite` 和 `data/media/`，不会在“管理员初始化”步骤写入论坛种子内容。首次访问论坛时应用仍会按现有逻辑准备基础板块数据。

管理员初始化默认值为 `admin/admin123`。建议首次启动前通过环境变量设置：

```bash
ADMIN_USERNAME=admin \
ADMIN_PASSWORD='请替换为强密码' \
./scripts/start-linux.sh
```

也可以把这些变量放在项目根目录 `.env` 中。PostgreSQL/MySQL 示例：

```bash
DATABASE_DRIVER=postgres \
DATABASE_URL='postgres://user:password@127.0.0.1:5432/incognito' \
ADMIN_PASSWORD='请替换为强密码' \
./scripts/start-linux.sh
```

常用管理命令：

```bash
./scripts/start-linux.sh status   # 查看后台进程和端口
./scripts/start-linux.sh restart  # 重新检查、迁移、构建并启动
./scripts/start-linux.sh stop     # 停止当前脚本启动的进程
```

日志默认写入 `data/incognito.log`，PID 默认写入 `data/incognito.pid`。如需跳过检查（仅适合已完成构建的紧急重启），设置 `SKIP_CHECKS=1`；依赖变更后可设置 `FORCE_NPM_INSTALL=1` 强制执行 `npm ci`。

## 📁 项目结构

```text
app/                    # 页面与 /api/v1 路由
components/forum/       # 论坛 UI、帖子详情、历史和设置
components/admin/       # 管理后台 UI
db/                     # 数据库 schema 与连接
drizzle/                # 数据库迁移 SQL
server/auth/            # 匿名、注册用户和管理员会话
server/forum/           # 论坛领域服务与校验
lib/                    # 客户端 API、类型和共享常量
public/emoji/tieba/     # 自托管贴吧表情资源
scripts/                # 迁移、冒烟和数据库行为脚本
docs/PRD.md             # 完整产品需求文档
deploy/                 # 本地容器预览配置
```

## 🔐 隐私与内容安全边界

- 公开 DTO 不返回内部 `user_id`，线程内匿名代号跨帖子不可直接关联。
- 删除采用软删除，楼层号不会重排；销毁身份会撤销会话、清理历史与投票，并将公开内容转为占位内容。
- 所有富文本展示经过白名单过滤；图片仅允许本地贴吧表情路径。
- 投票、举报和楼层分配由服务端约束，不能投自己或重复举报同一目标。

## 🧪 提交前检查

```bash
npm run lint
npx tsc --noEmit
npm run build
npm run test
npm run test:smoke
```

## 📚 文档

- [产品需求文档（PRD）](docs/PRD.md)
- [工程约定](AGENTS.md)

## 🗺️ 当前状态

核心论坛、匿名会话、可选注册身份、投票、举报、历史续读、公告、管理后台、本地媒体上传和三种数据库驱动适配已实现。以下工作仍建议在正式上线前完成：真实设备上的 Passkey 验收、极大线程性能压测、三数据库完整迁移/并发矩阵，以及媒体缩略图和后台处理队列。

## 📜 许可

本项目当前未声明标准开源许可证，代码与文档用于学习和自托管。若要公开分发，请先补充许可证文件，并根据部署地区完成内容治理、隐私政策和数据删除周期审查。
