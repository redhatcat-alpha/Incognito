import { NextResponse } from 'next/server';

import { changeAdminPassword } from '@/server/auth/admin';
import { adminPasswordChangeSchema } from '@/server/forum/schemas';
import { jsonError } from '@/server/http';

export async function PATCH(request: Request) {
  try {
    const input = adminPasswordChangeSchema.parse(await request.json());
    await changeAdminPassword(input, request);
    return NextResponse.json({ data: { changed: true }, error: null });
  } catch (error) {
    return jsonError(error);
  }
}
