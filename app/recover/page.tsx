'use client';

import { useState } from 'react';
import Link from '@/lib/static-link';
import { Fingerprint, KeyRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { apiJson } from '@/lib/api';

function encode(value: ArrayBuffer): string {
  const bytes = new Uint8Array(value); let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}
function decode(value: string): Uint8Array {
  const normalized = value.replaceAll('-', '+').replaceAll('_', '/') + '='.repeat((4 - (value.length % 4)) % 4);
  const binary = atob(normalized); return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

export default function RecoverPage() {
  const [phrase, setPhrase] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  async function recoverWithPhrase() {
    setBusy(true); setError('');
    try { await apiJson('/api/v1/anon/recover', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ phrase }) }); setDone(true); }
    catch (cause) { setError(cause instanceof Error ? cause.message : '恢复失败'); }
    finally { setBusy(false); }
  }
  async function recoverWithPasskey() {
    if (!navigator.credentials?.get) { setError('当前设备或浏览器不支持 Passkey'); return; }
    setBusy(true); setError('');
    try {
      const options = await apiJson<{ challengeId: string; challenge: string }>('/api/v1/anon/passkey/auth/options', { method: 'POST' });
      const credential = await navigator.credentials.get({ publicKey: { challenge: decode(options.challenge).buffer as ArrayBuffer, userVerification: 'preferred', timeout: 120000 } });
      if (!(credential instanceof PublicKeyCredential)) throw new Error('PASSKEY_ASSERTION_INVALID');
      const response = credential.response as AuthenticatorAssertionResponse;
      await apiJson('/api/v1/anon/passkey/auth/verify', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ challengeId: options.challengeId, credentialId: encode(credential.rawId), clientDataJSON: encode(response.clientDataJSON), authenticatorData: encode(response.authenticatorData), signature: encode(response.signature) }) });
      setDone(true);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Passkey 恢复失败'); }
    finally { setBusy(false); }
  }
  if (done) return <main className="grid min-h-screen place-items-center bg-[#f4f7f2] px-5"><div className="w-full max-w-md rounded-3xl border border-black/10 bg-white p-8 text-center"><KeyRound className="mx-auto size-10 text-[var(--signal-dark)]" /><h1 className="mt-4 text-2xl font-black">身份已恢复</h1><p className="mt-2 text-sm text-muted-foreground">当前浏览器已接入原匿名身份。</p><Button className="mt-6 rounded-full" render={<Link href="/" />}>进入论坛</Button></div></main>;
  return <main className="grid min-h-screen place-items-center bg-[#f4f7f2] px-5"><div className="w-full max-w-md rounded-3xl border border-black/10 bg-white p-8"><p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--signal-dark)]">IDENTITY RECOVERY</p><h1 className="mt-2 text-3xl font-black">恢复匿名身份</h1><p className="mt-2 text-sm text-muted-foreground">使用恢复短语或已绑定的 Passkey。服务端不会要求真实身份信息。</p><label htmlFor="recovery-phrase" className="mt-6 grid gap-2 text-sm font-bold">恢复短语<Input id="recovery-phrase" value={phrase} onChange={(event) => setPhrase(event.target.value)} placeholder="六个词，以空格分隔" autoComplete="off" /></label>{error ? <p role="alert" className="mt-3 text-sm font-semibold text-destructive">{error}</p> : null}<div className="mt-5 grid gap-3"><Button disabled={busy || phrase.trim().split(/\s+/).length !== 6} onClick={() => void recoverWithPhrase()} className="rounded-full">{busy ? '恢复中…' : '使用恢复短语'}</Button><Button variant="outline" disabled={busy} onClick={() => void recoverWithPasskey()} className="gap-2 rounded-full bg-white"><Fingerprint className="size-4" />使用 Passkey</Button><Button variant="ghost" render={<Link href="/" />} className="rounded-full">返回论坛</Button></div></div></main>;
}
