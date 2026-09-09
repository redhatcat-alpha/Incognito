#!/usr/bin/env bash
set -Eeuo pipefail

# One-command non-Docker deployment for Linux.
# It installs npm dependencies when needed, validates/builds the app, applies
# migrations, creates only the administrator account, and starts the server.

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd -- "$SCRIPT_DIR/.." && pwd)"
cd "$ROOT_DIR"

PID_FILE="${PID_FILE:-data/incognito.pid}"
LOG_FILE="${LOG_FILE:-data/incognito.log}"

log() { printf '[incognito] %s\n' "$*"; }
die() { printf '[incognito] ERROR: %s\n' "$*" >&2; exit 1; }

usage() {
  cat <<'EOF'
用法：scripts/start-linux.sh [start|stop|restart|status]

默认 start 会执行：
  1. 检查 Linux、Node.js >= 22.13、npm
  2. 缺少 node_modules 时执行 npm ci
  3. 执行 TypeScript、Lint 和生产构建检查
  4. 执行 SQLite/PostgreSQL/MySQL 数据库迁移
  5. 仅初始化管理员账号（不会在此步骤写入论坛种子内容）
  6. 后台启动 dist/standalone/server.js，并等待健康检查

可用环境变量：
  DATABASE_DRIVER=sqlite|postgres|mysql
  DATABASE_URL=data/incognito.sqlite（或数据库连接串）
  MEDIA_DIR=data/media
  HOST=0.0.0.0
  PORT=3000
  ADMIN_USERNAME=admin
  ADMIN_PASSWORD=admin123
  SKIP_CHECKS=1                 跳过 lint、tsc 和 build（不建议首次部署使用）
  FORCE_NPM_INSTALL=1          每次启动前强制执行 npm ci
  PID_FILE=data/incognito.pid
  LOG_FILE=data/incognito.log
EOF
}

check_environment() {
  [[ "$(uname -s)" == "Linux" ]] || die '此脚本仅支持 Linux。'
  command -v node >/dev/null 2>&1 || die '未找到 Node.js，请安装 Node.js 22.13 或更高版本。'
  command -v npm >/dev/null 2>&1 || die '未找到 npm，请安装 npm。'
  node -e "const [major, minor] = process.versions.node.split('.').map(Number); if (major < 22 || major === 22 && minor < 13) process.exit(1)" \
    || die "Node.js 版本过低（当前 $(node -p 'process.versions.node')），需要 >= 22.13。"
  [[ -f package.json && -f package-lock.json ]] || die '请在项目根目录运行此脚本。'
}

load_environment() {
  if [[ -f .env ]]; then
    log '加载 .env 配置'
    set -a
    # shellcheck disable=SC1091
    source .env
    set +a
  fi
  export NODE_ENV="${NODE_ENV:-production}"
  export HOST="${HOST:-0.0.0.0}"
  export PORT="${PORT:-3000}"
  export DATABASE_DRIVER="${DATABASE_DRIVER:-sqlite}"
  export DATABASE_URL="${DATABASE_URL:-data/incognito.sqlite}"
  export MEDIA_DIR="${MEDIA_DIR:-data/media}"
  mkdir -p "$(dirname -- "$PID_FILE")" "$(dirname -- "$LOG_FILE")" "$MEDIA_DIR"
}

install_dependencies() {
  if [[ "${FORCE_NPM_INSTALL:-0}" == '1' || ! -d node_modules ]]; then
    log '安装 npm 依赖（npm ci）'
    npm ci
  else
    log '检测到 node_modules，跳过 npm ci（如需强制安装请设置 FORCE_NPM_INSTALL=1）'
  fi
}

validate_and_build() {
  if [[ "${SKIP_CHECKS:-0}" == '1' ]]; then
    log 'SKIP_CHECKS=1，跳过 lint、TypeScript 和生产构建检查'
    [[ -f dist/standalone/server.js ]] || die '找不到 dist/standalone/server.js，请取消 SKIP_CHECKS=1 后重新运行。'
    return
  fi
  log '执行 lint 检查'
  npm run lint
  log '执行 TypeScript 检查'
  npx tsc --noEmit
  log '构建生产 standalone 产物'
  npm run build
}

migrate_and_initialize_admin() {
  log "执行数据库迁移（driver=${DATABASE_DRIVER}）"
  if [[ -z "${ADMIN_PASSWORD:-}" ]]; then
    log '未设置 ADMIN_PASSWORD，将使用默认密码 admin123；首次登录后请立即修改。'
  fi
  npm run db:migrate
  log "初始化管理员账号（仅创建缺失账号，不重置已有密码）"
  node scripts/init-admin.mjs
}

read_pid() {
  [[ -f "$PID_FILE" ]] || return 1
  local pid
  pid="$(tr -d '[:space:]' < "$PID_FILE")"
  [[ "$pid" =~ ^[0-9]+$ ]] || return 1
  printf '%s' "$pid"
}

is_running() {
  local pid
  pid="$(read_pid 2>/dev/null || true)"
  [[ -n "$pid" ]] && kill -0 "$pid" 2>/dev/null
}

process_is_ours() {
  local pid="$1"
  [[ -r "/proc/$pid/cmdline" ]] || return 1
  tr '\0' ' ' < "/proc/$pid/cmdline" | grep -Fq 'dist/standalone/server.js'
}

start_server() {
  if is_running; then
    log "服务已在运行（PID $(read_pid)），日志：$LOG_FILE"
    return 0
  fi
  rm -f "$PID_FILE"
  log "后台启动服务（${HOST}:${PORT}）"
  nohup node dist/standalone/server.js >>"$LOG_FILE" 2>&1 < /dev/null &
  local pid=$!
  printf '%s\n' "$pid" > "$PID_FILE"

  for _ in {1..30}; do
    if ! kill -0 "$pid" 2>/dev/null; then
      tail -n 80 "$LOG_FILE" >&2 || true
      die '服务进程启动后退出，请检查日志。'
    fi
    if node -e "fetch('http://127.0.0.1:' + process.env.PORT + '/api/v1/boards').then((r) => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"; then
      log "服务已启动（PID ${pid}），访问：http://127.0.0.1:${PORT}"
      log "日志文件：$LOG_FILE"
      return 0
    fi
    sleep 1
  done
  log '进程仍在运行，但健康检查超时；请查看日志确认反向代理或端口配置。'
}

stop_server() {
  local pid
  pid="$(read_pid 2>/dev/null || true)"
  if [[ -z "$pid" ]]; then
    log '服务未运行（没有有效 PID 文件）'
    rm -f "$PID_FILE"
    return 0
  fi
  if ! kill -0 "$pid" 2>/dev/null; then
    log "PID $pid 已结束，清理 PID 文件"
    rm -f "$PID_FILE"
    return 0
  fi
  process_is_ours "$pid" || die "PID 文件指向的进程不是本项目服务，已拒绝停止（PID ${pid}）。"
  kill "$pid"
  for _ in {1..10}; do
    kill -0 "$pid" 2>/dev/null || break
    sleep 1
  done
  if kill -0 "$pid" 2>/dev/null; then
    log '服务未响应 TERM，发送 KILL'
    kill -KILL "$pid" 2>/dev/null || true
  fi
  rm -f "$PID_FILE"
  log '服务已停止'
}

status_server() {
  local pid
  pid="$(read_pid 2>/dev/null || true)"
  if [[ -n "$pid" ]] && kill -0 "$pid" 2>/dev/null; then
    log "服务运行中（PID ${pid}，端口 ${PORT}）"
    return 0
  fi
  log '服务未运行'
  return 1
}

command="${1:-start}"
case "$command" in
  start)
    check_environment
    load_environment
    install_dependencies
    validate_and_build
    migrate_and_initialize_admin
    start_server
    ;;
  stop)
    load_environment
    stop_server
    ;;
  restart)
    check_environment
    load_environment
    stop_server || true
    install_dependencies
    validate_and_build
    migrate_and_initialize_admin
    start_server
    ;;
  status)
    load_environment
    status_server
    ;;
  -h|--help|help)
    usage
    ;;
  *)
    usage >&2
    exit 2
    ;;
esac
