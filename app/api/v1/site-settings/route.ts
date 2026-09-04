import { NextResponse } from 'next/server';
import { getSiteSettings } from '@/server/forum/service';
import { jsonError } from '@/server/http';

export async function GET() {
  try { return NextResponse.json({ data: await getSiteSettings(), error: null }); } catch (error) { return jsonError(error); }
}
