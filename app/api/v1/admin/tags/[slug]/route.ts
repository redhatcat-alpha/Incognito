import { NextResponse } from 'next/server';
import { recordAdminAudit, requireAdminUser } from '@/server/auth/admin';
import { adminTagPatchSchema } from '@/server/forum/schemas';
import { updateTag } from '@/server/forum/service';
import { jsonError } from '@/server/http';

export async function PATCH(request: Request, context: { params: Promise<{ slug: string }> }) {
  try { const admin = await requireAdminUser(request); const { slug } = await context.params; const input = adminTagPatchSchema.parse(await request.json()); const data = await updateTag(slug, input); await recordAdminAudit({ adminUserId: admin.id, action: 'tag.update', targetType: 'tag', targetId: slug, metadata: { status: input.status } }); return NextResponse.json({ data, error: null }); } catch (error) { return jsonError(error); }
}
