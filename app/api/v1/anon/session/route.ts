import { NextResponse } from 'next/server';

import { applySessionCookie, clearSessionCookie, ensureAnonymousSession, revokeSessionForRequest } from '@/server/auth/anonymous';
import { avatarPatchSchema, sessionPatchSchema } from '@/server/forum/schemas';
import { getAnonProfile, setAnonAvatar, setHistorySync } from '@/server/forum/service';
import { jsonError } from '@/server/http';

export async function GET(request: Request) {
  try {
    const session = await ensureAnonymousSession(request);
    const profile = await getAnonProfile(session.userId);
    return applySessionCookie(NextResponse.json({ data: { profile }, error: null }), session);
  } catch (error) {
    return jsonError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await ensureAnonymousSession(request);
    const input = (await request.json()) as Record<string, unknown>;
    const data = 'avatarSeed' in input
      ? await setAnonAvatar(session.userId, avatarPatchSchema.parse(input).avatarSeed)
      : await setHistorySync(session.userId, sessionPatchSchema.parse(input).historySyncEnabled);
    return applySessionCookie(NextResponse.json({ data, error: null }), session);
  } catch (error) {
    return jsonError(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const session = await ensureAnonymousSession(request);
    await revokeSessionForRequest(request);
    const response = NextResponse.json({ data: { loggedOut: true }, error: null });
    response.headers.append('Set-Cookie', clearSessionCookie(request));
    return applySessionCookie(response, session);
  } catch (error) {
    return jsonError(error);
  }
}
