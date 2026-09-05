'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Ghost, Hash, ShieldCheck } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { apiJson, ApiError } from '@/lib/api';
import { cn } from '@/lib/utils';

export function AuthPage() {
  const router = useRouter();
  const params = useSearchParams();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const nextParam = params.get('next');
  const next = nextParam && nextParam.startsWith('/') ? nextParam : '/';

  // 若已登录则直接回跳
  useEffect(() => {
    const timer = window.setTimeout(() => {
      apiJson<{ username: string } | null>('/api/v1/auth/me')
        .then((me) => {
          if (me) router.replace(next);
        })
        .catch(() => undefined);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [router, next]);

  async function submit(event: { preventDefault: () => void }) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      await apiJson(`/api/v1/auth/${mode}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), password }),
      });
      router.replace(next);
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : '操作失败，请稍后重试');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid min-h-screen bg-background text-foreground lg:grid-cols-[1.1fr_1fr]">
      {/* 左侧品牌区 */}
      <section className="relative hidden flex-col justify-between overflow-hidden bg-[var(--ink)] p-10 text-white lg:flex">
        <div className="pointer-events-none absolute inset-0 opacity-[0.07]" aria-hidden="true">
          <div className="absolute -left-20 top-10 size-72 rounded-full bg-[var(--signal)]" />
          <div className="absolute right-0 top-1/3 size-96 rounded-full bg-[#43a5ff]" />
          <div className="absolute bottom-0 left-1/4 size-80 rounded-full bg-[#ff795b]" />
        </div>
        <Link href="/" className="relative flex items-center gap-2.5">
          <span className="grid size-10 place-items-center rounded-full bg-[var(--signal)] text-[var(--ink)]">
            <Hash className="size-6 stroke-[2.6]" />
          </span>
          <span className="text-2xl font-black tracking-[-0.04em]">无名岛</span>
        </Link>
        <div className="relative max-w-md">
          <h1 className="text-4xl font-black leading-tight tracking-[-0.04em]">
            先匿名浏览，
            <br />
            再决定怎么介绍自己。
          </h1>
          <p className="mt-4 text-base leading-7 text-white/70">
            无需注册即可浏览、发帖和回复；注册仅用于需要固定 ID 的场景。每次发帖和回复，你都可以选择
            <span className="mx-1 inline-flex items-center gap-1 rounded-full bg-white/10 px-2 py-0.5 font-bold text-[var(--signal)]">
              <Ghost className="size-3.5" /> 匿名发言
            </span>
            或
            <span className="mx-1 inline-flex items-center gap-1 rounded-full bg-white/10 px-2 py-0.5 font-bold text-[var(--signal)]">
              <ShieldCheck className="size-3.5" /> 用固定 ID 发言
            </span>
            。
          </p>
          <ul className="mt-8 space-y-2 text-sm text-white/60">
            <li>· 注册无需邮箱、手机号或任何真实信息</li>
            <li>· 匿名发言在同一帖子内以随机代号出现，跨帖不关联</li>
            <li>· 固定 ID 发言跨帖展示你的用户名与唯一编号</li>
          </ul>
        </div>
        <p className="relative text-xs text-white/40">无名岛不会要求邮箱或手机号。</p>
      </section>

      {/* 右侧表单区 */}
      <section className="flex items-center justify-center px-5 py-12">
        <div className="w-full max-w-sm">
          <Link href="/" className="mb-8 flex items-center justify-center gap-2.5 lg:hidden">
            <span className="grid size-9 place-items-center rounded-full bg-[var(--signal)] text-[var(--ink)]">
              <Hash className="size-5 stroke-[2.6]" />
            </span>
            <span className="text-xl font-black tracking-[-0.04em]">无名岛</span>
          </Link>

          <div className="rounded-3xl border border-black/10 bg-white p-6 shadow-[0_10px_40px_rgb(17_24_21/0.06)] sm:p-7">
            <h2 className="text-2xl font-black tracking-[-0.03em]">{mode === 'login' ? '登录无名岛' : '创建你的账号'}</h2>
            <p className="mt-1.5 text-sm leading-6 text-muted-foreground">
              {mode === 'login' ? '登录后可使用固定 ID 发言；匿名发言无需登录。' : '注册即获得唯一 ID，可随时以匿名或固定 ID 两种身份发言。'}
            </p>

            <div className="mt-5 grid grid-cols-2 gap-1 rounded-full bg-[var(--ink)]/[0.05] p-1" role="tablist" aria-label="登录或注册">
              {(['login', 'register'] as const).map((item) => (
                <button
                  key={item}
                  type="button"
                  role="tab"
                  aria-selected={mode === item}
                  onClick={() => { setMode(item); setError(''); }}
                  className={cn(
                    'rounded-full py-2 text-sm font-bold transition-colors',
                    mode === item ? 'bg-[var(--ink)] text-white' : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {item === 'login' ? '登录' : '注册'}
                </button>
              ))}
            </div>

            <form onSubmit={(event) => void submit(event)} className="mt-5 grid gap-4">
              <label className="grid gap-1.5 text-sm font-bold text-foreground">
                用户名
                <input
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  className="h-11 rounded-xl border border-black/15 bg-white px-3.5 text-[0.95rem] font-normal outline-none focus:ring-2 focus:ring-[var(--signal)]"
                  placeholder="中英文、数字、_-，3-20 字符"
                  minLength={3}
                  maxLength={20}
                  required
                  autoComplete="username"
                />
              </label>
              <label className="grid gap-1.5 text-sm font-bold text-foreground">
                密码
                <input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="h-11 rounded-xl border border-black/15 bg-white px-3.5 text-[0.95rem] font-normal outline-none focus:ring-2 focus:ring-[var(--signal)]"
                  placeholder={mode === 'register' ? '至少 8 位密码' : '输入密码'}
                  minLength={mode === 'register' ? 8 : 1}
                  maxLength={72}
                  required
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                />
              </label>
              {error ? (
                <p role="alert" className="rounded-xl border border-[#d83b2d]/30 bg-[#fdecea] px-3.5 py-2.5 text-sm font-semibold text-[#a02a1f]">
                  {error}
                </p>
              ) : null}
              <Button type="submit" disabled={busy || username.trim().length < 3 || password.length < (mode === 'register' ? 8 : 1)} className="h-11 w-full rounded-full text-[0.95rem]">
                {busy ? '请稍候…' : mode === 'login' ? '登录并进入' : '注册并进入'}
              </Button>
            </form>

            <p className="mt-4 text-center text-xs leading-5 text-muted-foreground">
              {mode === 'register'
                ? '注册即表示你同意以用户名公开发言的内容无法匿名隐藏。密码只以不可逆方式存储。'
                : '忘记密码？当前版本尚未提供找回，请妥善保管。'}
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
