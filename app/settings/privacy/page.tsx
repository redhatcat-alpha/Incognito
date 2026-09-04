import type { Metadata } from 'next';

import { SettingsPrivacyView } from '@/components/forum/settings-privacy-view';
import { ForumShell } from '@/components/forum/forum-shell';

export const metadata: Metadata = {
  title: '隐私与数据',
  robots: { index: false, follow: false },
};

export default function SettingsPrivacyPage() {
  return (
    <ForumShell>
      <SettingsPrivacyView />
    </ForumShell>
  );
}
