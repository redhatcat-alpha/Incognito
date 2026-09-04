import { NextResponse } from 'next/server';
import { applySessionCookie, ensureAnonymousSession } from '@/server/auth/anonymous';
import { createRecoveryPhrase } from '@/server/auth/recovery';
import { jsonError } from '@/server/http';

export async function POST(request: Request) {
  try { const session = await ensureAnonymousSession(request); const data = await createRecoveryPhrase(session.userId); return applySessionCookie(NextResponse.json({ data, error: null }, { status: 201 }), session); }
  catch (error) { return jsonError(error); }
}
