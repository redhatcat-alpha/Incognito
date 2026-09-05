import { NextResponse } from 'next/server';
import { recordAdminAudit, requireAdminUser } from '@/server/auth/admin';
import { adminBoardCreateSchema } from '@/server/forum/schemas';
import { createBoard, listAdminBoards } from '@/server/forum/service';
import { jsonError } from '@/server/http';

export async function GET(request: Request) {
  try { await requireAdminUser(request); return NextResponse.json({ data: await listAdminBoards(), error: null }); } catch (error) { return jsonError(error); }
}

export async function POST(request: Request) {
  try { const admin = await requireAdminUser(request); const input = adminBoardCreateSchema.parse(await request.json()); const data = await createBoard(input); await recordAdminAudit({ adminUserId: admin.id, action: 'board.create', targetType: 'board', targetId: data.slug }); return NextResponse.json({ data, error: null }, { status: 201 }); } catch (error) { return jsonError(error); }
}
