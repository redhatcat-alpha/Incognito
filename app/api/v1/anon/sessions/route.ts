import { NextResponse } from 'next/server';

import { applySessionCookie, currentSessionIdForRequest, ensureAnonymousSession } from '@/server/auth/anonymous';
import { listAnonSessions } from '@/server/forum/service';
import { jsonError } from '@/server/http';
import { requireRegisteredUser } from '@/server/auth/registered';

export async function GET(request: Request) {
  try {
    await requireRegisteredUser(request);
    const session = await ensureAnonymousSession(request);
    const [sessions, currentId] = await Promise.all([listAnonSessions(session.userId), currentSessionIdForRequest(request)]);
    return applySessionCookie(
      NextResponse.json({
        data: sessions.map((item) => ({ ...item, current: item.id === currentId })),
        error: null,
      }),
      session,
    );
  } catch (error) {
    return jsonError(error);
  }
}
