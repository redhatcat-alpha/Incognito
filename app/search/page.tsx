import type { Metadata } from 'next';
import { Suspense } from 'react';

import { SearchView } from '@/components/forum/search-view';
import { ForumShell } from '@/components/forum/forum-shell';

export const metadata: Metadata = {
  title: '搜索',
  robots: { index: false, follow: false },
};

export default function SearchPage() {
  return (
    <ForumShell>
      <Suspense fallback={null}>
        <SearchView />
      </Suspense>
    </ForumShell>
  );
}
