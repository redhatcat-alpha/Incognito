import type { Metadata } from 'next';

import { BoardsView } from '@/components/forum/boards-view';
import { ForumShell } from '@/components/forum/forum-shell';

export const metadata: Metadata = {
  title: '全部板块',
  description: '浏览无名岛的全部公开讨论板块。',
};

export default function BoardsPage() {
  return (
    <ForumShell>
      <BoardsView />
    </ForumShell>
  );
}
