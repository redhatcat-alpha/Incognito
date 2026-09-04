import { NextResponse } from 'next/server';

import { applySessionCookie, ensureAnonymousSession } from '@/server/auth/anonymous';
import { listBoards } from '@/server/forum/service';
import { jsonError } from '@/server/http';

export async function GET(request: Request) {
  try {
    const session = await ensureAnonymousSession(request);
    const data = await listBoards();
    return applySessionCookie(NextResponse.json({ data, error: null }), session);
  } catch (error) {
    return jsonError(error);
  }
}
