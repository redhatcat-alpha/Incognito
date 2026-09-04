import { NextResponse } from 'next/server';

import { registerSchema } from '@/server/forum/schemas';
import { registerUser } from '@/server/auth/registered';
import { jsonError } from '@/server/http';

export async function POST(request: Request) {
  try {
    const input = registerSchema.parse(await request.json());
    const { user, setCookie } = await registerUser(input.username, input.password, request);
    const response = NextResponse.json(
      { data: { username: user.username, uid: user.uid, createdAt: user.createdAt }, error: null },
      { status: 201 },
    );
    response.headers.append('Set-Cookie', setCookie);
    return response;
  } catch (error) {
    return jsonError(error);
  }
}
