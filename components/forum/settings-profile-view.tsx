'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
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
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

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
            <div className="mt-4">
              <p className="mb-2 text-xs font-bold text-muted-foreground">选择一个仅由随机主题组成的头像</p>
              <div className="flex flex-wrap gap-2">
                {['coral-orbit', 'blue-grid', 'lime-wave', 'violet-spark', 'amber-dots', 'mono-ring'].map((seed) => (
                  <button
                    key={seed}
                    type="button"
                    className={`rounded-full p-1 ${profile.avatarSeed === seed ? 'ring-2 ring-[var(--signal-dark)] ring-offset-2' : ''}`}
                    aria-label={`选择头像 ${seed}`}
                    onClick={async () => {
                      try {
                        await apiJson('/api/v1/anon/session', { method: 'PATCH', body: JSON.stringify({ avatarSeed: seed }) });
                        setProfile((current) => (current ? { ...current, avatarSeed: seed } : current));
                      } catch (cause) {
                        setError(cause instanceof Error ? cause.message : '头像更新失败');
                      }
                    }}
                  >
                    <ThreadAvatar seed={seed} label="" className="size-10" />
                  </button>
                ))}
              </div>
              <label className="mt-3 inline-flex cursor-pointer items-center rounded-full border border-black/15 bg-white px-3 py-2 text-xs font-bold hover:bg-black/[0.03]">
                {uploadingAvatar ? '上传中…' : '上传图片头像'}
                <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" disabled={uploadingAvatar} onChange={async (event) => {
                  const file = event.target.files?.[0]; if (!file) return; setUploadingAvatar(true); setError('');
                  try { const form = new FormData(); form.append('file', file); const response = await fetch('/api/v1/media', { method: 'POST', body: form, credentials: 'same-origin' }); const payload = await response.json() as { data?: { url?: string }; error?: { message?: string } }; const url = payload.data?.url; if (!response.ok || !url) throw new Error(payload.error?.message ?? '上传失败'); await apiJson('/api/v1/anon/session', { method: 'PATCH', body: JSON.stringify({ avatarSeed: url }) }); setProfile((current) => current ? { ...current, avatarSeed: url } : current); }
                  catch (cause) { setError(cause instanceof Error ? cause.message : '头像上传失败'); } finally { setUploadingAvatar(false); event.target.value = ''; }
                }} />
              </label>
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
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function logout() {
    setBusy(true);
    setError('');
    try {
      await apiJson('/api/v1/auth/logout', { method: 'POST' });
      await refresh();
      router.replace('/login');
    } catch {
      setError('退出失败，请稍后重试');
      setBusy(false);
    }
  }

  if (!me) {
    return (
      <Section
        title="注册账号与固定 ID"
        description="无需注册即可浏览、发帖和回复；注册仅用于需要固定 ID 的场景，且不收集邮箱或手机号。"
      >
        <Button className="rounded-full bg-[var(--ink)] px-5 text-white hover:bg-[var(--ink-soft)]" render={<Link href="/login" />}>
          前往登录 / 注册
        </Button>
      </Section>
    );
  }

  return (
    <Section
      title="注册账号与固定 ID"
      description="发帖 / 回复时可选择「匿名发言」或「以用户名发言」；以用户名发言时内容跨帖子展示你的用户名与唯一 ID。"
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
      <p className="mt-3 text-xs leading-5 text-muted-foreground">
        退出登录后将回到登录 / 注册页面；再次登录即可继续使用同一用户名与唯一 ID。
      </p>
      {error ? (
        <p role="alert" className="mt-3 text-sm font-semibold text-destructive">{error}</p>
      ) : null}
    </Section>
  );
}
