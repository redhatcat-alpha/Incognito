import { NextResponse } from 'next/server';

import { applySessionCookie, currentSessionIdForRequest, ensureAnonymousSession } from '@/server/auth/anonymous';
import { revokeAnonSession } from '@/server/forum/service';
import { jsonError } from '@/server/http';
import { requireRegisteredUser } from '@/server/auth/registered';

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    await requireRegisteredUser(request);
    const session = await ensureAnonymousSession(request);
    const { id } = await context.params;
    const currentId = await currentSessionIdForRequest(request);
    if (currentId === id) throw new Error('CANNOT_REVOKE_CURRENT');
    const data = await revokeAnonSession(session.userId, id);
    return applySessionCookie(NextResponse.json({ data, error: null }), session);
  } catch (error) {
    return jsonError(error);
  }
}
