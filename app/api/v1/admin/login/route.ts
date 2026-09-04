import { NextResponse } from 'next/server';

import { loginAdmin } from '@/server/auth/admin';
import { loginSchema } from '@/server/forum/schemas';
import { jsonError } from '@/server/http';

export async function POST(request: Request) {
  try {
    const input = loginSchema.parse(await request.json());
    const { user, setCookie } = await loginAdmin(input.username, input.password, request);
    const response = NextResponse.json({
      data: { username: user.username, role: user.role },
      error: null,
    });
    response.headers.append('Set-Cookie', setCookie);
    return response;
  } catch (error) {
    return jsonError(error);
  }
}
