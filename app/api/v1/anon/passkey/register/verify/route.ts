import { NextResponse } from 'next/server';
import { ensureAnonymousSession } from '@/server/auth/anonymous';
import { verifyPasskeyRegistration } from '@/server/auth/passkey';
import { jsonError } from '@/server/http';

export async function POST(request: Request) {
  try {
    const session = await ensureAnonymousSession(request);
    const input = await request.json() as { challengeId?: string; credentialId?: string; publicKey?: string; clientDataJSON?: string };
    if (!input.challengeId || !input.credentialId || !input.publicKey || !input.clientDataJSON) throw new Error('PASSKEY_ASSERTION_INVALID');
    const data = await verifyPasskeyRegistration({ challengeId: input.challengeId, credentialId: input.credentialId, publicKey: input.publicKey, clientDataJSON: input.clientDataJSON }, session.userId, request);
    return NextResponse.json({ data, error: null });
  } catch (error) { return jsonError(error); }
}
