import { NextResponse } from 'next/server';

import { applySessionCookie, ensureAnonymousSession } from '@/server/auth/anonymous';
import { searchPosts } from '@/server/forum/service';
import { registeredAnonId } from '@/server/auth/registered';
import { jsonError } from '@/server/http';
import { requireRegisteredUser } from '@/server/auth/registered';

export async function GET(request: Request) {
  try {
    await requireRegisteredUser(request);
    const session = await ensureAnonymousSession(request);
    const url = new URL(request.url);
    const query = url.searchParams.get('q') ?? '';
    const boardSlug = url.searchParams.get('board') ?? undefined;
    const tag = url.searchParams.get('tag') ?? undefined;
    const regId = await registeredAnonId(request);
    const data = await searchPosts(session.userId, query, {
      boardSlug: boardSlug || undefined,
      tag: tag || undefined,
    }, regId ?? undefined);
    return applySessionCookie(NextResponse.json({ data, error: null }), session);
  } catch (error) {
    return jsonError(error);
  }
}
