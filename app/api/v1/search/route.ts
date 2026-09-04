import { NextResponse } from 'next/server';

import { applySessionCookie, ensureAnonymousSession } from '@/server/auth/anonymous';
import { searchPosts } from '@/server/forum/service';
import { jsonError } from '@/server/http';

export async function GET(request: Request) {
  try {
    const session = await ensureAnonymousSession(request);
    const url = new URL(request.url);
    const query = url.searchParams.get('q') ?? '';
    const boardSlug = url.searchParams.get('board') ?? undefined;
    const tag = url.searchParams.get('tag') ?? undefined;
    const data = await searchPosts(session.userId, query, {
      boardSlug: boardSlug || undefined,
      tag: tag || undefined,
    });
    return applySessionCookie(NextResponse.json({ data, error: null }), session);
  } catch (error) {
    return jsonError(error);
  }
}
