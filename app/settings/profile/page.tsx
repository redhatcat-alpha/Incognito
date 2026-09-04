import type { Metadata } from 'next';

import { SettingsProfileView } from '@/components/forum/settings-profile-view';
import { ForumShell } from '@/components/forum/forum-shell';

export const metadata: Metadata = {
  title: '我的设置',
  robots: { index: false, follow: false },
};

export default function SettingsProfilePage() {
  return (
    <ForumShell>
      <SettingsProfileView />
    </ForumShell>
  );
}
