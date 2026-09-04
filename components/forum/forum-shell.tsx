'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useRegisteredUser } from '@/lib/use-registered-user';
import { useCallback, useEffect, useState } from 'react';
import {
  Bell,
  BookOpen,
  Briefcase,
  Code2,
  Coffee,
  Flame,
  Gamepad2,
  Hash,
  Heart,
  History,
  Home,
  Lightbulb,
  MessageCircle,
  Music,
  PawPrint,
  Search,
  Settings,
  Sparkles,
  UserRound,
  type LucideIcon,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { apiJson } from '@/lib/api';
import { absoluteTime } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { Announcement, BoardSummary } from '@/lib/forum-types';

const boardIcons: Record<string, LucideIcon> = {
  'message-circle': MessageCircle,
  code: Code2,
  flame: Flame,
  coffee: Coffee,
  sparkles: Sparkles,
  lightbulb: Lightbulb,
  heart: Heart,
  'gamepad-2': Gamepad2,
  'book-open': BookOpen,
  briefcase: Briefcase,
  music: Music,
  'paw-print': PawPrint,
};

export function BoardIcon({ name, className }: { name: string; className?: string }) {
  const Icon = boardIcons[name] ?? MessageCircle;
  return <Icon className={className} />;
}

function isPathActive(pathname: string, target: string): boolean {
  if (target === '/') return pathname === '/';
  return pathname === target || pathname.startsWith(`${target}/`);
}

function NavItem({ href, label, icon, active }: { href: string; label: string; icon: LucideIcon; active: boolean }) {
  const Icon = icon;
  return (
    <Link href={href} className={cn('nav-item', active && 'nav-item-active')} aria-current={active ? 'page' : undefined}>
      <Icon /> {label}
    </Link>
  );
}

function useBoardList(): { boards: BoardSummary[]; offline: boolean } {
  const [boards, setBoards] = useState<BoardSummary[]>([]);
  const [offline, setOffline] = useState(false);
  useEffect(() => {
    let cancelled = false;
    apiJson<BoardSummary[]>('/api/v1/boards')
      .then((data) => {
        if (!cancelled) setBoards(data);
      })
      .catch(() => {
        if (!cancelled) setOffline(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);
  return { boards, offline };
}

const levelStyle: Record<Announcement['level'], string> = {
  urgent: 'border-[#d83b2d]/30 bg-[#d83b2d] text-white',
  warning: 'border-amber-500/40 bg-amber-100 text-amber-950',
  reminder: 'border-sky-500/30 bg-sky-100 text-sky-950',
  info: 'border-[var(--line)] bg-white text-[var(--foreground)]',
};

export function ForumShell({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { me } = useRegisteredUser();
  const { boards, offline } = useBoardList();

  function runSearch(form: HTMLFormElement) {
    const raw = new FormData(form).get('q');
    const query = typeof raw === 'string' ? raw.trim() : '';
    router.push(query ? `/search?q=${encodeURIComponent(query)}` : '/search');
  }

  function submitSearch(event: { preventDefault: () => void; currentTarget: HTMLFormElement }) {
    event.preventDefault();
    runSearch(event.currentTarget);
  }

  function handleSearchKey(event: { key: string; preventDefault: () => void; currentTarget: HTMLInputElement }) {
    if (event.key === 'Enter') {
      event.preventDefault();
      if (event.currentTarget.form) runSearch(event.currentTarget.form);
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b border-white/10 bg-[var(--ink)] text-white">
        <div className="mx-auto flex h-16 max-w-[1440px] items-center gap-4 px-4 sm:px-7">
          <Link href="/" className="group flex shrink-0 items-center gap-2.5">
            <span className="grid size-9 place-items-center rounded-full bg-[var(--signal)] text-[var(--ink)] transition-transform group-hover:-rotate-6">
              <Hash className="size-5 stroke-[2.6]" />
            </span>
            <span className="text-lg font-black tracking-[-0.04em]">无名岛</span>
          </Link>
          <form
            action="/search"
            onSubmit={submitSearch}
            className="mx-auto hidden w-full max-w-md items-center rounded-full border border-white/15 bg-white/8 px-4 text-white/60 md:flex"
          >
            <Search className="size-4" />
            <input
              name="q"
              defaultValue=""
              onKeyDown={handleSearchKey}
              className="h-9 w-full bg-transparent px-3 text-sm text-white outline-none placeholder:text-white/40"
              placeholder="搜索帖子、标签"
              aria-label="搜索帖子和标签"
            />
            <button type="submit" className="sr-only" aria-label="提交搜索" tabIndex={-1}>
              搜索
            </button>
            <kbd className="rounded border border-white/15 px-1.5 py-0.5 text-[11px]">/</kbd>
          </form>
          <nav className="ml-auto flex items-center gap-1" aria-label="账户导航">
            <AnnouncementBell />
            <Button
              variant="ghost"
              size="icon"
              className="rounded-full text-white/70 hover:bg-white/10 hover:text-white"
              aria-label="匿名身份设置"
              render={<Link href="/settings/profile" />}
            >
              <UserRound />
            </Button>
          </nav>
        </div>
      </header>

      <div className="border-b border-[#c6dd64] bg-[var(--signal)] text-[var(--ink)]">
        <div className="mx-auto flex min-h-10 max-w-[1440px] items-center gap-3 px-4 py-2 text-sm sm:px-7">
          <Sparkles className="size-4 shrink-0" />
          <p className="font-semibold">这里不需要真实身份。发言前，请先抹去内容里的个人信息。</p>
          <Link href="/rules" className="ml-auto shrink-0 font-bold underline underline-offset-4">
            社区规则
          </Link>
        </div>
      </div>

      <div
        className={cn(
          'mx-auto grid max-w-[1440px] gap-8 px-4 pb-28 pt-8 sm:px-7 lg:pb-16',
          right ? 'lg:grid-cols-[210px_minmax(0,1fr)] xl:grid-cols-[210px_minmax(0,760px)_240px] xl:gap-10' : 'lg:grid-cols-[210px_minmax(0,1fr)] xl:grid-cols-[210px_minmax(0,920px)] xl:gap-10',
        )}
      >
        <aside className="hidden lg:block">
          <div className="sticky top-32 space-y-8">
            <nav className="space-y-1" aria-label="主要导航">
              <NavItem href="/" label="首页" icon={Home} active={isPathActive(pathname, '/')} />
              <NavItem href="/history" label="浏览历史" icon={History} active={isPathActive(pathname, '/history')} />
              <NavItem href="/settings/profile" label="我的设置" icon={Settings} active={isPathActive(pathname, '/settings')} />
            </nav>
            <section aria-labelledby="board-heading">
              <div className="mb-3 flex items-center justify-between px-3">
                <h2 id="board-heading" className="text-xs font-black uppercase tracking-[0.16em] text-muted-foreground">
                  讨论板块
                </h2>
                <span className="text-xs text-muted-foreground">{boards.length || (offline ? '—' : '')}</span>
              </div>
              <div className="space-y-1">
                {!boards.length && !offline ? (
                  <div className="space-y-1 px-3">
                    <Skeleton className="h-9 w-full rounded-xl" />
                    <Skeleton className="h-9 w-full rounded-xl" />
                    <Skeleton className="h-9 w-full rounded-xl" />
                  </div>
                ) : null}
                {boards.map((board) => {
                  const active = pathname.startsWith(`/b/${board.slug}`);
                  return (
                    <Link
                      key={board.slug}
                      href={`/b/${board.slug}`}
                      className={cn(
                        'group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold hover:bg-white',
                        active && 'bg-white shadow-[0_1px_0_rgb(17_24_21/0.06)]',
                      )}
                      aria-current={active ? 'page' : undefined}
                    >
                      <span className="grid size-7 place-items-center rounded-lg" style={{ backgroundColor: board.accent }}>
                        <BoardIcon name={board.icon} className="size-3.5" />
                      </span>
                      <span className="min-w-0 flex-1 truncate">{board.name}</span>
                      {board.status !== 'active' ? (
                        <Badge variant="outline" className="h-5 border-black/10 bg-white px-1.5 text-[10px] font-semibold">
                          {board.status === 'readonly' ? '只读' : '归档'}
                        </Badge>
                      ) : (
                        <span className="text-xs font-normal text-muted-foreground">{board.postCount}</span>
                      )}
                    </Link>
                  );
                })}
              </div>
            </section>
            <div className="rounded-2xl border border-black/10 bg-white p-4 text-sm leading-6">
              <p className="mb-2 flex items-center gap-2 font-bold">
                <span className="size-2 rounded-full bg-emerald-500" />
                {me ? `已登录：${me.username}` : '匿名会话有效'}
              </p>
              <p className="text-muted-foreground">
                无需注册即可浏览和匿名发言；登录后也可选择固定 ID。
              </p>
              <Link href="/settings/profile" className="mt-2 inline-block font-bold text-[var(--signal-dark)] underline underline-offset-4">
                管理身份与隐私
              </Link>
            </div>
          </div>
        </aside>

        <main className="min-w-0">{children}</main>

        {right ? <aside className="hidden xl:block">{right}</aside> : null}
      </div>

      <nav
        className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-4 border-t border-black/10 bg-white/95 px-3 pt-2 backdrop-blur lg:hidden"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        aria-label="移动端导航"
      >
        <Link href="/" className={cn('mobile-nav', pathname === '/' && 'mobile-nav-active')}>
          <Home />首页
        </Link>
        <Link href="/boards" className={cn('mobile-nav', (pathname === '/boards' || pathname.startsWith('/b/')) && 'mobile-nav-active')}>
          <Hash />板块
        </Link>
        <Link href="/history" className={cn('mobile-nav', isPathActive(pathname, '/history') && 'mobile-nav-active')}>
          <History />历史
        </Link>
        <Link href="/settings/profile" className={cn('mobile-nav', isPathActive(pathname, '/settings') && 'mobile-nav-active')}>
          <UserRound />我的
        </Link>
      </nav>
      <AnnouncementModal />
    </div>
  );
}
function AnnouncementModal() {
  const [queue, setQueue] = useState<Announcement[] | null>(null);
  const [index, setIndex] = useState(0);
  const [open, setOpen] = useState(false);
  const [later, setLater] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(() => {
      apiJson<Announcement[]>('/api/v1/announcements')
        .then((items) => {
          if (cancelled) return;
          const unread = items.filter((item) => !item.read);
          setQueue(unread);
          if (unread.length > 0) setOpen(true);
        })
        .catch(() => undefined);
    }, 400);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, []);

  const current = queue && queue.length > 0 ? queue[Math.min(index, queue.length - 1)] : null;

  const markRead = async () => {
    if (!current) return;
    try {
      await apiJson(`/api/v1/announcements/${encodeURIComponent(current.id)}/read`, { method: 'PUT' });
    } catch {
      // 标记失败不阻塞浏览
    }
    setQueue((items) => {
      const next = (items ?? []).filter((item) => item.id !== current.id);
      if (next.length === 0) {
        setOpen(false);
      } else {
        setIndex(0);
        setOpen(true);
      }
      return next;
    });
  };

  return (
    <Dialog open={open && !later} onOpenChange={(next) => { setOpen(next); if (!next) setLater(true); }}>
      <DialogContent className="border border-black/10 bg-[#f8faf6] p-6 sm:max-w-lg">
        {current ? (
          <>
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  'size-2 rounded-full',
                  current.level === 'urgent' ? 'bg-[#d83b2d]' : current.level === 'warning' ? 'bg-amber-500' : 'bg-emerald-500',
                )}
              />
              <Badge className="h-5 rounded-full px-2 text-[10px] font-bold uppercase tracking-wider" variant="outline">
                {current.level === 'urgent' ? '紧急' : current.level === 'warning' ? '提醒' : current.level === 'reminder' ? '提示' : '公告'}
              </Badge>
            </div>
            <h2 className="mt-3 text-xl font-black tracking-tight">{current.title}</h2>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">{current.body}</p>
            <p className="mt-3 text-xs text-muted-foreground">{absoluteTime(current.createdAt)}</p>
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <Button variant="ghost" className="rounded-full text-muted-foreground" onClick={() => setLater(true)}>
                稍后再说
              </Button>
              <Button className="rounded-full bg-[var(--ink)] text-white hover:bg-[var(--ink-soft)]" onClick={() => void markRead()}>
                我知道了，不再显示
              </Button>
            </div>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function AnnouncementBell() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Announcement[] | null>(null);
  const load = useCallback(() => {
    setItems(null);
    apiJson<Announcement[]>('/api/v1/announcements')
      .then(setItems)
      .catch(() => setItems([]));
  }, []);

  const markRead = async (id: string) => {
    try {
      await apiJson(`/api/v1/announcements/${encodeURIComponent(id)}/read`, { method: 'PUT' });
      setItems((current) => (current ?? []).map((item) => (item.id === id ? { ...item, read: true } : item)));
    } catch {
      // 忽略标记失败
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) load();
      }}
    >
      <DialogTrigger
        render={<Button variant="ghost" size="icon" className="rounded-full text-white/70 hover:bg-white/10 hover:text-white" aria-label="站内公告" />}
      >
        <Bell />
      </DialogTrigger>
      <DialogContent className="border border-black/10 bg-[#f8faf6] p-6 sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-xl font-black tracking-tight">站内公告</DialogTitle>
          <DialogDescription>公告会以弹窗提醒未读内容；点击「标为已读」后不再弹窗。</DialogDescription>
        </DialogHeader>
        <div className="grid max-h-[60vh] gap-3 overflow-y-auto py-2">
          {items === null ? (
            <div className="space-y-2">
              <Skeleton className="h-16 w-full rounded-xl" />
              <Skeleton className="h-16 w-full rounded-xl" />
            </div>
          ) : null}
          {items && items.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">暂时没有公告</p>
          ) : null}
          {items?.map((item) => (
            <div key={item.id} className={cn('rounded-xl border p-4', item.read ? 'border-black/5 bg-white/60' : levelStyle[item.level])}>
              <div className="flex items-center gap-2">
                <Badge className="h-5 rounded-full px-2 text-[10px] font-bold uppercase tracking-wider" variant="outline">
                  {item.level === 'urgent' ? '紧急' : item.level === 'warning' ? '提醒' : item.level === 'reminder' ? '提示' : '公告'}
                </Badge>
                <p className="text-sm font-black">{item.title}</p>
                <div className="ml-auto flex shrink-0 items-center gap-2">
                  {item.read ? (
                    <span className="text-xs font-bold text-muted-foreground">已读</span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => void markRead(item.id)}
                      className="rounded-full bg-[var(--ink)] px-3 py-1 text-xs font-bold text-white hover:bg-[var(--ink-soft)]"
                    >
                      标为已读
                    </button>
                  )}
                </div>
              </div>
              <p className="mt-1.5 text-sm leading-6 opacity-90">{item.body}</p>
              <p className="mt-1 text-[11px] opacity-60">{absoluteTime(item.createdAt)}</p>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
