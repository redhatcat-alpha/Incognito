'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

const tabs = [
  { href: '/settings/profile', label: '匿名形象与设备', icon: '👤' },
  { href: '/settings/privacy', label: '隐私与数据', icon: '🛡️' },
];

export function SettingsTabs() {
  const pathname = usePathname();
  return (
    <nav aria-label="设置分区" className="flex flex-wrap gap-2">
      {tabs.map((tab) => {
        const active = pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-bold transition-colors',
              active
                ? 'border-[var(--ink)] bg-[var(--ink)] text-white'
                : 'border-black/10 bg-white text-muted-foreground hover:border-black/30 hover:text-foreground',
            )}
          >
            <span aria-hidden="true">{tab.icon}</span>
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function Section({
  title,
  description,
  children,
  tone = 'default',
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  tone?: 'default' | 'danger';
}) {
  return (
    <section
      className={cn(
        'rounded-2xl border bg-white p-6',
        tone === 'danger' ? 'border-[#d83b2d]/30' : 'border-black/10',
      )}
    >
      <h2 className={cn('text-lg font-black tracking-tight', tone === 'danger' && 'text-[#a02a1f]')}>{title}</h2>
      {description ? <p className="mt-1 text-sm leading-6 text-muted-foreground">{description}</p> : null}
      <div className="mt-4">{children}</div>
    </section>
  );
}
