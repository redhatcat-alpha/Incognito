import { NextResponse } from 'next/server';
import { requireAdminUser } from '@/server/auth/admin';
import { reportReviewSchema } from '@/server/forum/schemas';
import { reviewReport } from '@/server/forum/service';
import { jsonError } from '@/server/http';

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    await requireAdminUser(request);
    const { id } = await context.params;
    const input = reportReviewSchema.parse(await request.json());
    return NextResponse.json({ data: await reviewReport(id, input.status, input.hideTarget), error: null });
  } catch (error) { return jsonError(error); }
}
