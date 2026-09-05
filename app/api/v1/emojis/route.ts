import { NextResponse } from 'next/server';
import { listActiveEmojiIds } from '@/server/forum/emojis';
import { jsonError } from '@/server/http';

export async function GET() {
  try { return NextResponse.json({ data: { ids: await listActiveEmojiIds() }, error: null }); }
  catch (error) { return jsonError(error); }
}
