import { NextResponse } from 'next/server';

import { applySessionCookie, ensureAnonymousSession } from '@/server/auth/anonymous';
import { clearHistory, listHistory } from '@/server/forum/service';
import { jsonError } from '@/server/http';
import { requireRegisteredUser } from '@/server/auth/registered';

export async function GET(request: Request) {
  try {
    await requireRegisteredUser(request);
    const session = await ensureAnonymousSession(request);
    const data = await listHistory(session.userId);
    return applySessionCookie(NextResponse.json({ data, error: null }), session);
  } catch (error) {
    return jsonError(error);
  }
}

export async function DELETE(request: Request) {
  try {
    await requireRegisteredUser(request);
    const session = await ensureAnonymousSession(request);
    await clearHistory(session.userId);
    return applySessionCookie(NextResponse.json({ data: { cleared: true }, error: null }), session);
  } catch (error) {
    return jsonError(error);
  }
}
