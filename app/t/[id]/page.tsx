import type { Metadata } from 'next';

import { ThreadView } from '@/components/forum/thread-view';
import { ForumShell } from '@/components/forum/forum-shell';

export const metadata: Metadata = {
  robots: { index: true, follow: true },
};

export default async function ThreadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <ForumShell>
      <ThreadView postId={id} />
    </ForumShell>
  );
}
