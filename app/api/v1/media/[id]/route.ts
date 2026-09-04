import { NextResponse } from 'next/server';
import { env } from 'cloudflare:workers';
import { jsonError } from '@/server/http';

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    if (!env.FILES) throw new Error('MEDIA_STORAGE_UNAVAILABLE');
    const { id } = await context.params;
    if (!/^[0-9a-f-]{36}$/.test(id)) return new NextResponse('Not found', { status: 404 });
    for (const extension of ['jpg', 'png', 'webp']) {
      const object = await env.FILES.get(`uploads/${id}.${extension}`);
      if (object) return new NextResponse(object.body, { headers: { 'Content-Type': object.httpMetadata?.contentType ?? 'application/octet-stream', 'Cache-Control': 'public, max-age=31536000, immutable', ETag: object.httpEtag } });
    }
    return new NextResponse('Not found', { status: 404 });
  } catch (error) { return jsonError(error); }
}
