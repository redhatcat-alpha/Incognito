import { NextResponse } from 'next/server';
import { recordAdminAudit, requireAdminUser } from '@/server/auth/admin';
import { adminBoardPatchSchema } from '@/server/forum/schemas';
import { updateBoard } from '@/server/forum/service';
import { jsonError } from '@/server/http';

export async function PATCH(request: Request, context: { params: Promise<{ slug: string }> }) {
  try { const admin = await requireAdminUser(request); const { slug } = await context.params; const input = adminBoardPatchSchema.parse(await request.json()); const data = await updateBoard(slug, input); await recordAdminAudit({ adminUserId: admin.id, action: 'board.update', targetType: 'board', targetId: slug, metadata: { status: input.status } }); return NextResponse.json({ data, error: null }); } catch (error) { return jsonError(error); }
}
