import { NextResponse } from 'next/server';

import { applySessionCookie, ensureAnonymousSession } from '@/server/auth/anonymous';
import { reportSchema } from '@/server/forum/schemas';
import { createReport } from '@/server/forum/service';
import { jsonError } from '@/server/http';
import { requireRegisteredUser } from '@/server/auth/registered';

export async function POST(request: Request) {
  try {
    await requireRegisteredUser(request);
    const session = await ensureAnonymousSession(request);
    const input = reportSchema.parse(await request.json());
    const data = await createReport(session.userId, input);
    return applySessionCookie(NextResponse.json({ data, error: null }, { status: 201 }), session);
  } catch (error) {
    return jsonError(error);
  }
}
