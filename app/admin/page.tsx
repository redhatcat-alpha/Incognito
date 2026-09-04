import type { Metadata } from 'next';

import { AdminConsole } from '@/components/admin/admin-console';

export const metadata: Metadata = {
  title: '管理后台 · 公告',
  robots: { index: false, follow: false },
};

export default function AdminPage() {
  return <AdminConsole />;
}
