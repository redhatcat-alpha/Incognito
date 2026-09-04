import { NextResponse } from 'next/server';

import { clearAdminCookie, logoutAdmin } from '@/server/auth/admin';
import { jsonError } from '@/server/http';

export async function POST(request: Request) {
  try {
    await logoutAdmin(request);
    const response = NextResponse.json({ data: { loggedOut: true }, error: null });
    response.headers.append('Set-Cookie', clearAdminCookie(request));
    return response;
  } catch (error) {
    return jsonError(error);
  }
}
