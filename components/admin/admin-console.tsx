'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { BellRing, ClipboardList, Hash, LogOut, Megaphone, Send } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { apiJson } from '@/lib/api';
import { absoluteTime } from '@/lib/format';
import type { AdminAnnouncement } from '@/lib/forum-types';
import { cn } from '@/lib/utils';

const levels = [
  { value: 'info', label: '公告', className: 'bg-white text-foreground border-black/15' },
  { value: 'reminder', label: '提示', className: 'bg-sky-100 text-sky-900 border-sky-400/40' },
  { value: 'warning', label: '提醒', className: 'bg-amber-100 text-amber-900 border-amber-500/40' },
  { value: 'urgent', label: '紧急', className: 'bg-[#d83b2d] text-white border-[#d83b2d]' },
] as const;

type Level = (typeof levels)[number]['value'];
type AdminMe = { username: string; role: string } | null;
type AdminReport = { id: string; targetType: 'post' | 'reply'; targetPublicId: string; targetTitle: string; reason: string; details: string; status: string; createdAt: number };

export function AdminConsole() {
  const [me, setMe] = useState<AdminMe | null>(null);
  const [checking, setChecking] = useState(true);

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loggingIn, setLoggingIn] = useState(false);

  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [level, setLevel] = useState<Level>('info');
  const [endsAtLocal, setEndsAtLocal] = useState('');
  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState('');
  const [notice, setNotice] = useState('');

  const [list, setList] = useState<AdminAnnouncement[]>([]);
  const [reports, setReports] = useState<AdminReport[]>([]);
  const [siteSettings, setSiteSettings] = useState({ name: '', shortName: '', description: '', primaryColor: '#d9ff57' });
  const [savingSettings, setSavingSettings] = useState(false);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const refreshList = useCallback(async () => {
    try {
      const data = await apiJson<AdminAnnouncement[]>('/api/v1/admin/announcements');
      setList(data);
      const reportData = await apiJson<AdminReport[]>('/api/v1/admin/reports');
      setReports(reportData);
      const settingsData = await apiJson<typeof siteSettings>('/api/v1/admin/site-settings');
      setSiteSettings(settingsData);
    } catch {
      // 列表加载失败静默
    }
  }, []);

  const checkMe = useCallback(async () => {
    try {
      const data = await apiJson<AdminMe>('/api/v1/admin/me');
      setMe(data);
      if (data) void refreshList();
    } catch {
      setMe(null);
    } finally {
      setChecking(false);
    }
  }, [refreshList]);

  useEffect(() => {
    const timer = window.setTimeout(() => void checkMe(), 0);
    return () => window.clearTimeout(timer);
  }, [checkMe]);

  const flash = (text: string) => {
    setNotice(text);
    window.setTimeout(() => setNotice(''), 3000);
  };

  async function login(event: { preventDefault: () => void }) {
    event.preventDefault();
    setLoggingIn(true);
    setLoginError('');
    try {
      const data = await apiJson<AdminMe>('/api/v1/admin/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), password }),
      });
      setMe(data);
      setPassword('');
      void refreshList();
    } catch (cause) {
      setLoginError(cause instanceof Error ? cause.message : '登录失败');
    } finally {
      setLoggingIn(false);
    }
  }

  async function logout() {
    try {
      await apiJson('/api/v1/admin/logout', { method: 'POST' });
    } finally {
      setMe(null);
      setList([]);
    }
  }

  async function publish(event: { preventDefault: () => void }) {
    event.preventDefault();
    setPublishing(true);
    setPublishError('');
    try {
      const endsAtMs = endsAtLocal ? new Date(endsAtLocal).getTime() : null;
      await apiJson('/api/v1/admin/announcements', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ title: title.trim(), body: body.trim(), level, endsAt: endsAtMs }),
      });
      setTitle('');
      setBody('');
      setEndsAtLocal('');
      flash('公告已发布，用户端将以弹窗提醒');
      void refreshList();
    } catch (cause) {
      setPublishError(cause instanceof Error ? cause.message : '发布失败');
    } finally {
      setPublishing(false);
    }
  }

  async function archive(id: string) {
    try {
      await apiJson(`/api/v1/admin/announcements/${encodeURIComponent(id)}`, { method: 'DELETE' });
      flash('公告已下架');
      void refreshList();
    } catch (cause) {
      flash(cause instanceof Error ? cause.message : '下架失败');
    }
    setConfirmId(null);
  }

  async function saveSettings(event: { preventDefault: () => void }) {
    event.preventDefault(); setSavingSettings(true);
    try { const saved = await apiJson<typeof siteSettings>('/api/v1/admin/site-settings', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(siteSettings) }); setSiteSettings(saved); flash('站点设置已保存'); }
    catch (cause) { flash(cause instanceof Error ? cause.message : '保存失败'); }
    finally { setSavingSettings(false); }
  }

  if (checking) {
    return (
      <div className="grid min-h-screen place-items-center bg-[#f4f7f2] text-sm font-bold text-muted-foreground">
        <span className="size-8 animate-spin rounded-full border-2 border-[var(--line)] border-t-[var(--signal-dark)]" aria-hidden="true" />
      </div>
    );
  }

  if (!me) {
    return (
      <div className="grid min-h-screen place-items-center bg-[#f4f7f2] px-5">
        <div className="w-full max-w-sm rounded-3xl border border-black/10 bg-white p-7 shadow-[0_10px_40px_rgb(17_24_21/0.06)]">
          <p className="flex items-center gap-2 text-2xl font-black tracking-tight">
            <span className="grid size-9 place-items-center rounded-full bg-[var(--ink)] text-[var(--signal)]"><Hash className="size-5" /></span>
            无名岛 · 管理后台
          </p>
          <p className="mt-2 text-sm text-muted-foreground">公告管理需要管理员账号登录。</p>
          <form onSubmit={(event) => void login(event)} className="mt-6 grid gap-4">
            <label htmlFor="admin-username" className="grid gap-1.5 text-sm font-bold">
              管理员用户名
              <Input id="admin-username" value={username} onChange={(event) => setUsername(event.target.value)} className="h-11 border-black/15 bg-white" autoComplete="username" required />
            </label>
            <label htmlFor="admin-password" className="grid gap-1.5 text-sm font-bold">
              密码
              <Input id="admin-password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} className="h-11 border-black/15 bg-white" autoComplete="current-password" required />
            </label>
            {loginError ? <p role="alert" className="text-sm font-semibold text-destructive">{loginError}</p> : null}
            <Button type="submit" disabled={loggingIn || !username.trim() || !password} className="h-11 rounded-full">
              {loggingIn ? '登录中…' : '登录管理后台'}
            </Button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f4f7f2] text-[var(--foreground)]">
      <header className="border-b border-white/10 bg-[var(--ink)] text-white">
        <div className="mx-auto flex h-14 max-w-3xl items-center gap-3 px-5">
          <span className="grid size-8 place-items-center rounded-full bg-[var(--signal)] text-[var(--ink)]"><Hash className="size-4" /></span>
          <p className="font-black tracking-tight">无名岛 · 管理后台</p>
          <p className="text-xs text-white/50">公告管理</p>
          <div className="ml-auto flex items-center gap-2">
            <span className="text-xs font-bold text-white/70">{me.username}（{me.role}）</span>
            <Button variant="ghost" size="sm" className="gap-1.5 rounded-full text-white/70 hover:bg-white/10 hover:text-white" onClick={() => void logout()}>
              <LogOut className="size-3.5" />退出
            </Button>
            <Button variant="ghost" size="sm" className="rounded-full text-white/70 hover:bg-white/10 hover:text-white" render={<Link href="/" />}>
              返回前台
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-3xl gap-6 px-5 py-8">
        {notice ? (
          <p aria-live="polite" className="rounded-xl border border-emerald-500/30 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-900">
            {notice}
          </p>
        ) : null}

        <section className="rounded-2xl border border-black/10 bg-white p-6">
          <h1 className="flex items-center gap-2 text-lg font-black tracking-tight">
            <Megaphone className="size-5 text-[var(--signal-dark)]" /> 发布公告
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">发布后，所有未读用户会在进入论坛时看到弹窗；点击「已读」后不再显示。</p>
          <form onSubmit={(event) => void publish(event)} className="mt-5 grid gap-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-bold">级别</span>
              {levels.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  aria-pressed={level === item.value}
                  onClick={() => setLevel(item.value)}
                  className={cn(
                    'rounded-full border px-3.5 py-1.5 text-xs font-bold transition-colors',
                    level === item.value ? item.className : 'border-black/10 bg-white text-muted-foreground hover:border-black/30',
                  )}
                >
                  {item.label}
                </button>
              ))}
            </div>
            <label htmlFor="ann-title" className="grid gap-1.5 text-sm font-bold">
              公告标题
              <Input id="ann-title" value={title} onChange={(event) => setTitle(event.target.value)} className="h-11 border-black/15 bg-white" placeholder="一句话说清楚" maxLength={120} required />
            </label>
            <label htmlFor="ann-body" className="grid gap-1.5 text-sm font-bold">
              公告正文
              <Textarea id="ann-body" value={body} onChange={(event) => setBody(event.target.value)} className="min-h-28 border-black/15 bg-white leading-6" placeholder="补充说明、生效范围、注意事项…" maxLength={5000} required />
            </label>
            <label htmlFor="ann-ends" className="grid gap-1.5 text-sm font-bold">
              结束时间 <span className="font-normal text-muted-foreground">可选；留空表示长期有效</span>
              <input
                id="ann-ends"
                type="datetime-local"
                value={endsAtLocal}
                onChange={(event) => setEndsAtLocal(event.target.value)}
                className="h-11 rounded-xl border border-black/15 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-[var(--signal)]"
              />
            </label>
            {publishError ? <p role="alert" className="text-sm font-semibold text-destructive">{publishError}</p> : null}
            <div className="flex justify-end">
              <Button type="submit" disabled={publishing || !title.trim() || !body.trim()} className="gap-2 rounded-full">
                <Send className="size-4" />{publishing ? '发布中…' : '发布公告'}
              </Button>
            </div>
          </form>
        </section>

        <section className="rounded-2xl border border-black/10 bg-white p-6">
          <h2 className="text-lg font-black tracking-tight">站点设置</h2>
          <p className="mt-1 text-sm text-muted-foreground">修改后会应用于前台导航与站点描述。</p>
          <form onSubmit={(event) => void saveSettings(event)} className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1 text-sm font-bold">站点名称<input className="h-10 rounded-xl border border-black/15 px-3 font-normal" value={siteSettings.name} onChange={(e) => setSiteSettings({ ...siteSettings, name: e.target.value })} /></label>
            <label className="grid gap-1 text-sm font-bold">简称<input className="h-10 rounded-xl border border-black/15 px-3 font-normal" value={siteSettings.shortName} onChange={(e) => setSiteSettings({ ...siteSettings, shortName: e.target.value })} /></label>
            <label className="grid gap-1 text-sm font-bold sm:col-span-2">站点描述<textarea className="min-h-20 rounded-xl border border-black/15 px-3 py-2 font-normal" value={siteSettings.description} onChange={(e) => setSiteSettings({ ...siteSettings, description: e.target.value })} /></label>
            <label className="grid gap-1 text-sm font-bold">主题色<input type="color" className="h-10 w-20 rounded border border-black/15" value={siteSettings.primaryColor} onChange={(e) => setSiteSettings({ ...siteSettings, primaryColor: e.target.value })} /></label>
            <div className="flex items-end justify-end"><Button type="submit" disabled={savingSettings}>{savingSettings ? '保存中…' : '保存设置'}</Button></div>
          </form>
        </section>

        <section className="rounded-2xl border border-black/10 bg-white p-6">
          <h2 className="flex items-center gap-2 text-lg font-black tracking-tight"><ClipboardList className="size-5 text-[var(--signal-dark)]" /> 举报队列 <span className="text-sm font-normal text-muted-foreground">（{reports.filter((item) => item.status === 'pending').length} 待处理）</span></h2>
          <ul className="mt-4 divide-y divide-[var(--line)]">
            {reports.length === 0 ? <li className="py-6 text-center text-sm text-muted-foreground">暂无举报记录。</li> : null}
            {reports.map((item) => (
              <li key={item.id} className="py-3 text-sm">
                <div className="flex flex-wrap items-center gap-2"><span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-900">{item.reason}</span><span className="text-xs text-muted-foreground">{item.targetType === 'post' ? '帖子' : '回复'} · {absoluteTime(item.createdAt)}</span></div>
                <p className="mt-1 font-bold">{item.targetTitle}</p>
                {item.details ? <p className="mt-1 text-muted-foreground">{item.details}</p> : null}
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-2xl border border-black/10 bg-white p-6">
          <h2 className="flex items-center gap-2 text-lg font-black tracking-tight">
            <BellRing className="size-5 text-[var(--signal-dark)]" /> 已发布公告
            <span className="text-sm font-normal text-muted-foreground">（{list.length}）</span>
          </h2>
          <ul className="mt-4 divide-y divide-[var(--line)]">
            {list.length === 0 ? (
              <li className="py-8 text-center text-sm text-muted-foreground">还没有公告，先发布一条试试。</li>
            ) : null}
            {list.map((item) => {
              const levelMeta = levels.find((l) => l.value === item.level) ?? levels[0];
              return (
                <li key={item.id} className="flex flex-wrap items-start gap-3 py-4">
                  <span className={cn('mt-0.5 rounded-full border px-2 py-0.5 text-[10px] font-bold', levelMeta.className)}>{levelMeta.label}</span>
                  <div className="min-w-0 flex-1">
                    <p className={cn('font-black leading-snug', item.status !== 'published' && 'text-muted-foreground line-through')}>{item.title}</p>
                    <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{item.body}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {absoluteTime(item.createdAt)}
                      {item.endsAt ? ` · 至 ${absoluteTime(item.endsAt)}` : ''} · 已读 {item.readCount} 人
                    </p>
                  </div>
                  {item.status === 'published' ? (
                    confirmId === item.id ? (
                      <button
                        type="button"
                        onClick={() => void archive(item.id)}
                        className="rounded-full bg-[#d83b2d] px-3 py-1.5 text-xs font-bold text-white hover:bg-[#b32f24]"
                      >
                        再次点击确认下架
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirmId(item.id)}
                        className="rounded-full border border-black/10 bg-white px-3 py-1.5 text-xs font-bold text-muted-foreground hover:border-[#d83b2d]/40 hover:text-[#a02a1f]"
                      >
                        下架
                      </button>
                    )
                  ) : (
                    <span className="rounded-full bg-[var(--ink)]/[0.05] px-3 py-1.5 text-xs font-bold text-muted-foreground">已下架</span>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      </main>
    </div>
  );
}
