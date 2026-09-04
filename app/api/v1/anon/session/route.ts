import { NextResponse } from 'next/server';

import { applySessionCookie, clearSessionCookie, ensureAnonymousSession, revokeSessionForRequest } from '@/server/auth/anonymous';
import { sessionPatchSchema } from '@/server/forum/schemas';
import { getAnonProfile, setHistorySync } from '@/server/forum/service';
import { jsonError } from '@/server/http';
import { requireRegisteredUser } from '@/server/auth/registered';

export async function GET(request: Request) {
  try {
    await requireRegisteredUser(request);
    const session = await ensureAnonymousSession(request);
    const profile = await getAnonProfile(session.userId);
    return applySessionCookie(NextResponse.json({ data: { profile }, error: null }), session);
  } catch (error) {
    return jsonError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    await requireRegisteredUser(request);
    const session = await ensureAnonymousSession(request);
    const input = sessionPatchSchema.parse(await request.json());
    const data = await setHistorySync(session.userId, input.historySyncEnabled);
    return applySessionCookie(NextResponse.json({ data, error: null }), session);
  } catch (error) {
    return jsonError(error);
  }
}

export async function DELETE(request: Request) {
  try {
    await requireRegisteredUser(request);
    const session = await ensureAnonymousSession(request);
    await revokeSessionForRequest(request);
    const response = NextResponse.json({ data: { loggedOut: true }, error: null });
    response.headers.append('Set-Cookie', clearSessionCookie(request));
    return applySessionCookie(response, session);
  } catch (error) {
    return jsonError(error);
  }
}
