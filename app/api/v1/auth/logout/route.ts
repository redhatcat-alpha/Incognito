import { NextResponse } from 'next/server';

import { clearUserSessionCookie, logoutUser } from '@/server/auth/registered';
import { jsonError } from '@/server/http';

export async function POST(request: Request) {
  try {
    await logoutUser(request);
    const response = NextResponse.json({ data: { loggedOut: true }, error: null });
    response.headers.append('Set-Cookie', clearUserSessionCookie(request));
    return response;
  } catch (error) {
    return jsonError(error);
  }
}
