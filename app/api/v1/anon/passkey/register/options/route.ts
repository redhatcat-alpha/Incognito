import { NextResponse } from 'next/server';
import { applySessionCookie, ensureAnonymousSession } from '@/server/auth/anonymous';
import { beginPasskeyRegistration } from '@/server/auth/passkey';
import { jsonError } from '@/server/http';

export async function POST(request: Request) {
  try {
    const session = await ensureAnonymousSession(request);
    const data = await beginPasskeyRegistration(session.userId, request);
    return applySessionCookie(NextResponse.json({ data, error: null }), session);
  } catch (error) { return jsonError(error); }
}
