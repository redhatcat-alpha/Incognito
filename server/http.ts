import { NextResponse } from 'next/server';
import { ZodError } from 'zod';

const safeErrors: Record<string, { status: number; message: string }> = {
  RATE_LIMITED: { status: 429, message: '操作太频繁，请稍后再试' },
  BOARD_SLUG_EXISTS: { status: 409, message: '板块 slug 已存在' },
  BOARD_NOT_FOUND: { status: 404, message: '板块不存在或暂不可用' },
  POST_NOT_FOUND: { status: 404, message: '帖子不存在' },
  POST_LOCKED: { status: 409, message: '帖子已锁定，暂时不能回复' },
  BOARD_READONLY: { status: 403, message: '板块处于只读或归档状态，暂不接受新内容' },
  TARGET_NOT_FOUND: { status: 404, message: '内容不存在或不可操作' },
  CANNOT_VOTE_OWN_CONTENT: { status: 409, message: '不能给自己发布的内容投票' },
  CANNOT_REPORT_OWN: { status: 409, message: '不能举报自己发布的内容' },
  REPORT_EXISTS: { status: 409, message: '你已经举报过这条内容，我们会尽快处理' },
  NOT_CONTENT_AUTHOR: { status: 403, message: '只能操作自己发布的内容' },
  EDIT_WINDOW_EXPIRED: { status: 403, message: '内容发布已超过 30 分钟，不再允许编辑' },
  USER_NOT_WRITABLE: { status: 403, message: '当前匿名账号暂时不能发言' },
  CANNOT_REVOKE_CURRENT: { status: 409, message: '不能撤销当前正在使用的会话，请使用“退出当前设备”' },
  INVALID_QUERY: { status: 400, message: '搜索关键词无效' },
  USERNAME_TAKEN: { status: 409, message: '这个用户名已经被注册了' },
  INVALID_CREDENTIALS: { status: 401, message: '用户名或密码不正确' },
  AUTH_REQUIRED: { status: 401, message: '请先登录后继续访问' },
  ACCOUNT_SUSPENDED: { status: 403, message: '该账号当前不可用，请联系管理员' },
};

export function jsonError(error: unknown) {
  if (error instanceof ZodError) {
    return NextResponse.json(
      { data: null, error: { code: 'VALIDATION_ERROR', message: error.issues[0]?.message ?? '提交内容不符合要求' } },
      { status: 400 },
    );
  }

  if (error instanceof Error && safeErrors[error.message]) {
    const known = safeErrors[error.message];
    return NextResponse.json(
      { data: null, error: { code: error.message, message: known.message } },
      { status: known.status },
    );
  }

  console.error('Unhandled API error', error);
  return NextResponse.json(
    { data: null, error: { code: 'INTERNAL_ERROR', message: '服务暂时不可用，请稍后重试' } },
    { status: 500 },
  );
}
