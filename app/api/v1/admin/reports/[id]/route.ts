import { NextResponse } from 'next/server';
import { recordAdminAudit, requireAdminUser } from '@/server/auth/admin';
import { reportReviewSchema } from '@/server/forum/schemas';
import { reviewReport } from '@/server/forum/service';
import { jsonError } from '@/server/http';

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdminUser(request);
    const { id } = await context.params;
    const input = reportReviewSchema.parse(await request.json());
    const data = await reviewReport(id, input.status, input.hideTarget);
    await recordAdminAudit({ adminUserId: admin.id, action: 'report.review', targetType: 'report', targetId: id, metadata: { status: input.status, hideTarget: input.hideTarget } });
    return NextResponse.json({ data, error: null });
  } catch (error) { return jsonError(error); }
}
