import { NextResponse } from 'next/server';

import { requireAdminUser } from '@/server/auth/admin';
import { listReports } from '@/server/forum/service';
import { jsonError } from '@/server/http';

export async function GET(request: Request) {
  try {
    await requireAdminUser(request);
    const data = await listReports();
    return NextResponse.json({ data, error: null });
  } catch (error) {
    return jsonError(error);
  }
}
