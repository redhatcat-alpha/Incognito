import { NextResponse } from 'next/server';
import { requireAdminUser } from '@/server/auth/admin';
import { adminBoardPatchSchema } from '@/server/forum/schemas';
import { updateBoard } from '@/server/forum/service';
import { jsonError } from '@/server/http';

export async function PATCH(request: Request, context: { params: Promise<{ slug: string }> }) {
  try { await requireAdminUser(request); const { slug } = await context.params; const input = adminBoardPatchSchema.parse(await request.json()); return NextResponse.json({ data: await updateBoard(slug, input), error: null }); } catch (error) { return jsonError(error); }
}
