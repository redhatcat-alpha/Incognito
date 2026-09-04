'use client';

import Link from 'next/link';
import { Ghost, ShieldCheck } from 'lucide-react';

import { cn } from '@/lib/utils';
import type { AuthMe } from '@/lib/forum-types';

export type Identity = 'anonymous' | 'registered';

/**
 * 发言身份选择：匿名代号（默认，隐私优先）或注册用户名（跨帖子可见的固定 ID）。
 */
export function IdentityPicker({
  me,
  value,
  onChange,
}: {
  me: AuthMe | null;
  value: Identity;
  onChange: (identity: Identity) => void;
}) {
  const options: { key: Identity; label: string; hint: string; icon: React.ReactNode }[] = [
    { key: 'anonymous', label: '匿名发言', hint: '本帖内显示为随机代号，跨帖不可追踪', icon: <Ghost className="size-4" /> },
    {
      key: 'registered',
      label: me ? `以 ${me.username} 发言` : '用固定 ID 发言',
      hint: me ? `跨帖展示用户名 · ID #${me.uid}` : '注册登录后可用固定用户名与唯一 ID',
      icon: <ShieldCheck className="size-4" />,
    },
  ];

  return (
    <fieldset className="flex flex-wrap items-center gap-2 border-0 p-0" aria-label="选择发言身份">
      <legend className="sr-only">选择发言身份</legend>
      {options.map((option) => {
        const active = value === option.key;
        const locked = option.key === 'registered' && !me;
        return (
          <button
            key={option.key}
            type="button"
            aria-pressed={active}
            disabled={locked}
            onClick={() => onChange(option.key)}
            title={option.hint}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold transition-colors',
              active
                ? 'border-[var(--ink)] bg-[var(--ink)] text-white'
                : 'border-black/10 bg-white text-muted-foreground hover:border-black/30 hover:text-foreground',
              locked && 'cursor-not-allowed opacity-50 hover:border-black/10 hover:text-muted-foreground',
            )}
          >
            {option.icon}
            {option.label}
          </button>
        );
      })}
      {value === 'registered' && !me ? (
        <Link href="/settings/profile" className="text-xs font-bold text-[var(--signal-dark)] underline underline-offset-4">
          去注册 / 登录
        </Link>
      ) : null}
    </fieldset>
  );
}
