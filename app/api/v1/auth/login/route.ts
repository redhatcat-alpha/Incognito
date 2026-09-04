import { NextResponse } from 'next/server';

import { loginSchema } from '@/server/forum/schemas';
import { loginUser } from '@/server/auth/registered';
import { jsonError } from '@/server/http';

export async function POST(request: Request) {
  try {
    const input = loginSchema.parse(await request.json());
    const { user, setCookie } = await loginUser(input.username, input.password, request);
    const response = NextResponse.json({
      data: { username: user.username, uid: user.uid, createdAt: user.createdAt },
      error: null,
    });
    response.headers.append('Set-Cookie', setCookie);
    return response;
  } catch (error) {
    return jsonError(error);
  }
}
