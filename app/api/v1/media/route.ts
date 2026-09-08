import { NextResponse } from 'next/server';
import { env } from 'cloudflare:workers';

import { applySessionCookie, ensureAnonymousSession } from '@/server/auth/anonymous';
import { getD1 } from '@/db';
import { jsonError } from '@/server/http';
import { extensionForContentType, hasValidSignature, MEDIA_MAX_BYTES, stripMediaMetadata, type MediaExtension } from '@/server/media';

export async function POST(request: Request) {
  try {
    const session = await ensureAnonymousSession(request);
    if (!env.FILES) throw new Error('MEDIA_STORAGE_UNAVAILABLE');
    const form = await request.formData();
    const file = form.get('file');
    if (!(file instanceof File)) throw new Error('MEDIA_FILE_REQUIRED');
    const extension = extensionForContentType(file.type);
    if (!extension || file.size > MEDIA_MAX_BYTES) throw new Error('MEDIA_FILE_INVALID');
    const bytes = new Uint8Array(await file.slice(0, 12).arrayBuffer());
    if (!hasValidSignature(bytes, extension)) throw new Error('MEDIA_FILE_INVALID');
    const id = crypto.randomUUID();
    const key = `uploads/${id}.${extension}`;
    const source = new Uint8Array(await file.arrayBuffer());
    const stored = stripMediaMetadata(source, extension as MediaExtension);
    const now = Date.now();
    await getD1().prepare(`INSERT INTO media_uploads (id, owner_id, object_key, content_type, extension, size, status, created_at, expires_at, completed_at)
      VALUES (?, ?, ?, ?, ?, ?, 'processing', ?, ?, ?)`)
      .bind(id, session.userId, key, file.type, extension, stored.byteLength, now, now, now).run();
    await env.FILES.put(key, stored, { httpMetadata: { contentType: file.type, cacheControl: 'public, max-age=31536000, immutable' }, customMetadata: { uploadedAt: new Date().toISOString(), exifStripped: extension === 'jpg' ? 'true' : 'not-applicable' } });
    await getD1().prepare("UPDATE media_uploads SET status = 'ready' WHERE id = ? AND owner_id = ?").bind(id, session.userId).run();
    const response = NextResponse.json({ data: { id, url: `/api/v1/media/${id}`, contentType: file.type, size: stored.byteLength, status: 'ready' }, error: null }, { status: 201 });
    return applySessionCookie(response, session);
  } catch (error) { return jsonError(error); }
}
