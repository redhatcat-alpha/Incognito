import { NextResponse } from 'next/server';
import { requireAdminUser } from '@/server/auth/admin';
import { adminTagPatchSchema } from '@/server/forum/schemas';
import { updateTag } from '@/server/forum/service';
import { jsonError } from '@/server/http';

export async function PATCH(request: Request, context: { params: Promise<{ slug: string }> }) {
  try { await requireAdminUser(request); const { slug } = await context.params; const input = adminTagPatchSchema.parse(await request.json()); return NextResponse.json({ data: await updateTag(slug, input), error: null }); } catch (error) { return jsonError(error); }
}
