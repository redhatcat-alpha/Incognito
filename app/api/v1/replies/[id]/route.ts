import { NextResponse } from 'next/server';

import { applySessionCookie, ensureAnonymousSession } from '@/server/auth/anonymous';
import { editReplySchema } from '@/server/forum/schemas';
import { deleteReply, updateReply } from '@/server/forum/service';
import { jsonError } from '@/server/http';

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await ensureAnonymousSession(request);
    const { id } = await context.params;
    const input = editReplySchema.parse(await request.json());
    const data = await updateReply(session.userId, id, input.body);
    return applySessionCookie(NextResponse.json({ data, error: null }), session);
  } catch (error) {
    return jsonError(error);
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await ensureAnonymousSession(request);
    const { id } = await context.params;
    const data = await deleteReply(session.userId, id);
    return applySessionCookie(NextResponse.json({ data, error: null }), session);
  } catch (error) {
    return jsonError(error);
  }
}
