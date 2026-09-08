import { NextResponse } from 'next/server';
import { jsonError } from '@/server/http';
import { readLocalObject } from '@/server/local-storage';

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    if (!/^[0-9a-f-]{36}$/.test(id)) return new NextResponse('Not found', { status: 404 });
    for (const [extension, contentType] of [['jpg', 'image/jpeg'], ['png', 'image/png'], ['webp', 'image/webp']] as const) {
      const object = await readLocalObject(`uploads/${id}.${extension}`);
      if (object) return new NextResponse(new Uint8Array(object), { headers: { 'Content-Type': contentType, 'Cache-Control': 'public, max-age=31536000, immutable' } });
    }
    return new NextResponse('Not found', { status: 404 });
  } catch (error) { return jsonError(error); }
}
