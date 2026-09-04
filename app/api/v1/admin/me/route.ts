import { NextResponse } from 'next/server';

import { getAdminUser } from '@/server/auth/admin';
import { jsonError } from '@/server/http';

export async function GET(request: Request) {
  try {
    const user = await getAdminUser(request);
    return NextResponse.json({
      data: user ? { username: user.username, role: user.role } : null,
      error: null,
    });
  } catch (error) {
    return jsonError(error);
  }
}
