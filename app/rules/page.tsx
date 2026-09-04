import type { Metadata } from 'next';

import { RulesContent } from '@/components/forum/rules-content';
import { ForumShell } from '@/components/forum/forum-shell';

export const metadata: Metadata = {
  title: '社区规则',
  description: '无名岛的社区规则、举报与处置原则、匿名与隐私边界说明。',
};

export default function RulesPage() {
  return (
    <ForumShell>
      <RulesContent />
    </ForumShell>
  );
}
