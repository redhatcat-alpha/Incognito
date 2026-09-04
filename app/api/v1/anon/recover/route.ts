import { NextResponse } from 'next/server';
import { recoverSession } from '@/server/auth/recovery';
import { jsonError } from '@/server/http';

export async function POST(request: Request) {
  try { const input = await request.json() as { phrase?: string }; if (!input.phrase?.trim()) throw new Error('RECOVERY_PHRASE_INVALID'); const session = await recoverSession(input.phrase, request); return new NextResponse(JSON.stringify({ data: { recovered: true }, error: null }), { status: 200, headers: { 'content-type': 'application/json', 'set-cookie': session.setCookie ?? '' } }); }
  catch (error) { return jsonError(error); }
}
