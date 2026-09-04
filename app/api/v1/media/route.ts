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
    const bytes = new Uint8Array(await file.slice(0, 12).arrayBuffer());
    const isJpeg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
    const isPng = bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
    const isWebp = bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50;
    if ((extension === 'jpg' && !isJpeg) || (extension === 'png' && !isPng) || (extension === 'webp' && !isWebp)) throw new Error('MEDIA_FILE_INVALID');
    const id = crypto.randomUUID();
    const key = `uploads/${id}.${extension}`;
    await env.FILES.put(key, await file.arrayBuffer(), { httpMetadata: { contentType: file.type, cacheControl: 'public, max-age=31536000, immutable' }, customMetadata: { uploadedAt: new Date().toISOString() } });
    return NextResponse.json({ data: { id, url: `/api/v1/media/${id}`, contentType: file.type, size: file.size }, error: null }, { status: 201 });
  } catch (error) { return jsonError(error); }
}
