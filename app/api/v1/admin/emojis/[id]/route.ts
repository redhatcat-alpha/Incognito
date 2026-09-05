import { NextResponse } from 'next/server';
import { recordAdminAudit, requireAdminUser } from '@/server/auth/admin';
import { updateEmojiSetting } from '@/server/forum/emojis';
import { jsonError } from '@/server/http';

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdminUser(request);
    const id = Number((await context.params).id);
    const input = await request.json() as { status?: 'active' | 'hidden' };
    if (input.status !== 'active' && input.status !== 'hidden') throw new Error('VALIDATION_ERROR');
    const data = await updateEmojiSetting(id, input.status);
    await recordAdminAudit({ adminUserId: admin.id, action: 'emoji.update', targetType: 'emoji', targetId: String(id), metadata: { status: input.status } });
    return NextResponse.json({ data, error: null });
  } catch (error) { return jsonError(error); }
}
