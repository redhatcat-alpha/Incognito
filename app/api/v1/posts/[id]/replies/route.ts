import { NextResponse } from 'next/server';

import { applySessionCookie, ensureAnonymousSession } from '@/server/auth/anonymous';
import { createReplySchema } from '@/server/forum/schemas';
import { createReply } from '@/server/forum/service';
import { registeredAnonId } from '@/server/auth/registered';
import { jsonError } from '@/server/http';

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await ensureAnonymousSession(request);
    const { id } = await context.params;
    const input = createReplySchema.parse(await request.json());
    const regId = input.identity === 'registered' ? await registeredAnonId(request) : undefined;
    const data = await createReply(session.userId, id, input.body, input.quoteReplyId, input.identity, regId ?? undefined);
    return applySessionCookie(NextResponse.json({ data, error: null }, { status: 201 }), session);
  } catch (error) {
    return jsonError(error);
  }
}
