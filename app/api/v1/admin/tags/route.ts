import { NextResponse } from 'next/server';
import { requireAdminUser } from '@/server/auth/admin';
import { listAdminTags } from '@/server/forum/service';
import { jsonError } from '@/server/http';

export async function GET(request: Request) {
  try { await requireAdminUser(request); return NextResponse.json({ data: await listAdminTags(), error: null }); } catch (error) { return jsonError(error); }
}
