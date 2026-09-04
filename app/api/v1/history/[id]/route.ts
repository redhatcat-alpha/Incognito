import { NextResponse } from 'next/server';

import { applySessionCookie, ensureAnonymousSession } from '@/server/auth/anonymous';
import { progressSchema } from '@/server/forum/schemas';
import { clearHistory, saveProgress } from '@/server/forum/service';
import { jsonError } from '@/server/http';
import { requireRegisteredUser } from '@/server/auth/registered';

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    await requireRegisteredUser(request);
    const session = await ensureAnonymousSession(request);
    const { id } = await context.params;
    const input = progressSchema.parse(await request.json());
    const data = await saveProgress(session.userId, id, input.maxReadFloor, input.anchorReplyId);
    return applySessionCookie(NextResponse.json({ data, error: null }), session);
  } catch (error) {
    return jsonError(error);
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    await requireRegisteredUser(request);
    const session = await ensureAnonymousSession(request);
    const { id } = await context.params;
    await clearHistory(session.userId, id);
    return applySessionCookie(NextResponse.json({ data: { deleted: true }, error: null }), session);
  } catch (error) {
    return jsonError(error);
  }
}
