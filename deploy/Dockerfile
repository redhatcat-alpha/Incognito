# syntax=docker/dockerfile:1

FROM node:22-slim AS build

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-slim AS runtime

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3000
ENV DATABASE_DRIVER=sqlite
ENV DATABASE_URL=/app/data/incognito.sqlite
ENV MEDIA_DIR=/app/data/media

WORKDIR /app
COPY --from=build /app/dist/standalone ./
COPY --from=build /app/drizzle ./drizzle

RUN mkdir -p /app/data/media
VOLUME ["/app/data"]
EXPOSE 3000

CMD ["node", "server.js"]
