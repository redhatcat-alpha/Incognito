import { NextResponse } from 'next/server';

import { requireAdminUser } from '@/server/auth/admin';
import { adminAnnouncementSchema } from '@/server/forum/schemas';
import { createAnnouncement, listAllAnnouncements } from '@/server/forum/service';
import { jsonError } from '@/server/http';

export async function GET(request: Request) {
  try {
    await requireAdminUser(request);
    const data = await listAllAnnouncements();
    return NextResponse.json({ data, error: null });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request) {
  try {
    await requireAdminUser(request);
    const input = adminAnnouncementSchema.parse(await request.json());
    const data = await createAnnouncement({
      title: input.title,
      body: input.body,
      level: input.level,
      endsAt: input.endsAt ?? null,
    });
    return NextResponse.json({ data, error: null }, { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}
