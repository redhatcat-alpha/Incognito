import { NextResponse } from 'next/server';

import { applySessionCookie, ensureAnonymousSession } from '@/server/auth/anonymous';
import { deletePost, getThread, updatePost } from '@/server/forum/service';
import { registeredAnonId } from '@/server/auth/registered';
import { editPostSchema } from '@/server/forum/schemas';
import { jsonError } from '@/server/http';

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await ensureAnonymousSession(request);
    const { id } = await context.params;
    const regId = await registeredAnonId(request);
    const data = await getThread(id, session.userId, regId ?? undefined);
    if (!data) {
      return NextResponse.json(
        { data: null, error: { code: 'POST_NOT_FOUND', message: '帖子不存在' } },
        { status: 404 },
      );
    }
    return applySessionCookie(NextResponse.json({ data, error: null }), session);
  } catch (error) {
    return jsonError(error);
  }
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await ensureAnonymousSession(request);
    const { id } = await context.params;
    const input = editPostSchema.parse(await request.json());
    const regId = await registeredAnonId(request);
    const data = await updatePost(session.userId, id, input, regId ?? undefined);
    return applySessionCookie(NextResponse.json({ data, error: null }), session);
  } catch (error) {
    return jsonError(error);
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await ensureAnonymousSession(request);
    const { id } = await context.params;
    const regId = await registeredAnonId(request);
    const data = await deletePost(session.userId, id, regId ?? undefined);
    return applySessionCookie(NextResponse.json({ data, error: null }), session);
  } catch (error) {
    return jsonError(error);
  }
}
