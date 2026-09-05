import { NextResponse } from 'next/server';

import { listAdminAuditLogs, requireAdminUser } from '@/server/auth/admin';
import { jsonError } from '@/server/http';

export async function GET(request: Request) {
  try {
    await requireAdminUser(request);
    const limit = Number(new URL(request.url).searchParams.get('limit') ?? 100);
    return NextResponse.json({ data: await listAdminAuditLogs(Number.isFinite(limit) ? limit : 100), error: null });
  } catch (error) {
    return jsonError(error);
  }
}
