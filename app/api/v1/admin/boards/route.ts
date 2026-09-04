import { NextResponse } from 'next/server';
import { requireAdminUser } from '@/server/auth/admin';
import { adminBoardCreateSchema } from '@/server/forum/schemas';
import { createBoard, listAdminBoards } from '@/server/forum/service';
import { jsonError } from '@/server/http';

export async function GET(request: Request) {
  try { await requireAdminUser(request); return NextResponse.json({ data: await listAdminBoards(), error: null }); } catch (error) { return jsonError(error); }
}

export async function POST(request: Request) {
  try { await requireAdminUser(request); const input = adminBoardCreateSchema.parse(await request.json()); return NextResponse.json({ data: await createBoard(input), error: null }, { status: 201 }); } catch (error) { return jsonError(error); }
}
