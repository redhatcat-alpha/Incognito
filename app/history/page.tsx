import type { Metadata } from 'next';

import { HistoryView } from '@/components/forum/history-view';
import { ForumShell } from '@/components/forum/forum-shell';

export const metadata: Metadata = {
  title: '浏览历史',
  robots: { index: false, follow: false },
};

export default function HistoryPage() {
  return (
    <ForumShell>
      <HistoryView />
    </ForumShell>
  );
}
