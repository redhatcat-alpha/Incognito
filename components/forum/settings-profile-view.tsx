'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { Laptop, LogOut, ShieldCheck, Trash2 } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { ThreadAvatar } from '@/components/forum/thread-avatar';
import { Section, SettingsTabs } from '@/components/forum/settings-ui';
import { apiJson } from '@/lib/api';
import { absoluteTime, relativeTime } from '@/lib/format';
import type { AnonProfile, AnonSessionInfo, AuthMe } from '@/lib/forum-types';
import { useRegisteredUser, type RegisteredUserState } from '@/lib/use-registered-user';
import { cn } from '@/lib/utils';

function statusLabel(status: string): { label: string; tone: 'default' | 'warning' | 'danger' } {
  switch (status) {
    case 'active':
      return { label: '正常', tone: 'default' };
    case 'read_only':
    case 'muted_until':
      return { label: '受限（仅可浏览）', tone: 'warning' };
    case 'suspended':
      return { label: '已暂停', tone: 'danger' };
    default:
      return { label: '停用', tone: 'danger' };
  }
}

export function SettingsProfileView() {
  const registered = useRegisteredUser();
  const [profile, setProfile] = useState<AnonProfile | null>(null);
  const [sessions, setSessions] = useState<AnonSessionInfo[]>([]);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      const [profileData, sessionsData] = await Promise.all([
        apiJson<{ profile: AnonProfile }>('/api/v1/anon/session'),
        apiJson<AnonSessionInfo[]>('/api/v1/anon/sessions'),
      ]);
      setProfile(profileData.profile);
      setSessions(sessionsData);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '加载失败');
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const revokeSession = async (sessionId: string) => {
    try {
      await apiJson(`/api/v1/anon/sessions/${encodeURIComponent(sessionId)}`, { method: 'DELETE' });
      setNotice('会话已撤销');
      window.setTimeout(() => setNotice(''), 2500);
      void load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '撤销失败');
    }
  };

  const logout = async () => {
    await apiJson('/api/v1/anon/session', { method: 'DELETE' });
    window.location.assign('/');
  };

  const status = profile ? statusLabel(profile.status) : null;

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6">
      <div>
        <p className="mb-1 text-xs font-black uppercase tracking-[0.18em] text-[var(--signal-dark)]">SETTINGS / 设置</p>
        <h1 className="text-3xl font-black tracking-[-0.045em] sm:text-4xl">我的设置</h1>
        <p className="mt-2 text-sm text-muted-foreground">管理匿名形象、设备会话与隐私数据。这里不涉及任何真实身份信息。</p>
      </div>
      <SettingsTabs />

      <AccountSection me={registered.me} refresh={registered.refresh} />

      {notice ? (
        <p aria-live="polite" className="rounded-xl border border-emerald-500/30 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-900">
          {notice}
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="rounded-xl border border-[#d83b2d]/30 bg-[#fdecea] px-4 py-3 text-sm font-semibold text-[#a02a1f]">
          {error}
          <Button variant="ghost" size="sm" className="ml-2 h-7 rounded-full text-[#a02a1f]" onClick={() => void load()}>
            重试
          </Button>
        </p>
      ) : null}

      {profile === null ? (
        <div className="space-y-4">
          <Skeleton className="h-40 w-full rounded-2xl" />
          <Skeleton className="h-44 w-full rounded-2xl" />
        </div>
      ) : (
        <>
          <Section
            title="匿名身份"
            description="你的匿名身份由浏览器自动生成，只在本机保存一个随机会话令牌，服务端不会关联到任何真实身份。"
          >
            <div className="flex flex-wrap items-center gap-4">
              <ThreadAvatar seed={profile.avatarSeed || 'anonymous'} label="" className="size-16" />
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2 text-lg font-black">
                  匿名访客
                  {status ? (
                    <Badge
                      className={cnBadge(status.tone)}
                    >
                      {status.label}
                    </Badge>
                  ) : null}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  身份创建于 {absoluteTime(profile.createdAt)} · 当前 {profile.activeSessionCount} 个活跃会话
                </p>
              </div>
            </div>
            <div className="mt-5 rounded-xl bg-[#f8faf6] p-4 text-sm leading-6 text-muted-foreground">
              <p className="flex items-start gap-2">
                <ShieldCheck className="mt-0.5 size-4 shrink-0 text-[var(--signal-dark)]" />
                <span>
                  清除浏览器数据或退出当前设备都会让身份令牌失效，且当前版本暂不支持恢复短语或 Passkey。请勿在公共设备上留下登录状态。
                </span>
              </p>
            </div>
          </Section>

          <Section
            title="设备与会话"
            description="只显示粗略的活动时间，不记录 IP、精确位置或设备型号。可撤销当前身份下的其他会话。"
          >
            <ul className="divide-y divide-[var(--line)]">
              {sessions.length === 0 ? (
                <li className="py-4 text-sm text-muted-foreground">当前没有可显示的会话。</li>
              ) : null}
              {sessions.map((session) => (
                <li key={session.id} className="flex flex-wrap items-center gap-3 py-3.5">
                  <span className="grid size-9 shrink-0 place-items-center rounded-full bg-[var(--ink)]/[0.06]" aria-hidden="true">
                    <Laptop className="size-4 text-muted-foreground" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-2 text-sm font-bold">
                      {session.current ? '当前浏览器' : '浏览器会话'}
                      {session.revoked ? (
                        <Badge variant="outline" className="h-5 border-black/10 bg-white px-1.5 text-[10px] font-semibold text-muted-foreground">已撤销</Badge>
                      ) : null}
                      {session.current ? (
                        <Badge className="h-5 rounded-full bg-[var(--signal)] px-1.5 text-[10px] font-black text-[var(--ink)]">当前</Badge>
                      ) : null}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      创建于 {relativeTime(session.createdAt)} · 最近使用 {relativeTime(session.lastUsedAt)}
                    </p>
                  </div>
                  {!session.current && !session.revoked ? (
                    <AlertDialog>
                      <AlertDialogTrigger
                        render={<Button variant="outline" size="sm" className="rounded-full bg-white text-muted-foreground" aria-label="撤销该会话" />}
                      >
                        撤销
                      </AlertDialogTrigger>
                      <AlertDialogContent className="border border-black/10 bg-[#f8faf6] p-6 sm:max-w-md">
                        <AlertDialogHeader>
                          <AlertDialogTitle className="text-xl font-black tracking-tight">撤销这个会话？</AlertDialogTitle>
                          <AlertDialogDescription>该设备上的匿名身份将立即失效，需要重新获得新身份。</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel className="rounded-full bg-white">取消</AlertDialogCancel>
                          <AlertDialogAction className="rounded-full bg-[var(--ink)] text-white hover:bg-[var(--ink-soft)]" onClick={() => void revokeSession(session.id)}>
                            确认撤销
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  ) : null}
                </li>
              ))}
            </ul>
            <div className="mt-4 border-t border-[var(--line)] pt-4">
              <AlertDialog>
                <AlertDialogTrigger
                  render={<Button variant="outline" className="gap-2 rounded-full bg-white text-destructive hover:bg-[#fdecea]" />}
                >
                  <LogOut className="size-4" />退出当前设备
                </AlertDialogTrigger>
                <AlertDialogContent className="border border-black/10 bg-[#f8faf6] p-6 sm:max-w-md">
                  <AlertDialogHeader>
                    <AlertDialogTitle className="text-xl font-black tracking-tight">退出当前设备？</AlertDialogTitle>
                  <AlertDialogDescription>
                    本机将退出该匿名身份，令牌立即失效，此设备上的身份不再可用。浏览历史与发布内容会保留给原身份；如需一并清除，请使用「销毁匿名身份」。
                  </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel className="rounded-full bg-white">取消</AlertDialogCancel>
                    <AlertDialogAction className="rounded-full bg-[var(--ink)] text-white hover:bg-[var(--ink-soft)]" onClick={() => void logout()}>
                      确认退出
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </Section>

          <p className="flex items-center gap-2 text-xs text-muted-foreground">
            <Trash2 className="size-3.5" />
            想彻底抹掉更多数据？去
            <Link href="/settings/privacy" className="font-bold text-[var(--signal-dark)] underline underline-offset-4">
              隐私与数据
            </Link>
            管理历史与身份销毁。
          </p>
        </>
      )}
    </div>
  );
}

function cnBadge(tone: 'default' | 'warning' | 'danger'): string {
  switch (tone) {
    case 'warning':
      return 'h-5 rounded-full bg-amber-100 px-2 text-[10px] font-bold text-amber-800 border border-amber-300';
    case 'danger':
      return 'h-5 rounded-full bg-[#fdecea] px-2 text-[10px] font-bold text-[#a02a1f] border border-[#d83b2d]/30';
    default:
      return 'h-5 rounded-full bg-[var(--signal)] px-2 text-[10px] font-black text-[var(--ink)]';
  }
}


function AccountSection({
  me,
  refresh,
}: {
  me: AuthMe | null;
  refresh: RegisteredUserState['refresh'];
}) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [justLoggedOut, setJustLoggedOut] = useState(false);

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
      setUsername('');
      setPassword('');
      setJustLoggedOut(false);
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '操作失败，请稍后重试');
    } finally {
      setBusy(false);
    }
  }

  async function logout() {
    setBusy(true);
    try {
      await apiJson('/api/v1/auth/logout', { method: 'POST' });
      await refresh();
      setJustLoggedOut(true);
    } catch {
      setError('退出失败，请稍后重试');
    } finally {
      setBusy(false);
    }
  }

  if (me) {
    return (
      <Section
        title="注册账号与固定 ID"
        description="用注册身份发帖 / 回复时，内容会跨帖子展示你的用户名与唯一 ID，不再随机变化；仍可随时改用匿名发言。"
      >
        <div className="flex flex-wrap items-center gap-4 rounded-xl bg-[#f8faf6] p-4">
          <span className="grid size-12 place-items-center rounded-full bg-[var(--signal)] text-xl font-black text-[var(--ink)]" aria-hidden="true">
            {me.username.slice(0, 1).toUpperCase()}
          </span>
          <div className="min-w-0 flex-1">
            <p className="flex flex-wrap items-center gap-2 text-lg font-black">
              {me.username}
              <span className="rounded-full bg-[var(--ink)]/[0.06] px-2 py-0.5 font-mono text-[11px] font-bold text-muted-foreground">
                唯一 ID #{me.uid}
              </span>
            </p>
            <p className="mt-0.5 text-sm text-muted-foreground">注册于 {absoluteTime(me.createdAt)}</p>
          </div>
          <Button variant="outline" className="rounded-full bg-white text-muted-foreground" disabled={busy} onClick={() => void logout()}>
            {busy ? '正在退出…' : '退出登录'}
          </Button>
        </div>
        {justLoggedOut ? (
          <p aria-live="polite" className="mt-3 text-sm text-muted-foreground">
            已退出。之后发言将回到匿名身份。
          </p>
        ) : null}
      </Section>
    );
  }

  return (
    <Section
      title="注册账号与固定 ID"
      description="注册后发帖 / 回复可选择「以用户名发言」：每条内容都会带上你的用户名与唯一 ID（#编号），跨帖子可被认出；未注册时只能匿名发言。无需邮箱或手机号。"
    >
      <div className="rounded-xl border border-black/10 bg-white p-4">
        <div className="mb-4 flex gap-2" role="tablist" aria-label="登录或注册">
          {(['login', 'register'] as const).map((item) => (
            <button
              key={item}
              type="button"
              role="tab"
              aria-selected={mode === item}
              onClick={() => setMode(item)}
              className={cn(
                'rounded-full px-4 py-1.5 text-sm font-bold transition-colors',
                mode === item ? 'bg-[var(--ink)] text-white' : 'text-muted-foreground hover:bg-black/5',
              )}
            >
              {item === 'login' ? '登录' : '注册'}
            </button>
          ))}
        </div>
        <form onSubmit={(event) => void submit(event)} className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
          <label className="grid gap-1 text-xs font-bold text-muted-foreground">
            用户名
            <input
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              className="h-10 rounded-lg border border-black/15 bg-white px-3 text-sm font-normal text-foreground outline-none focus:ring-2 focus:ring-[var(--signal)]"
              placeholder="中英文、数字、_-，3-20 字符"
              minLength={3}
              maxLength={20}
              required
              autoComplete="username"
            />
          </label>
          <label className="grid gap-1 text-xs font-bold text-muted-foreground">
            密码
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="h-10 rounded-lg border border-black/15 bg-white px-3 text-sm font-normal text-foreground outline-none focus:ring-2 focus:ring-[var(--signal)]"
              placeholder={mode === 'register' ? '至少 8 位' : '输入密码'}
              minLength={mode === 'register' ? 8 : 1}
              maxLength={72}
              required
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            />
          </label>
          <Button type="submit" disabled={busy || username.trim().length < 3 || password.length < (mode === 'register' ? 8 : 1)} className="self-end rounded-full">
            {busy ? '请稍候…' : mode === 'login' ? '登录' : '注册'}
          </Button>
        </form>
        {error ? (
          <p role="alert" className="mt-3 text-sm font-semibold text-destructive">{error}</p>
        ) : null}
        {mode === 'register' ? (
          <p className="mt-3 text-xs leading-5 text-muted-foreground">
            注册即表示你同意以用户名公开发言的内容无法匿名隐藏；不填写任何真实身份信息，密码仅以不可逆方式存储。
          </p>
        ) : null}
      </div>
    </Section>
  );
}
