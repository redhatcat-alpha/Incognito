import { NextResponse } from 'next/server';

import { applySessionCookie, ensureAnonymousSession } from '@/server/auth/anonymous';
import { createPostSchema } from '@/server/forum/schemas';
import { createPost, listForum } from '@/server/forum/service';
import { jsonError } from '@/server/http';

export async function GET(request: Request) {
  try {
    const session = await ensureAnonymousSession(request);
    const url = new URL(request.url);
    const boardSlug = url.searchParams.get('board') ?? undefined;
    const sort = url.searchParams.get('sort') === 'hot' ? 'hot' : 'latest';
    const data = await listForum(session.userId, boardSlug, sort);
    return applySessionCookie(NextResponse.json({ data, error: null }), session);
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request) {
  try {
    const session = await ensureAnonymousSession(request);
    const input = createPostSchema.parse(await request.json());
    const data = await createPost(session.userId, input);
    return applySessionCookie(NextResponse.json({ data, error: null }, { status: 201 }), session);
  } catch (error) {
    return jsonError(error);
  }
}
