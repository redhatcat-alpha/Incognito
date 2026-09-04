import { NextResponse } from 'next/server';

import { getRegisteredUser, touchRegisteredSession } from '@/server/auth/registered';
import { jsonError } from '@/server/http';

export async function GET(request: Request) {
  try {
    const user = await getRegisteredUser(request);
    await touchRegisteredSession(request);
    return NextResponse.json({
      data: user
        ? { username: user.username, uid: user.uid, createdAt: user.createdAt }
        : null,
      error: null,
    });
  } catch (error) {
    return jsonError(error);
  }
}
