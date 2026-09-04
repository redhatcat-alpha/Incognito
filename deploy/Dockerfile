# syntax=docker/dockerfile:1
# 无名岛（Incognito）本地/自托管预览镜像。
# 说明：本项目面向 Cloudflare Workers + D1 部署；该镜像在容器内以 wrangler
# （workerd）本地模式运行 dist/ 产物 + 本地 D1，便于无 Cloudflare 账号时体验
# 完整功能。生产部署请走 Cloudflare 通道（见 README「部署到 Cloudflare」）。

FROM node:22-slim AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
# 生产构建：产物输出到 dist/（含 dist/server/wrangler.json 与 dist/client）
RUN npm run build

FROM node:22-slim AS runtime

ENV NODE_ENV=production
ENV WRANGLER_LOG_PATH=/tmp/wrangler.logs

WORKDIR /app

# 运行时依赖（含 devDependencies 中的 wrangler）整体复制，避免二次安装漂移
COPY --from=build /app/package.json /app/package-lock.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
# 迁移文件保留在镜像内，方便容器里执行 drizzle 迁移
COPY --from=build /app/drizzle ./drizzle

EXPOSE 3000

# wrangler dev 默认即本地(Miniflare)模式；--ip 0.0.0.0 允许容器外访问
# D1 状态落在 /app/.wrangler/state（compose 中以匿名卷持久化）
CMD ["node_modules/.bin/wrangler", "dev", "--config", "dist/server/wrangler.json", "--ip", "0.0.0.0", "--port", "3000"]
