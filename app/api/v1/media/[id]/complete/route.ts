import { NextResponse } from 'next/server';

import { ensureAnonymousSession, applySessionCookie } from '@/server/auth/anonymous';
import { getD1 } from '@/db';
import { jsonError } from '@/server/http';
import { statLocalObject } from '@/server/local-storage';

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await ensureAnonymousSession(request);
    const { id } = await context.params;
    const upload = await getD1()
      .prepare('SELECT object_key, status, expires_at FROM media_uploads WHERE id = ? AND owner_id = ? LIMIT 1')
      .bind(id, session.userId)
      .first<{ object_key: string; status: string; expires_at: number }>();
    if (!upload) throw new Error('MEDIA_UPLOAD_NOT_FOUND');
    if (upload.expires_at <= Date.now()) throw new Error('MEDIA_UPLOAD_EXPIRED');
    if (upload.status === 'ready') return NextResponse.json({ data: { id, status: 'ready', url: `/api/v1/media/${id}` }, error: null });
    if (upload.status !== 'uploaded') throw new Error('MEDIA_UPLOAD_NOT_READY');
    const object = await statLocalObject(upload.object_key);
    if (!object) throw new Error('MEDIA_UPLOAD_NOT_READY');
    await getD1().prepare("UPDATE media_uploads SET status = 'ready', completed_at = ? WHERE id = ? AND owner_id = ?").bind(Date.now(), id, session.userId).run();
    const response = NextResponse.json({ data: { id, status: 'ready', url: `/api/v1/media/${id}`, size: object.size }, error: null });
    return applySessionCookie(response, session);
  } catch (error) {
    return jsonError(error);
  }
}
