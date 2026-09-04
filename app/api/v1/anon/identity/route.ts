import { NextResponse } from 'next/server';

import { applySessionCookie, clearSessionCookie, ensureAnonymousSession } from '@/server/auth/anonymous';
import { destroyAnonIdentity } from '@/server/forum/service';
import { jsonError } from '@/server/http';
import { requireRegisteredUser } from '@/server/auth/registered';

export async function DELETE(request: Request) {
  try {
    await requireRegisteredUser(request);
    const session = await ensureAnonymousSession(request);
    const data = await destroyAnonIdentity(session.userId);
    const response = NextResponse.json({ data, error: null });
    response.headers.append('Set-Cookie', clearSessionCookie(request));
    return applySessionCookie(response, session);
  } catch (error) {
    return jsonError(error);
  }
}
