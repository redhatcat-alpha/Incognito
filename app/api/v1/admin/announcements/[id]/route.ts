import { NextResponse } from 'next/server';

import { requireAdminUser } from '@/server/auth/admin';
import { archiveAnnouncement } from '@/server/forum/service';
import { jsonError } from '@/server/http';

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    await requireAdminUser(request);
    const { id } = await context.params;
    const data = await archiveAnnouncement(id);
    return NextResponse.json({ data, error: null });
  } catch (error) {
    return jsonError(error);
  }
}
