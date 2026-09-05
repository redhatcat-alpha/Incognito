import { NextResponse } from 'next/server';

import { recordAdminAudit, requireAdminUser } from '@/server/auth/admin';
import { archiveAnnouncement } from '@/server/forum/service';
import { jsonError } from '@/server/http';

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdminUser(request);
    const { id } = await context.params;
    const data = await archiveAnnouncement(id);
    await recordAdminAudit({ adminUserId: admin.id, action: 'announcement.archive', targetType: 'announcement', targetId: id });
    return NextResponse.json({ data, error: null });
  } catch (error) {
    return jsonError(error);
  }
}
