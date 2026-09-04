import type { Metadata } from 'next';
import { Suspense } from 'react';

import { AuthPage } from '@/components/auth/auth-page';

export const metadata: Metadata = {
  title: '登录 / 注册',
  robots: { index: false, follow: false },
};

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <AuthPage />
    </Suspense>
  );
}
