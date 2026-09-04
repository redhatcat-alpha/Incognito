import type { Metadata } from 'next';
import { Noto_Sans_SC, Space_Grotesk } from 'next/font/google';

import './globals.css';

const sans = Noto_Sans_SC({
  variable: '--font-sans-cn',
  subsets: ['latin'],
  display: 'swap',
});

const display = Space_Grotesk({
  variable: '--font-display',
  subsets: ['latin'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    default: '无名岛',
    template: '%s · 无名岛',
  },
  description: '不需要真实身份的公开讨论社区。',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body className={`${sans.variable} ${display.variable}`}>{children}</body>
    </html>
  );
}
