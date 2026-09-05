import { NextResponse } from 'next/server';
import { verifyPasskeyAuthentication } from '@/server/auth/passkey';
import { jsonError } from '@/server/http';

export async function POST(request: Request) {
  try {
    const input = await request.json() as { challengeId?: string; credentialId?: string; clientDataJSON?: string; authenticatorData?: string; signature?: string };
    if (!input.challengeId || !input.credentialId || !input.clientDataJSON || !input.authenticatorData || !input.signature) throw new Error('PASSKEY_ASSERTION_INVALID');
    const session = await verifyPasskeyAuthentication({ challengeId: input.challengeId, credentialId: input.credentialId, clientDataJSON: input.clientDataJSON, authenticatorData: input.authenticatorData, signature: input.signature }, request);
    return new NextResponse(JSON.stringify({ data: { recovered: true }, error: null }), { status: 200, headers: { 'content-type': 'application/json', 'set-cookie': session.setCookie ?? '' } });
  } catch (error) { return jsonError(error); }
}
