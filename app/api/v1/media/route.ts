import { NextResponse } from 'next/server';
import { env } from 'cloudflare:workers';

import { ensureAnonymousSession } from '@/server/auth/anonymous';
import { jsonError } from '@/server/http';

const ALLOWED = new Map([
  ['image/jpeg', 'jpg'],
  ['image/png', 'png'],
  ['image/webp', 'webp'],
]);
const MAX_BYTES = 2 * 1024 * 1024;

export async function POST(request: Request) {
  try {
    await ensureAnonymousSession(request);
    if (!env.FILES) throw new Error('MEDIA_STORAGE_UNAVAILABLE');
    const form = await request.formData();
    const file = form.get('file');
    if (!(file instanceof File)) throw new Error('MEDIA_FILE_REQUIRED');
    const extension = ALLOWED.get(file.type);
    if (!extension || file.size > MAX_BYTES) throw new Error('MEDIA_FILE_INVALID');
    const id = crypto.randomUUID();
    const key = `uploads/${id}.${extension}`;
    await env.FILES.put(key, await file.arrayBuffer(), { httpMetadata: { contentType: file.type, cacheControl: 'public, max-age=31536000, immutable' }, customMetadata: { uploadedAt: new Date().toISOString() } });
    return NextResponse.json({ data: { id, url: `/api/v1/media/${id}`, contentType: file.type, size: file.size }, error: null }, { status: 201 });
  } catch (error) { return jsonError(error); }
}
