import { NextResponse } from 'next/server';

import { applySessionCookie, ensureAnonymousSession } from '@/server/auth/anonymous';
import { createPostSchema } from '@/server/forum/schemas';
import { createPost, listForum } from '@/server/forum/service';
import { registeredAnonId } from '@/server/auth/registered';
import { jsonError } from '@/server/http';

export async function GET(request: Request) {
  try {
    const session = await ensureAnonymousSession(request);
    const url = new URL(request.url);
    const boardSlug = url.searchParams.get('board') ?? undefined;
    const sort = url.searchParams.get('sort') === 'hot' ? 'hot' : 'latest';
    const regId = await registeredAnonId(request);
    const data = await listForum(session.userId, boardSlug, sort, regId ?? undefined);
    return applySessionCookie(NextResponse.json({ data, error: null }), session);
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request) {
  try {
    const session = await ensureAnonymousSession(request);
    const input = createPostSchema.parse(await request.json());
    const regId = input.identity === 'registered' ? await registeredAnonId(request) : undefined;
    const data = await createPost(session.userId, input, input.identity, regId ?? undefined);
    return applySessionCookie(NextResponse.json({ data, error: null }, { status: 201 }), session);
  } catch (error) {
    return jsonError(error);
  }
}
