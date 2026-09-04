import { NextResponse } from 'next/server';
import { z } from 'zod';

import { applySessionCookie, ensureAnonymousSession } from '@/server/auth/anonymous';
import { voteSchema } from '@/server/forum/schemas';
import { setVote } from '@/server/forum/service';
import { jsonError } from '@/server/http';

const targetTypeSchema = z.enum(['post', 'reply']);

export async function PUT(
  request: Request,
  context: { params: Promise<{ targetType: string; id: string }> },
) {
  try {
    const session = await ensureAnonymousSession(request);
    const params = await context.params;
    const targetType = targetTypeSchema.parse(params.targetType);
    const input = voteSchema.parse(await request.json());
    const data = await setVote(session.userId, targetType, params.id, input.value);
    return applySessionCookie(NextResponse.json({ data, error: null }), session);
  } catch (error) {
    return jsonError(error);
  }
}
