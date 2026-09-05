import { NextResponse } from 'next/server';
import { beginPasskeyAuthentication } from '@/server/auth/passkey';
import { jsonError } from '@/server/http';

export async function POST() {
  try { return NextResponse.json({ data: await beginPasskeyAuthentication(), error: null }); }
  catch (error) { return jsonError(error); }
}
