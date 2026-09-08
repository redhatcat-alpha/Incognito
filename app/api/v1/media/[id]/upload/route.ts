import { NextResponse } from 'next/server';
import { env } from 'cloudflare:workers';

import { ensureAnonymousSession, applySessionCookie } from '@/server/auth/anonymous';
import { getD1 } from '@/db';
import { jsonError } from '@/server/http';
import { hasValidSignature, MEDIA_MAX_BYTES, stripMediaMetadata, type MediaExtension } from '@/server/media';

type Params = { id: string };

export async function PUT(request: Request, context: { params: Promise<Params> }) {
  try {
    const session = await ensureAnonymousSession(request);
    if (!env.FILES) throw new Error('MEDIA_STORAGE_UNAVAILABLE');
    const { id } = await context.params;
    const upload = await getD1()
      .prepare('SELECT owner_id, object_key, content_type, extension, size, status, expires_at FROM media_uploads WHERE id = ? LIMIT 1')
      .bind(id)
      .first<{ owner_id: string; object_key: string; content_type: string; extension: string; size: number; status: string; expires_at: number }>();
    if (!upload || upload.owner_id !== session.userId) throw new Error('MEDIA_UPLOAD_NOT_FOUND');
    if (upload.expires_at <= Date.now()) throw new Error('MEDIA_UPLOAD_EXPIRED');
    if (upload.status !== 'pending') throw new Error('MEDIA_UPLOAD_STATE');

    const contentLength = Number(request.headers.get('content-length') ?? 0);
    if (contentLength > MEDIA_MAX_BYTES || (contentLength > 0 && contentLength !== upload.size)) throw new Error('MEDIA_FILE_INVALID');
    const source = new Uint8Array(await request.arrayBuffer());
    if (source.byteLength < 1 || source.byteLength > MEDIA_MAX_BYTES || source.byteLength !== upload.size) throw new Error('MEDIA_FILE_INVALID');
    const extension = upload.extension as MediaExtension;
    if (!hasValidSignature(source.subarray(0, 12), extension)) throw new Error('MEDIA_FILE_INVALID');
    const stored = stripMediaMetadata(source, extension);
    await env.FILES.put(upload.object_key, stored, {
      httpMetadata: { contentType: upload.content_type, cacheControl: 'public, max-age=31536000, immutable' },
      customMetadata: { uploadedAt: new Date().toISOString(), exifStripped: 'true' },
    });
    await getD1().prepare("UPDATE media_uploads SET status = 'uploaded', size = ? WHERE id = ? AND owner_id = ?").bind(stored.byteLength, id, session.userId).run();
    const response = NextResponse.json({ data: { id, status: 'uploaded', size: stored.byteLength }, error: null });
    return applySessionCookie(response, session);
  } catch (error) {
    return jsonError(error);
  }
}
