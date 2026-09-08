import { NextResponse } from 'next/server';
import { env } from 'cloudflare:workers';

import { ensureAnonymousSession, applySessionCookie } from '@/server/auth/anonymous';
import { getD1 } from '@/db';
import { jsonError } from '@/server/http';
import { extensionForContentType, MEDIA_INTENT_TTL_MS, MEDIA_MAX_BYTES } from '@/server/media';

export async function POST(request: Request) {
  try {
    const session = await ensureAnonymousSession(request);
    if (!env.FILES) throw new Error('MEDIA_STORAGE_UNAVAILABLE');
    const input = (await request.json()) as { contentType?: unknown; size?: unknown };
    const contentType = typeof input.contentType === 'string' ? input.contentType : '';
    const size = typeof input.size === 'number' && Number.isInteger(input.size) ? input.size : 0;
    const extension = extensionForContentType(contentType);
    if (!extension || size < 1 || size > MEDIA_MAX_BYTES) throw new Error('MEDIA_FILE_INVALID');

    const id = crypto.randomUUID();
    const now = Date.now();
    await getD1()
      .prepare(
        `INSERT INTO media_uploads
         (id, owner_id, object_key, content_type, extension, size, status, created_at, expires_at)
         VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, ?)`,
      )
      .bind(id, session.userId, `uploads/${id}.${extension}`, contentType, extension, size, now, now + MEDIA_INTENT_TTL_MS)
      .run();

    const response = NextResponse.json({
      data: {
        id,
        status: 'pending',
        uploadUrl: `/api/v1/media/${id}/upload`,
        completeUrl: `/api/v1/media/${id}/complete`,
        expiresAt: now + MEDIA_INTENT_TTL_MS,
      },
      error: null,
    }, { status: 201 });
    return applySessionCookie(response, session);
  } catch (error) {
    return jsonError(error);
  }
}
