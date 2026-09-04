import { NextResponse } from 'next/server';
import { requireAdminUser } from '@/server/auth/admin';
import { siteSettingsSchema } from '@/server/forum/schemas';
import { getSiteSettings, updateSiteSettings } from '@/server/forum/service';
import { jsonError } from '@/server/http';

export async function GET(request: Request) {
  try { await requireAdminUser(request); return NextResponse.json({ data: await getSiteSettings(), error: null }); } catch (error) { return jsonError(error); }
}

export async function PATCH(request: Request) {
  try { await requireAdminUser(request); const input = siteSettingsSchema.parse(await request.json()); return NextResponse.json({ data: await updateSiteSettings(input), error: null }); } catch (error) { return jsonError(error); }
}
