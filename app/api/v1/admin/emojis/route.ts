import { NextResponse } from 'next/server';
import { requireAdminUser } from '@/server/auth/admin';
import { listEmojiSettings } from '@/server/forum/emojis';
import { jsonError } from '@/server/http';

export async function GET(request: Request) {
  try { await requireAdminUser(request); return NextResponse.json({ data: await listEmojiSettings(), error: null }); }
  catch (error) { return jsonError(error); }
}
