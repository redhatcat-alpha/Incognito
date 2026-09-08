'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useCallback, useEffect, useState } from 'react';
import { BellRing, ClipboardList, Hash, LogOut, Megaphone, ScrollText, Send } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { apiJson } from '@/lib/api';
import { absoluteTime } from '@/lib/format';
import type { AdminAnnouncement, BoardSummary } from '@/lib/forum-types';
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
type AdminTag = { id: string; slug: string; name: string; color: string; status: 'active' | 'hidden'; postCount: number };
type AdminAudit = { id: string; action: string; targetType: string | null; targetId: string | null; createdAt: number; adminUsername: string };
type AdminEmoji = { id: number; src: string; alt: string; status: 'active' | 'hidden'; updatedAt: number | null };

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
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState('');

  const [list, setList] = useState<AdminAnnouncement[]>([]);
  const [reports, setReports] = useState<AdminReport[]>([]);
  const [boards, setBoards] = useState<BoardSummary[]>([]);
  const [newBoard, setNewBoard] = useState({ slug: '', name: '', description: '', icon: 'message-circle', accent: '#d9ff57' });
  const [tags, setTags] = useState<AdminTag[]>([]);
  const [audit, setAudit] = useState<AdminAudit[]>([]);
  const [emojis, setEmojis] = useState<AdminEmoji[]>([]);
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
      setBoards(await apiJson<BoardSummary[]>('/api/v1/admin/boards'));
      setTags(await apiJson<AdminTag[]>('/api/v1/admin/tags'));
      setAudit(await apiJson<AdminAudit[]>('/api/v1/admin/audit?limit=100'));
      setEmojis(await apiJson<AdminEmoji[]>('/api/v1/admin/emojis'));
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
      setAudit([]);
      setEmojis([]);
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

  async function changePassword(event: { preventDefault: () => void }) {
    event.preventDefault();
    if (newPassword !== confirmPassword) {
      setPasswordError('两次输入的新密码不一致');
      return;
    }
    setChangingPassword(true);
    setPasswordError('');
    try {
      await apiJson('/api/v1/admin/password', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword, confirmPassword }),
      });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      flash('管理员密码已修改');
    } catch (cause) {
      setPasswordError(cause instanceof Error ? cause.message : '密码修改失败');
    } finally {
      setChangingPassword(false);
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

  async function reviewReport(id: string, status: 'resolved' | 'rejected', hideTarget: boolean) {
    try { await apiJson(`/api/v1/admin/reports/${encodeURIComponent(id)}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ status, hideTarget }) }); flash(status === 'resolved' ? '举报已处理' : '举报已驳回'); void refreshList(); }
    catch (cause) { flash(cause instanceof Error ? cause.message : '处理失败'); }
  }

  async function saveBoard(board: BoardSummary) {
    try {
      await apiJson(`/api/v1/admin/boards/${encodeURIComponent(board.slug)}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: board.name, description: board.description, icon: board.icon, accent: board.accent, status: board.status, sortOrder: boards.indexOf(board) }) });
      flash(`板块「${board.name}」已保存`);
    } catch (cause) { flash(cause instanceof Error ? cause.message : '板块保存失败'); }
  }

  async function createBoard(event: { preventDefault: () => void }) {
    event.preventDefault();
    try { const created = await apiJson<BoardSummary>('/api/v1/admin/boards', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ...newBoard, status: 'active', sortOrder: boards.length }) }); setBoards((items) => [...items, created]); setNewBoard({ slug: '', name: '', description: '', icon: 'message-circle', accent: '#d9ff57' }); flash('板块已创建'); }
    catch (cause) { flash(cause instanceof Error ? cause.message : '板块创建失败'); }
  }

  async function saveTag(tag: AdminTag) {
    try { await apiJson(`/api/v1/admin/tags/${encodeURIComponent(tag.slug)}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: tag.name, color: tag.color, status: tag.status }) }); flash(`标签「${tag.name}」已保存`); }
    catch (cause) { flash(cause instanceof Error ? cause.message : '标签保存失败'); }
  }

  async function toggleEmoji(emoji: AdminEmoji) {
    const status = emoji.status === 'active' ? 'hidden' : 'active';
    try {
      await apiJson(`/api/v1/admin/emojis/${emoji.id}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ status }) });
      setEmojis((items) => items.map((item) => item.id === emoji.id ? { ...item, status } : item));
      flash(status === 'active' ? `表情 ${emoji.id} 已恢复` : `表情 ${emoji.id} 已隐藏`);
    } catch (cause) { flash(cause instanceof Error ? cause.message : '表情更新失败'); }
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
          <h2 className="text-lg font-black tracking-tight">修改管理员密码</h2>
          <p className="mt-1 text-sm text-muted-foreground">修改后当前登录会话保持有效，其他设备需要使用新密码重新登录。</p>
          <form onSubmit={(event) => void changePassword(event)} className="mt-5 grid gap-4 sm:max-w-xl">
            <label htmlFor="admin-current-password" className="grid gap-1.5 text-sm font-bold">
              当前密码
              <Input id="admin-current-password" type="password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} className="h-11 border-black/15 bg-white" autoComplete="current-password" required />
            </label>
            <label htmlFor="admin-new-password" className="grid gap-1.5 text-sm font-bold">
              新密码 <span className="font-normal text-muted-foreground">至少 8 位</span>
              <Input id="admin-new-password" type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} className="h-11 border-black/15 bg-white" autoComplete="new-password" minLength={8} required />
            </label>
            <label htmlFor="admin-confirm-password" className="grid gap-1.5 text-sm font-bold">
              确认新密码
              <Input id="admin-confirm-password" type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} className="h-11 border-black/15 bg-white" autoComplete="new-password" minLength={8} required />
            </label>
            {passwordError ? <p role="alert" className="text-sm font-semibold text-destructive">{passwordError}</p> : null}
            <div className="flex justify-end">
              <Button type="submit" disabled={changingPassword || !currentPassword || !newPassword || !confirmPassword} className="rounded-full">
                {changingPassword ? '修改中…' : '修改密码'}
              </Button>
            </div>
          </form>
        </section>

        <section className="rounded-2xl border border-black/10 bg-white p-6">
          <h2 className="flex items-center gap-2 text-lg font-black tracking-tight"><ScrollText className="size-5 text-[var(--signal-dark)]" /> 管理审计日志 <span className="text-sm font-normal text-muted-foreground">（最近 {audit.length} 条）</span></h2>
          <p className="mt-1 text-sm text-muted-foreground">仅记录管理动作、目标与时间，不记录 IP、UA 或内容正文。</p>
          <ul className="mt-4 divide-y divide-[var(--line)]">
            {audit.length === 0 ? <li className="py-6 text-center text-sm text-muted-foreground">暂无审计记录。</li> : null}
            {audit.map((item) => <li key={item.id} className="flex flex-wrap items-center gap-2 py-3 text-sm"><span className="rounded-full bg-[var(--ink)]/[0.06] px-2 py-0.5 font-mono text-xs font-bold">{item.action}</span><span className="text-muted-foreground">{item.targetType ?? '系统'}{item.targetId ? ` · ${item.targetId}` : ''}</span><span className="ml-auto text-xs text-muted-foreground">{item.adminUsername} · {absoluteTime(item.createdAt)}</span></li>)}
          </ul>
        </section>

        <section className="rounded-2xl border border-black/10 bg-white p-6">
          <h2 className="text-lg font-black tracking-tight">标签管理</h2>
          <p className="mt-1 text-sm text-muted-foreground">调整标签名称、颜色和前台可见状态。</p>
          <div className="mt-4 grid gap-2">
            {tags.map((tag) => <div key={tag.slug} className="flex flex-wrap items-center gap-2 rounded-xl border border-black/10 bg-[#f8faf6] p-3"><input className="h-9 min-w-32 flex-1 rounded-lg border border-black/15 bg-white px-2 text-sm" value={tag.name} onChange={(e) => setTags((items) => items.map((item) => item.slug === tag.slug ? { ...item, name: e.target.value } : item))} /><input type="color" className="h-9 w-12 rounded border border-black/15" value={tag.color} onChange={(e) => setTags((items) => items.map((item) => item.slug === tag.slug ? { ...item, color: e.target.value } : item))} /><select className="h-9 rounded-lg border border-black/15 bg-white px-2 text-sm" value={tag.status} onChange={(e) => setTags((items) => items.map((item) => item.slug === tag.slug ? { ...item, status: e.target.value as AdminTag['status'] } : item))}><option value="active">可见</option><option value="hidden">隐藏</option></select><span className="text-xs text-muted-foreground">#{tag.slug} · {tag.postCount}</span><Button size="sm" className="h-8 rounded-full" onClick={() => void saveTag(tag)}>保存</Button></div>)}
          </div>
        </section>

        <section className="rounded-2xl border border-black/10 bg-white p-6">
          <h2 className="text-lg font-black tracking-tight">表情资源管理</h2>
          <p className="mt-1 text-sm text-muted-foreground">隐藏后不会出现在编辑器面板，历史内容仍可正常显示。</p>
          <div className="mt-4 grid grid-cols-6 gap-2 sm:grid-cols-10">
            {emojis.map((emoji) => <button key={emoji.id} type="button" onClick={() => void toggleEmoji(emoji)} title={`${emoji.alt} · ${emoji.status === 'active' ? '隐藏' : '恢复'}`} className={cn('rounded-lg border p-1 text-center text-[10px] font-bold', emoji.status === 'active' ? 'border-black/10 bg-[#f8faf6]' : 'border-dashed border-black/20 opacity-45')}><Image src={emoji.src} alt={emoji.alt} width={24} height={24} unoptimized className="mx-auto size-6 object-contain" /><span>{emoji.id}</span></button>)}
          </div>
        </section>

        <section className="rounded-2xl border border-black/10 bg-white p-6">
          <h2 className="text-lg font-black tracking-tight">板块管理</h2>
          <p className="mt-1 text-sm text-muted-foreground">编辑板块展示信息、状态和排序；隐藏板块不会出现在前台。</p>
          <form onSubmit={(event) => void createBoard(event)} className="mt-4 grid gap-2 rounded-xl border border-dashed border-black/20 p-3 sm:grid-cols-2"><input required pattern="[a-z0-9-]+" placeholder="slug，如 games" className="h-9 rounded-lg border border-black/15 px-2 text-sm" value={newBoard.slug} onChange={(e) => setNewBoard({ ...newBoard, slug: e.target.value })} /><input required placeholder="板块名称" className="h-9 rounded-lg border border-black/15 px-2 text-sm" value={newBoard.name} onChange={(e) => setNewBoard({ ...newBoard, name: e.target.value })} /><input placeholder="板块描述" className="h-9 rounded-lg border border-black/15 px-2 text-sm" value={newBoard.description} onChange={(e) => setNewBoard({ ...newBoard, description: e.target.value })} /><Button type="submit" className="h-9 rounded-full">新建板块</Button></form>
          <div className="mt-4 grid gap-3">
            {boards.map((board, index) => (
              <div key={board.slug} className="rounded-xl border border-black/10 bg-[#f8faf6] p-4">
                <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
                  <label className="grid gap-1 text-xs font-bold">名称<input className="h-9 rounded-lg border border-black/15 bg-white px-2 text-sm font-normal" value={board.name} onChange={(e) => setBoards((items) => items.map((item) => item.slug === board.slug ? { ...item, name: e.target.value } : item))} /></label>
                  <label className="grid gap-1 text-xs font-bold">描述<input className="h-9 rounded-lg border border-black/15 bg-white px-2 text-sm font-normal" value={board.description} onChange={(e) => setBoards((items) => items.map((item) => item.slug === board.slug ? { ...item, description: e.target.value } : item))} /></label>
                  <label className="grid gap-1 text-xs font-bold">状态<select className="h-9 rounded-lg border border-black/15 bg-white px-2 text-sm" value={board.status} onChange={(e) => setBoards((items) => items.map((item) => item.slug === board.slug ? { ...item, status: e.target.value as BoardSummary['status'] } : item))}><option value="active">正常</option><option value="readonly">只读</option><option value="archived">归档</option><option value="hidden">隐藏</option></select></label>
                </div>
                <div className="mt-3 flex items-center justify-between"><span className="text-xs text-muted-foreground">/{board.slug} · {board.postCount} 篇帖子 · 排序 {index + 1}</span><Button size="sm" className="h-8 rounded-full" onClick={() => void saveBoard(board)}>保存</Button></div>
              </div>
            ))}
          </div>
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
                {item.status === 'pending' ? <div className="mt-2 flex gap-2"><Button size="sm" className="h-8 rounded-full" onClick={() => void reviewReport(item.id, 'resolved', true)}>处理并隐藏</Button><Button size="sm" variant="outline" className="h-8 rounded-full bg-white" onClick={() => void reviewReport(item.id, 'rejected', false)}>驳回</Button></div> : <span className="mt-1 inline-block text-xs text-muted-foreground">状态：{item.status === 'resolved' ? '已处理' : '已驳回'}</span>}
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
