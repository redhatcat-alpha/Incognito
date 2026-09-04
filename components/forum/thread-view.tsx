'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  Check,
  ChevronDown,
  ChevronUp,
  Flag,
  Lock,
  MessageCircle,
  Pencil,
  Share2,
  Trash2,
  TriangleAlert,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { Markdown } from '@/components/forum/markdown';
import { RichEditor } from '@/components/editor/rich-editor';
import { ThreadAvatar } from '@/components/forum/thread-avatar';
import { apiJson } from '@/lib/api';
import { absoluteTime, relativeTime } from '@/lib/format';
import { useRegisteredUser } from '@/lib/use-registered-user';
import type { PostSummary, ReplySummary, ThreadData } from '@/lib/forum-types';
import { reportReasons } from '@/lib/report-reasons';
import { cn } from '@/lib/utils';
import { IdentityPicker, type Identity } from '@/components/forum/identity-picker';

const EDIT_WINDOW_MS = 30 * 60 * 1000;

type GlobalNotice = { tone: 'error' | 'success'; text: string } | null;

function Notice({ notice }: { notice: GlobalNotice }) {
  if (!notice) return null;
  return (
    <p
      role={notice.tone === 'error' ? 'alert' : 'status'}
      className={cn(
        'rounded-xl border px-4 py-3 text-sm font-semibold',
        notice.tone === 'error' ? 'border-[#d83b2d]/30 bg-[#fdecea] text-[#a02a1f]' : 'border-emerald-500/30 bg-emerald-50 text-emerald-900',
      )}
    >
      {notice.text}
    </p>
  );
}

function useNow(): number | null {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const update = () => setNow(Date.now());
    const timeout = window.setTimeout(update, 0);
    const interval = window.setInterval(update, 60_000);
    return () => {
      window.clearTimeout(timeout);
      window.clearInterval(interval);
    };
  }, []);
  return now;
}

function ShareButton() {
  const [copied, setCopied] = useState(false);
  const share = async () => {
    const url = window.location.href;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      const copyable = window.prompt('复制这条链接（Ctrl/Cmd + C）：', url);
      if (copyable !== null) setCopied(true);
    }
    window.setTimeout(() => setCopied(false), 1600);
  };
  return (
    <Button variant="ghost" size="sm" className="gap-1.5 rounded-full text-muted-foreground" onClick={() => void share()}>
      {copied ? <Check className="size-3.5 text-emerald-600" /> : <Share2 className="size-3.5" />}
      {copied ? '已复制链接' : '分享'}
    </Button>
  );
}

function ReportDialog({ targetType, publicId, floorLabel, onReported }: { targetType: 'post' | 'reply'; publicId: string; floorLabel: string; onReported?: () => void }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<string>(reportReasons[0]);
  const [details, setDetails] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  async function submit(event: { preventDefault: () => void }) {
    event.preventDefault();
    setSending(true);
    setError('');
    try {
      await apiJson('/api/v1/reports', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ targetType, publicId, reason, details }),
      });
      setDone(true);
      onReported?.();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '提交失败，请稍后重试');
    } finally {
      setSending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => { setOpen(next); if (!next) window.setTimeout(() => { setDone(false); setDetails(''); setError(''); }, 200); }}>
      <DialogTrigger
        render={<Button variant="ghost" size="sm" className="gap-1.5 rounded-full text-muted-foreground" aria-label={`举报${floorLabel}`} />}
      >
        <Flag className="size-3.5" />举报
      </DialogTrigger>
      <DialogContent className="border border-black/10 bg-[#f8faf6] p-6 sm:max-w-lg">
        {done ? (
          <div className="py-6 text-center">
            <Check className="mx-auto size-10 rounded-full bg-emerald-100 p-2.5 text-emerald-700" />
            <p className="mt-3 text-lg font-black">举报已提交</p>
            <p className="mt-1 text-sm text-muted-foreground">我们会尽快人工复核这条{floorLabel}。</p>
          </div>
        ) : (
          <form onSubmit={submit}>
            <DialogHeader>
              <DialogTitle className="text-xl font-black tracking-tight">举报{floorLabel}</DialogTitle>
              <DialogDescription>请选择举报原因，补充说明会帮助管理员更快核实。</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-5">
              <label htmlFor="report-reason" className="grid gap-1.5 text-sm font-semibold">
                原因
                <select
                  id="report-reason"
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  className="h-10 rounded-lg border border-black/15 bg-white px-3 font-normal outline-none focus:ring-2 focus:ring-[var(--signal)]"
                >
                  {reportReasons.map((item) => (
                    <option key={item} value={item}>{item}</option>
                  ))}
                </select>
              </label>
              <label htmlFor="report-details" className="grid gap-1.5 text-sm font-semibold">
                补充说明 <span className="font-normal text-muted-foreground">可选，最多 500 字</span>
                <Textarea
                  id="report-details"
                  value={details}
                  onChange={(event) => setDetails(event.target.value)}
                  className="min-h-24 border-black/15 bg-white leading-6"
                  maxLength={500}
                />
              </label>
              {error ? <p role="alert" className="text-sm font-semibold text-destructive">{error}</p> : null}
            </div>
            <DialogFooter>
              <Button type="submit" disabled={sending} className="rounded-full">
                {sending ? '正在提交…' : '提交举报'}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

function useAutoResize(ref: React.RefObject<HTMLTextAreaElement | null>, value: string) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = '0px';
    el.style.height = `${Math.min(320, el.scrollHeight)}px`;
  }, [ref, value]);
}

export function ThreadView({ postId }: { postId: string }) {
  const [thread, setThread] = useState<ThreadData | null>(null);
  const [loadError, setLoadError] = useState('');
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<GlobalNotice>(null);
  const { me } = useRegisteredUser();
  const [quote, setQuote] = useState<{ replyId: string; floorNo: number; alias: string } | null>(null);
  const [draft, setDraft] = useState('');
  const [identity, setIdentity] = useState<Identity>('anonymous');
  const [sending, setSending] = useState(false);
  const [readFloor, setReadFloor] = useState(1);
  const [busyVotes, setBusyVotes] = useState<Set<string>>(new Set());
  const readFloorRef = useRef(1);
  const draftRef = useRef<HTMLTextAreaElement | null>(null);
  useAutoResize(draftRef, draft);

  const bumpRead = useCallback((floor: number) => {
    if (floor > readFloorRef.current) {
      readFloorRef.current = floor;
      setReadFloor(floor);
    }
  }, []);

  const flashTimers = useRef<number[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiJson<ThreadData>(`/api/v1/posts/${encodeURIComponent(postId)}`);
      setThread(data);
      const initial = data.history?.maxReadFloor ?? 1;
      readFloorRef.current = initial;
      setReadFloor(initial);
      setLoadError('');
    } catch (cause) {
      setLoadError(cause instanceof Error ? cause.message : '加载失败');
      setThread(null);
    } finally {
      setLoading(false);
    }
  }, [postId]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const flashFloor = useCallback((element: Element) => {
    element.classList.add('floor-flash');
    const timer = window.setTimeout(() => element.classList.remove('floor-flash'), 2600);
    flashTimers.current.push(timer);
  }, []);

  const scrollToFloorNo = useCallback(
    (floorNo: number, announce: boolean) => {
      const floor = Math.max(1, Math.min(floorNo, thread?.totalFloors ?? 1));
      const target =
        document.querySelector<HTMLElement>(`[data-floor-no="${floor}"]`) ??
        document.querySelector<HTMLElement>('[data-floor-no]');
      if (!target) return;
      const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      target.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
      flashFloor(target);
      if (announce) {
        const live = document.getElementById('floor-announcer');
        if (live) live.textContent = `已跳转到 ${floor} 楼`;
      }
    },
    [thread, flashFloor],
  );

  // 阅读进度：记录完整看过的最大楼层，5 秒防抖保存；离开页面时尽力补发。
  useEffect(() => {
    if (!thread) return undefined;
    let lastSavedFloor = readFloorRef.current;
    let saveTimer: number | undefined;
    const mountedAt = Date.now();

    const persist = (floor: number) => {
      if (floor <= lastSavedFloor) return;
      lastSavedFloor = floor;
      const visible = document.querySelector(`[data-floor-no="${floor}"]`);
      const anchor = visible?.getAttribute('id')?.replace('floor-', '') ?? null;
      fetch(`/api/v1/history/${encodeURIComponent(postId)}`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ maxReadFloor: floor, anchorReplyId: anchor }),
        keepalive: true,
        credentials: 'same-origin',
      }).catch(() => undefined);
    };

    const schedule = (floor: number) => {
      if (saveTimer) window.clearTimeout(saveTimer);
      saveTimer = window.setTimeout(() => persist(floor), 5000);
    };

    const computeSeen = () => {
      if (Date.now() - mountedAt < 3000) return;
      const floors = document.querySelectorAll<HTMLElement>('[data-floor-no]');
      let maxSeen = readFloorRef.current;
      let topFloor = 0;
      const viewportMiddle = window.innerHeight * 0.62;
      for (const el of floors) {
        const rect = el.getBoundingClientRect();
        const floorNo = Number(el.dataset.floorNo ?? 1);
        if (floorNo <= topFloor) continue;
        // 楼层顶部滚过视口中线，视为已被读完
        if (rect.top < viewportMiddle && rect.bottom > 0) {
          maxSeen = Math.max(maxSeen, floorNo);
          topFloor = floorNo;
        }
      }
      if (maxSeen > lastSavedFloor) {
        bumpRead(maxSeen);
        schedule(maxSeen);
      }
    };

    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(() => {
        ticking = false;
        computeSeen();
      });
    };

    const onHidden = () => {
      if (document.visibilityState === 'hidden' && Date.now() - mountedAt > 3000 && readFloorRef.current > lastSavedFloor) {
        persist(readFloorRef.current);
      }
    };

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting && entry.intersectionRatio >= 0.8) {
            const floorNo = Number((entry.target as HTMLElement).dataset.floorNo ?? 1);
            bumpRead(floorNo);
            schedule(floorNo);
          }
        }
      },
      { threshold: [0.8] },
    );

    window.addEventListener('scroll', onScroll, { passive: true });
    document.addEventListener('visibilitychange', onHidden);
    document.querySelectorAll<HTMLElement>('[data-floor-no]').forEach((el) => observer.observe(el));

    return () => {
      window.removeEventListener('scroll', onScroll);
      document.removeEventListener('visibilitychange', onHidden);
      observer.disconnect();
      if (saveTimer) window.clearTimeout(saveTimer);
      if (readFloorRef.current > lastSavedFloor) persist(readFloorRef.current);
    };
  }, [thread, postId, bumpRead]);

  useEffect(() => () => flashTimers.current.forEach((timer) => window.clearTimeout(timer)), []);

  const unreadCount = useMemo(() => (thread ? Math.max(0, thread.totalFloors - readFloor) : 0), [thread, readFloor]);
  const progressPercent = useMemo(() => {
    if (!thread) return 0;
    return Math.min(100, Math.round((readFloor / thread.totalFloors) * 100));
  }, [thread, readFloor]);

  const quoteMap = useMemo(() => new Map(thread?.replies.map((reply) => [reply.id, reply]) ?? []), [thread]);

  // 分层会话模型：直接回复楼主(无引用)的楼层为顶层，其余回复按引用链归入对应顶层楼层
  const layers = useMemo(() => {
    if (!thread) return [];
    const byId = new Map(thread.replies.map((reply) => [reply.id, reply]));
    const isDirect = (reply: ReplySummary) => !reply.quoteReplyId;
    const roots = thread.replies.filter(isDirect);
    const childrenOf = new Map<string, ReplySummary[]>();
    const orphan: ReplySummary[] = [];
    for (const reply of thread.replies) {
      if (isDirect(reply)) continue;
      let parent = reply.quoteReplyId ? byId.get(reply.quoteReplyId) : undefined;
      let hops = 0;
      while (parent && !isDirect(parent) && hops < 12) {
        parent = parent.quoteReplyId ? byId.get(parent.quoteReplyId) : undefined;
        hops += 1;
      }
      const anchor = parent && isDirect(parent) ? parent : [...roots].reverse().find((root) => root.floorNo < reply.floorNo);
      if (!anchor) {
        orphan.push(reply);
        continue;
      }
      const list = childrenOf.get(anchor.id) ?? [];
      list.push(reply);
      childrenOf.set(anchor.id, list);
    }
    for (const list of childrenOf.values()) list.sort((a, b) => a.floorNo - b.floorNo);
    const sections = roots.map((root) => ({ root, children: childrenOf.get(root.id) ?? [] }));
    for (const reply of orphan) sections.push({ root: reply, children: [] });
    sections.sort((a, b) => a.root.floorNo - b.root.floorNo);
    return sections;
  }, [thread]);
  const post = thread?.post;
  const mine = post?.isMine;
  const now = useNow();
  const canEdit = Boolean(mine && post && post.status === 'published' && now !== null && now - post.createdAt <= EDIT_WINDOW_MS);

  const quoteThis = useCallback((reply: ReplySummary) => {
    setQuote({ replyId: reply.id, floorNo: reply.floorNo, alias: reply.alias });
    document.getElementById('reply-composer')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    window.setTimeout(() => {
      const textarea = document.querySelector<HTMLTextAreaElement>('#reply-composer textarea');
      textarea?.focus();
    }, 300);
  }, []);

  async function submitReply(event: { preventDefault: () => void }) {
    event.preventDefault();
    if (!thread || !draft.trim()) return;
    setSending(true);
    setNotice(null);
    try {
      await apiJson(`/api/v1/posts/${encodeURIComponent(postId)}/replies`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ body: draft.trim(), quoteReplyId: quote?.replyId ?? null, identity }),
      });
      const newFloorNo = thread.totalFloors + 1;
      setDraft('');
      setQuote(null);
      await load();
      window.setTimeout(() => scrollToFloorNo(newFloorNo, true), 120);
    } catch (cause) {
      setNotice({ tone: 'error', text: cause instanceof Error ? cause.message : '发布失败，请稍后重试' });
    } finally {
      setSending(false);
    }
  }

  function toggleVote(replyOrPost: 'post' | 'reply', publicId: string, intent: -1 | 0 | 1) {
    if (!thread) return;
    const voteKey = `${replyOrPost}:${publicId}`;
    if (busyVotes.has(voteKey)) return;
    const currentVote =
      replyOrPost === 'post' ? thread.post.currentVote : (thread.replies.find((reply) => reply.id === publicId)?.currentVote ?? 0);
    const targetValue = currentVote === intent ? 0 : intent;
    setBusyVotes((current) => new Set(current).add(voteKey));
    setThread((current) => {
      if (!current) return current;
      const mutate = (item: { currentVote: -1 | 0 | 1; upCount: number; downCount: number }) => {
        const next = item.currentVote === targetValue ? 0 : targetValue;
        const upDelta = (next === 1 ? 1 : 0) - (item.currentVote === 1 ? 1 : 0);
        const downDelta = (next === -1 ? 1 : 0) - (item.currentVote === -1 ? 1 : 0);
        const upCount = Math.max(0, item.upCount + upDelta);
        const downCount = Math.max(0, item.downCount + downDelta);
        return { ...item, currentVote: next, upCount, downCount, score: upCount - downCount };
      };
      if (replyOrPost === 'post') {
        return { ...current, post: { ...current.post, ...mutate(current.post) } };
      }
      return { ...current, replies: current.replies.map((reply) => (reply.id === publicId ? { ...reply, ...mutate(reply) } : reply)) };
    });
    void apiJson(`/api/v1/votes/${replyOrPost}/${encodeURIComponent(publicId)}`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ value: targetValue }),
    })
      .then((result) => {
        const data = result as { currentVote: -1 | 0 | 1; upCount: number; downCount: number; score: number };
        setThread((current) => {
          if (!current) return current;
          if (replyOrPost === 'post') {
            return {
              ...current,
              post: { ...current.post, currentVote: data.currentVote, upCount: data.upCount, downCount: data.downCount, score: data.score },
            };
          }
          return {
            ...current,
            replies: current.replies.map((reply) =>
              reply.id === publicId ? { ...reply, currentVote: data.currentVote, upCount: data.upCount, downCount: data.downCount, score: data.score } : reply,
            ),
          };
        });
      })
      .catch((cause: unknown) => {
        setNotice({ tone: 'error', text: cause instanceof Error ? cause.message : '投票失败，请稍后重试' });
        void load();
      })
      .finally(() => {
        setBusyVotes((current) => {
          const next = new Set(current);
          next.delete(voteKey);
          return next;
        });
      });
  }

  if (loading) {    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="h-40 w-full rounded-2xl" />
        {[0, 1].map((index) => <Skeleton key={index} className="h-32 w-full rounded-2xl" />)}
      </div>
    );
  }

  if (loadError || !thread || !post) {
    return (
      <div className="rounded-2xl border border-dashed border-[var(--line)] bg-white/60 px-6 py-20 text-center">
        <p className="text-2xl font-black tracking-tight">帖子不见了</p>
        <p className="mt-2 text-sm text-muted-foreground">{loadError || '它可能已被删除，或链接有误。'}</p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Button className="rounded-full bg-[var(--ink)] text-white hover:bg-[var(--ink-soft)]" render={<Link href="/" />}>
            回到首页
          </Button>
          <Button variant="outline" className="rounded-full bg-white" render={<Link href="/boards" />}>
            查看板块
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[820px] space-y-6">
      <div className="min-w-0">
        <div className="mb-4 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <Link href={`/b/${post.board.slug}`} className="inline-flex items-center gap-1 font-bold text-[var(--foreground)] hover:text-[var(--signal-dark)]">
            <ArrowLeft className="size-4" /> {post.board.name}
          </Link>
          <span>·</span>
          <span>主帖 1 楼</span>
          <span>·</span>
          <span>{relativeTime(post.createdAt)}</span>
          {post.updatedAt - post.createdAt > 60_000 ? <span>· 已编辑</span> : null}
          {post.status === 'locked' ? (
            <Badge className="h-5 gap-1 rounded-full bg-[var(--ink)] px-2 text-[10px] font-bold text-white">
              <Lock className="size-2.5" />已锁定
            </Badge>
          ) : null}
        </div>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-black leading-tight tracking-[-0.03em] sm:text-[2rem]">
            {post.status === 'deleted' ? '帖子已删除' : post.title}
          </h1>
        </div>
        {post.tags.length ? (
          <div className="mb-4 flex flex-wrap gap-2">
            {post.tags.map((tag) => (
              <Link key={tag} href={`/search?tag=${encodeURIComponent(tag)}`}>
                <Badge variant="outline" className="h-6 border-black/10 bg-white px-2.5 font-normal hover:border-[var(--signal-dark)]"># {tag}</Badge>
              </Link>
            ))}
          </div>
        ) : null}
      </div>

      <Notice notice={notice} />
      <p id="floor-announcer" className="sr-only" aria-live="polite" />

      {post.status === 'deleted' ? (
        <div className="rounded-2xl border border-black/10 bg-white p-6">
          <p className="inline-flex items-center gap-2 rounded-full bg-[var(--ink)]/[0.05] px-3 py-1 text-xs font-bold text-muted-foreground">
            <Trash2 className="size-3.5" />原帖已删除
          </p>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            楼主已删除这篇帖子，下面的楼层讨论仍然保留。
          </p>
        </div>
      ) : (
        <article className="rounded-2xl border border-black/10 bg-white p-5 sm:p-7">
          <div className="mb-4 flex items-center gap-3">
            <ThreadAvatar seed={post.authorName ? `user:${post.authorName}` : post.board.accent + post.id} label="" className="size-11" />
            <div className="min-w-0">
              <p className="flex flex-wrap items-center gap-2">
                <span className="font-black">{post.authorName ?? '楼主'}</span>
                {post.authorName ? <span className="text-[10px] font-bold text-muted-foreground">ID #{post.authorUid}</span> : null}
                {post.isMine ? <Badge variant="outline" className="h-5 border-[var(--signal-dark)]/40 bg-[var(--signal)]/30 px-1.5 text-[10px] font-bold">我发布的</Badge> : null}
              </p>
              <p className="text-xs text-muted-foreground">{absoluteTime(post.createdAt)}</p>
            </div>
            <div className="ml-auto flex items-center gap-1">
              <ShareButton />
              <ReportDialog targetType="post" publicId={post.id} floorLabel="主帖" />
            </div>
          </div>
          <Markdown text={post.body} />
          <div className="mt-6 flex flex-wrap items-center gap-2 border-t border-[var(--line)] pt-4">
            <VoteButton item={post} onVote={(value) => toggleVote('post', post.id, value)} disabled={post.isMine || busyVotes.has(`post:${post.id}`)} />
            <div className="ml-auto flex items-center gap-1">
              {canEdit ? (
                <PostEditDialog
                  post={post}
                  onSaved={(updated) => {
                    setThread((current) => (current ? { ...current, post: updated } : current));
                    setNotice({ tone: 'success', text: '帖子已更新' });
                  }}
                />
              ) : null}
              {mine && post.status === 'published' ? (
                <AlertDialog>
                  <AlertDialogTrigger
                    render={<Button variant="ghost" size="sm" className="gap-1.5 rounded-full text-destructive hover:bg-[#fdecea]" aria-label="删除我的帖子" />}
                  >
                    <Trash2 className="size-3.5" />删除帖子
                  </AlertDialogTrigger>
                  <AlertDialogContent className="border border-black/10 bg-[#f8faf6] p-6 sm:max-w-md">
                    <AlertDialogHeader>
                      <AlertDialogTitle className="text-xl font-black tracking-tight">删除整篇帖子？</AlertDialogTitle>
                      <AlertDialogDescription>
                        {post.replyCount > 0
                          ? '主帖将立即变成“原帖已删除”的占位符，楼层里的讨论仍会保留。'
                          : '这篇帖子将从公开列表移除，此操作不可撤销。'}
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel className="rounded-full bg-white">取消</AlertDialogCancel>
                      <AlertDialogAction
                        className="rounded-full bg-[#d83b2d] text-white hover:bg-[#b32f24]"
                        onClick={() => {
                          void apiJson(`/api/v1/posts/${encodeURIComponent(post.id)}`, { method: 'DELETE' })
                            .then(() => { setNotice({ tone: 'success', text: '帖子已删除' }); void load(); })
                            .catch((cause: unknown) => setNotice({ tone: 'error', text: cause instanceof Error ? cause.message : '删除失败' }));
                        }}
                      >
                        确认删除
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              ) : null}
            </div>
          </div>
        </article>
      )}

      {unreadCount > 0 && thread.history ? (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-[var(--signal-dark)]/30 bg-[var(--signal)]/40 px-4 py-3">
          <TriangleAlert className="size-4 shrink-0 text-[var(--signal-dark)]" />
          <p className="min-w-0 flex-1 text-sm font-semibold">
            上次看到 {readFloor} 楼 · 还有 {unreadCount} 层新内容
          </p>
          <Button className="h-9 rounded-full bg-[var(--ink)] px-4 text-white hover:bg-[var(--ink-soft)]" onClick={() => scrollToFloorNo(readFloor + 1, true)}>
            继续阅读
          </Button>
        </div>
      ) : null}

      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-base font-black">
            <MessageCircle className="size-4 text-[var(--signal-dark)]" /> 全部回复
            <span className="text-sm font-normal text-muted-foreground">
              ({thread.replies.filter((reply) => reply.floorNo > 0).length} 层
              {thread.replies.some((reply) => reply.floorNo === 0) ? ` · 含 ${thread.replies.filter((reply) => reply.floorNo === 0).length} 条层内回复` : ''})
            </span>
          </h2>
          {readFloor > 1 ? (
            <p className="flex items-center gap-2 text-xs text-muted-foreground" aria-hidden="true">
              <span className="h-1.5 w-24 overflow-hidden rounded-full bg-[var(--line)]">
                <span className="block h-full rounded-full bg-[var(--signal-dark)]" style={{ width: `${progressPercent}%` }} />
              </span>
              {readFloor}/{thread.totalFloors} 楼
            </p>
          ) : null}
        </div>
        {thread.replies.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[var(--line)] bg-white/50 px-6 py-14 text-center">
            <p className="font-bold">还没有人回复</p>
            <p className="mt-1 text-sm text-muted-foreground">来抢 2 楼，成为第一个回应楼主的人</p>
          </div>
        ) : (
          <div className="space-y-4">
            {layers.map((layer) => (
              <FloorLayer
                key={layer.root.id}
                layer={layer}
                postStatus={post.status}
                quoteMap={quoteMap}
                onQuote={quoteThis}
                onVote={(reply, value) => toggleVote('reply', reply.id, value)}
                onChanged={() => { void load(); }}
                notify={setNotice}
                busyIds={busyVotes}
              />
            ))}
          </div>
        )}
      </div>

      <div id="reply-composer" className="scroll-mt-24 rounded-2xl border border-black/10 bg-white p-5">
        <h2 className="mb-1 flex items-center gap-2 text-base font-black">
          <MessageCircle className="size-4 text-[var(--signal-dark)]" /> 回复楼主
        </h2>
        {post.status === 'locked' ? (
          <p className="inline-flex items-center gap-2 rounded-xl bg-[var(--ink)]/[0.05] px-4 py-3 text-sm font-semibold text-muted-foreground">
            <Lock className="size-4" /> 帖子已锁定，暂时不能回复
          </p>
        ) : post.status === 'deleted' ? (
          <p className="text-sm text-muted-foreground">原帖已删除，楼层已关闭回复。</p>
        ) : !thread.canReply ? (
          <p className="inline-flex items-center gap-2 rounded-xl bg-[var(--ink)]/[0.05] px-4 py-3 text-sm font-semibold text-muted-foreground">
            <Lock className="size-4" /> 当前匿名账号暂时不能发言
          </p>
        ) : (
          <form onSubmit={(event) => void submitReply(event)}>
            <div className="mb-3">
              <IdentityPicker me={me} value={identity} onChange={setIdentity} />
            </div>
            {quote ? (
              <div className="mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-black/10 bg-[#f8faf6] px-3 py-2 text-sm">
                <span className="text-muted-foreground">正在引用{quote.floorNo > 0 ? ` ${quote.floorNo} 楼` : ''}</span>
                <span className="font-bold">{quote.alias}</span>
                <button type="button" className="ml-auto rounded-full px-2 py-0.5 text-xs font-bold text-destructive hover:bg-[#fdecea]" onClick={() => setQuote(null)}>
                  取消引用
                </button>
              </div>
            ) : null}
            {quote ? (
              <>
                <Textarea
                  ref={draftRef}
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  placeholder="回复层主的内容仅支持普通文字。"
                  className="min-h-20 border-black/15 bg-white leading-6"
                  maxLength={10000}
                  required
                />
                <p className="mt-2 text-xs text-muted-foreground">层内回复仅支持普通文字 · 最大 10,000 字</p>
              </>
            ) : (
              <>
                <RichEditor
                  id="reply-rich-editor"
                  value={draft}
                  onChange={setDraft}
                  placeholder="友善、具体地说点什么。不要泄露自己或他人的隐私信息。"
                  maxLength={10000}
                  minHeightClass="min-h-32"
                />
                <p className="mt-2 text-xs text-muted-foreground">直接回复楼主的楼层内容支持富文本 · 最大 10,000 字</p>
              </>
            )}
            <div className="mt-3 flex items-center gap-3">
              <span className="ml-auto text-xs text-muted-foreground">{draft.length}/10000</span>
              <Button type="submit" disabled={sending || !draft.trim()} className="rounded-full px-5">
                {sending ? '正在发布…' : '匿名回复'}
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

function VoteButton({
  item,
  onVote,
  disabled,
}: {
  item: { currentVote: -1 | 0 | 1; upCount: number; downCount: number };
  onVote: (value: -1 | 0 | 1) => void;
  disabled: boolean;
}) {
  return (
    <div className="flex items-center gap-1">
      <Button
        variant="outline"
        size="sm"
        disabled={disabled}
        aria-pressed={item.currentVote === 1}
        aria-label="赞同"
        onClick={() => onVote(1)}
        className={cn('h-8 gap-1 rounded-full border-black/10 bg-white px-3 text-sm font-bold hover:border-black/20', item.currentVote === 1 && 'border-[var(--signal-dark)] bg-[var(--signal)]')}
      >
        <ChevronUp className="size-4" /> {item.upCount}
      </Button>
      <span className="px-0.5 text-sm font-bold tabular-nums">{item.upCount - item.downCount > 0 ? `+${item.upCount - item.downCount}` : item.upCount - item.downCount}</span>
      <Button
        variant="outline"
        size="sm"
        disabled={disabled}
        aria-pressed={item.currentVote === -1}
        aria-label="反对"
        onClick={() => onVote(-1)}
        className={cn('h-8 gap-1 rounded-full border-black/10 bg-white px-3 text-sm font-bold hover:border-black/20', item.currentVote === -1 && 'border-[#ff795b]/60 bg-[#ffeae4] text-[#c2452a]')}
      >
        <ChevronDown className="size-4" /> {item.downCount}
      </Button>

    </div>
  );
}

const PREVIEW_SUB_REPLIES = 3;

type FloorLayerModel = { root: ReplySummary; children: ReplySummary[] };

function FloorLayer({
  layer,
  postStatus,
  quoteMap,
  onQuote,
  onVote,
  onChanged,
  notify,
  busyIds,
}: {
  layer: FloorLayerModel;
  postStatus: string;
  quoteMap: Map<string, ReplySummary>;
  onQuote: (reply: ReplySummary) => void;
  onVote: (reply: ReplySummary, value: -1 | 0 | 1) => void;
  onChanged: () => void;
  notify: (notice: GlobalNotice) => void;
  busyIds: Set<string>;
}) {
  const [expanded, setExpanded] = useState(false);
  const { root, children } = layer;
  const shown = expanded ? children : children.slice(0, PREVIEW_SUB_REPLIES);
  const hiddenCount = children.length - shown.length;

  return (
    <Floor
      reply={root}
      postStatus={postStatus}
      quotedReply={root.quoteReplyId ? quoteMap.get(root.quoteReplyId) : undefined}
      onQuote={() => onQuote(root)}
      onVote={(value) => onVote(root, value)}
      onChanged={onChanged}
      notify={notify}
      voteBusy={busyIds.has(`reply:${root.id}`)}
      childrenArea={
        children.length > 0 ? (
          <div className="mt-4 border-t border-[var(--line)] pt-3">
            <p className="px-1 text-[11px] font-black uppercase tracking-[0.14em] text-muted-foreground">
              回复本层 · {children.length} 条
            </p>
            <div className="mt-2 overflow-hidden rounded-xl border border-[#e5ebe1] bg-[#fbfdf8]">
              {shown.map((child) => (
                <SubReplyRow
                  key={child.id}
                  child={child}
                  postStatus={postStatus}
                  quotedReply={child.quoteReplyId ? quoteMap.get(child.quoteReplyId) : undefined}
                  onQuote={() => onQuote(child)}
                  onVote={(value) => onVote(child, value)}
                  onChanged={onChanged}
                  notify={notify}
                  voteBusy={busyIds.has(`reply:${child.id}`)}
                />
              ))}
              {children.length > PREVIEW_SUB_REPLIES ? (
                <button
                  type="button"
                  aria-expanded={expanded}
                  onClick={() => setExpanded((value) => !value)}
                  className="flex w-full items-center justify-center gap-2 border-t border-[#e5ebe1] bg-white/50 px-4 py-2.5 text-sm font-bold text-muted-foreground transition-colors hover:bg-white hover:text-foreground"
                >
                  {expanded ? (
                    <>
                      <ChevronUp className="size-4" /> 收起本层回复
                    </>
                  ) : (
                    <>
                      <ChevronDown className="size-4" /> 展开其余 {hiddenCount} 条回复
                    </>
                  )}
                </button>
              ) : null}
            </div>
          </div>
        ) : undefined
      }
    />
  );
}

function shortAlias(alias: string): string {
  return alias === '楼主' ? alias : alias.replace('匿名 ', '').trim() || alias;
}

function floorLabelOf(reply: ReplySummary): string {
  return reply.floorNo > 0 ? `${reply.floorNo} 楼` : '层内回复';
}

/** 对层主的回复：默认一行紧凑展示“A → B 回复：…”，可展开为完整楼层 */
function SubReplyRow({
  child,
  postStatus,
  quotedReply,
  onQuote,
  onVote,
  onChanged,
  notify,
  voteBusy,
}: {
  child: ReplySummary;
  postStatus: string;
  quotedReply: ReplySummary | undefined;
  onQuote: () => void;
  onVote: (value: -1 | 0 | 1) => void;
  onChanged: () => void;
  notify: (notice: GlobalNotice) => void;
  voteBusy: boolean;
}) {
  const [showDetail, setShowDetail] = useState(false);
  const recipientAlias = child.quoteReplyId ? (quotedReply?.status === 'published' ? quotedReply.alias : null) : null;

  if (child.status === 'deleted') {
    return (
      <div className="flex items-center gap-2 border-t border-[#e5ebe1] px-3 py-2 text-xs text-muted-foreground first:border-t-0">
        <span>层内回复 · 内容已删除</span>
      </div>
    );
  }

  return (
    <div className="border-t border-[#e5ebe1] first:border-t-0">
      <div className="flex items-center gap-2 px-3 py-2 text-sm">
        <span className={cn('font-bold', child.isOwner && 'text-[var(--signal-dark)]')}>{shortAlias(child.alias)}</span>
        <span className="text-xs text-muted-foreground" aria-hidden="true">→</span>
        <span className={cn('truncate font-bold', recipientAlias === null && 'text-muted-foreground')}>
          {recipientAlias === null ? (child.quoteReplyId ? '已删除楼层' : shortAlias(child.alias)) : shortAlias(recipientAlias)}
        </span>
        <span className="shrink-0 text-muted-foreground" aria-hidden="true">回复：</span>
        <span className="min-w-0 flex-1 truncate text-[var(--ink)]" title={child.body}>
          {child.body}
        </span>
        <span className="shrink-0 text-[11px] text-muted-foreground" title={absoluteTime(child.createdAt)}>
          {relativeTime(child.createdAt)}
        </span>
        <button
          type="button"
          aria-expanded={showDetail}
          aria-label={showDetail ? '收起这条层内回复详情' : '展开这条层内回复详情'}
          onClick={() => setShowDetail((value) => !value)}
          className={cn(
            'grid size-6 shrink-0 place-items-center rounded-full text-muted-foreground transition-transform hover:bg-black/5 hover:text-foreground',
            showDetail && 'rotate-180',
          )}
        >
          <ChevronDown className="size-4" />
        </button>
      </div>
      {showDetail ? (
        <div className="border-t border-[#e5ebe1] bg-white p-2.5 sm:p-3">
          <Floor
            reply={child}
            nested
            postStatus={postStatus}
            quotedReply={quotedReply}
            onQuote={onQuote}
            onVote={onVote}
            onChanged={onChanged}
            notify={notify}
            voteBusy={voteBusy}
          />
        </div>
      ) : null}
    </div>
  );
}

function Floor({
  reply,
  postStatus,
  quotedReply,
  onQuote,
  onVote,
  onChanged,
  notify,
  voteBusy,
  nested = false,
  childrenArea,
}: {
  reply: ReplySummary;
  postStatus: string;
  quotedReply: ReplySummary | undefined;
  onQuote: () => void;
  onVote: (value: -1 | 0 | 1) => void;
  onChanged: () => void;
  notify: (notice: GlobalNotice) => void;
  voteBusy: boolean;
  nested?: boolean;
  childrenArea?: React.ReactNode;
}) {
  const [editing, setEditing] = useState(false);
  const [editDraft, setEditDraft] = useState(reply.body);
  const [saving, setSaving] = useState(false);
  const now = useNow();
  const editable =
    reply.isMine &&
    reply.status === 'published' &&
    postStatus === 'published' &&
    now !== null &&
    now - reply.createdAt <= EDIT_WINDOW_MS;

  async function saveEdit(event: { preventDefault: () => void }) {
    event.preventDefault();
    if (!editDraft.trim()) return;
    setSaving(true);
    try {
      await apiJson(`/api/v1/replies/${encodeURIComponent(reply.id)}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ body: editDraft.trim() }),
      });
      setEditing(false);
      notify({ tone: 'success', text: `${reply.floorNo} 楼已更新` });
      onChanged();
    } catch (cause) {
      notify({ tone: 'error', text: cause instanceof Error ? cause.message : '保存失败' });
    } finally {
      setSaving(false);
    }
  }

  return (
    <article
      id={`floor-${reply.id}`}
      data-floor-no={reply.floorNo > 0 ? reply.floorNo : undefined}
      className={cn(
        'scroll-mt-24 border',
        nested ? 'rounded-xl border-[#e5ebe1] bg-[#fbfdf8] p-3.5 sm:p-4' : 'rounded-2xl border-black/10 bg-white p-4 sm:p-5',
      )}
    >
      {reply.status === 'deleted' ? (
        <div className="flex items-center gap-3 py-1">
          <span className="grid size-8 place-items-center rounded-full bg-[var(--ink)]/[0.06] text-muted-foreground" aria-hidden="true">
            <Trash2 className="size-3.5" />
          </span>
          <p className="text-sm text-muted-foreground">
            <span className="font-bold">{reply.floorNo > 0 ? `${reply.floorNo} 楼` : '层内回复'}</span> · 内容已删除
          </p>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            {reply.floorNo > 0 ? (
              <span className="rounded-full bg-[var(--ink)]/[0.05] px-2 py-0.5 font-mono text-[11px] font-bold text-muted-foreground" aria-label={`${reply.floorNo} 楼`}>
                {reply.floorNo}F
              </span>
            ) : null}
            <div className="flex min-w-0 items-center gap-2">
              <ThreadAvatar seed={reply.avatarSeed} label={reply.alias.replace('匿名 ', '').replace('楼主', '主')} className={nested ? 'size-7' : 'size-8'} />
              <span className={cn('font-black', reply.isOwner && 'text-[var(--signal-dark)]')}>{reply.alias}</span>
              {reply.isOwner ? <Badge variant="outline" className="h-5 border-[var(--signal-dark)]/40 bg-[var(--signal)]/25 px-1.5 text-[10px] font-bold">楼主</Badge> : null}
              {reply.isMine ? <Badge variant="outline" className="h-5 border-black/10 bg-white px-1.5 text-[10px] font-semibold text-muted-foreground">我</Badge> : null}
            </div>
            <span className="text-xs text-muted-foreground" title={absoluteTime(reply.createdAt)}>
              {relativeTime(reply.createdAt)}
            </span>
            {reply.updatedAt - reply.createdAt > 60_000 ? <span className="text-xs text-muted-foreground">· 已编辑</span> : null}
            <div className="ml-auto flex items-center gap-0.5">
              {editable ? (
                <Button variant="ghost" size="sm" className="h-8 gap-1 rounded-full px-2 text-xs font-semibold text-muted-foreground" onClick={() => { setEditDraft(reply.body); setEditing(true); }}>
                  <Pencil className="size-3" />编辑
                </Button>
              ) : null}
              {reply.isMine && postStatus !== 'deleted' ? (
                <AlertDialog>
                  <AlertDialogTrigger
                    render={<Button variant="ghost" size="sm" className="h-8 gap-1 rounded-full px-2 text-xs font-semibold text-destructive hover:bg-[#fdecea]" aria-label="删除这条回复" />}
                  >
                    <Trash2 className="size-3" />删除
                  </AlertDialogTrigger>
                  <AlertDialogContent className="border border-black/10 bg-[#f8faf6] p-6 sm:max-w-md">
                    <AlertDialogHeader>
                      <AlertDialogTitle className="text-xl font-black tracking-tight">
                        删除{reply.floorNo > 0 ? ` ${reply.floorNo} 楼的回复` : '这条层内回复'}？
                      </AlertDialogTitle>
                      <AlertDialogDescription>楼层号会保留，但内容立即变为占位符，此操作不可撤销。</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel className="rounded-full bg-white">取消</AlertDialogCancel>
                      <AlertDialogAction
                        className="rounded-full bg-[#d83b2d] text-white hover:bg-[#b32f24]"
                        onClick={() => {
                          void apiJson(`/api/v1/replies/${encodeURIComponent(reply.id)}`, { method: 'DELETE' })
                            .then(() => { notify({ tone: 'success', text: `${reply.floorNo} 楼已删除` }); onChanged(); })
                            .catch((cause: unknown) => notify({ tone: 'error', text: cause instanceof Error ? cause.message : '删除失败' }));
                        }}
                      >
                        确认删除
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              ) : null}
            </div>
          </div>
          {editing ? (
            <form onSubmit={(event) => void saveEdit(event)} className="mt-3">
              {reply.floorNo > 0 ? (
                <RichEditor id="floor-edit-body" value={editDraft} onChange={setEditDraft} minHeightClass="min-h-24" maxLength={10000} />
              ) : (
                <Textarea value={editDraft} onChange={(event) => setEditDraft(event.target.value)} className="border-black/15 bg-white" maxLength={10000} required />
              )}
              <div className="mt-2 flex justify-end gap-2">
                <Button type="button" variant="ghost" size="sm" className="rounded-full" onClick={() => setEditing(false)}>取消</Button>
                <Button type="submit" size="sm" disabled={saving || !editDraft.trim()} className="rounded-full">{saving ? '保存中…' : '保存修改'}</Button>
              </div>
            </form>
          ) : (
            <div className="mt-3">
              {quotedReply ? (
                <QuotedReply reply={quotedReply} />
              ) : reply.quoteReplyId ? (
                <div className="mb-3 rounded-xl border border-dashed border-black/10 bg-[#f8faf6] px-4 py-2.5 text-sm text-muted-foreground">
                  <span className="font-bold">引用楼层已删除</span> · 原内容不可用
                </div>
              ) : null}
              <Markdown text={reply.body} />
              <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-[var(--line)] pt-3">
                <VoteButton item={reply} onVote={onVote} disabled={reply.isMine || voteBusy} />
                <Button variant="ghost" size="sm" className="gap-1.5 rounded-full text-muted-foreground" onClick={onQuote}>
                  <MessageCircle className="size-3.5" />引用
                </Button>
                <ReportDialog targetType="reply" publicId={reply.id} floorLabel={floorLabelOf(reply)} />
              </div>
            </div>
          )}
        </>
      )}
      {childrenArea ? <div className="mt-1">{childrenArea}</div> : null}
    </article>
  );
}

function QuotedReply({ reply }: { reply: ReplySummary }) {
  return (
    <div className="mb-3 rounded-xl border-l-[3px] border-[var(--signal-dark)] bg-[#f8faf6] px-4 py-2.5 text-sm">
      <p className="text-xs font-bold text-muted-foreground">
        {reply.alias || '匿名用户'}
        {reply.floorNo > 0 ? ` · ${reply.floorNo} 楼` : ' · 层内回复'}
      </p>
      <p className="mt-1 line-clamp-2 text-muted-foreground">{reply.body.slice(0, 120)}</p>
    </div>
  );
}

function PostEditDialog({ post, onSaved }: { post: PostSummary; onSaved: (post: PostSummary) => void }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(post.title);
  const [body, setBody] = useState(post.body);
  const [tags, setTags] = useState(post.tags.join(', '));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function submit(event: { preventDefault: () => void }) {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      const data = await apiJson<PostSummary>(`/api/v1/posts/${encodeURIComponent(post.id)}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          title,
          body,
          tags: tags.split(/[,，]/).map((tag) => tag.trim()).filter(Boolean).slice(0, 5),
        }),
      });
      onSaved(data);
      setOpen(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '保存失败');
    } finally {
      setSaving(false);
    }
  }

  const now = useNow();
  const minutesLeft =
    now === null ? null : Math.max(0, Math.round((post.createdAt + EDIT_WINDOW_MS - now) / 60000));

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={<Button variant="ghost" size="sm" className="gap-1.5 rounded-full text-muted-foreground" aria-label="编辑我的帖子" title={minutesLeft === null ? undefined : minutesLeft > 0 ? `发布 ${minutesLeft} 分钟内可编辑` : '已超过可编辑时间'} />}
      >
        <Pencil className="size-3.5" />编辑帖子
      </DialogTrigger>
      <DialogContent className="border border-black/10 bg-[#f8faf6] p-6 sm:max-w-xl">
        <form onSubmit={(event) => void submit(event)}>
          <DialogHeader>
            <DialogTitle className="text-xl font-black tracking-tight">编辑帖子</DialogTitle>
            <DialogDescription>
              发布后 30 分钟内可修改（剩余约 {minutesLeft ?? '…'} 分钟）。标题、正文和标签可一起修改。
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-5">
            <label htmlFor="edit-title" className="grid gap-1.5 text-sm font-semibold">
              标题
              <Input id="edit-title" value={title} onChange={(event) => setTitle(event.target.value)} className="h-10 border-black/15 bg-white" minLength={4} maxLength={120} required />
            </label>
            <label htmlFor="edit-body" className="grid gap-1.5 text-sm font-semibold">
              正文 <span className="font-normal text-muted-foreground">支持富文本</span>
              <RichEditor id="edit-body" value={body} onChange={setBody} maxLength={20000} minHeightClass="min-h-36" />
            </label>
            <label htmlFor="edit-tags" className="grid gap-1.5 text-sm font-semibold">
              标签 <span className="font-normal text-muted-foreground">逗号分隔，最多 5 个</span>
              <Input id="edit-tags" value={tags} onChange={(event) => setTags(event.target.value)} className="h-10 border-black/15 bg-white" />
            </label>
            {error ? <p role="alert" className="text-sm font-semibold text-destructive">{error}</p> : null}
          </div>
          <DialogFooter>
            <Button type="submit" disabled={saving || title.trim().length < 4 || !body.trim()} className="rounded-full">
              {saving ? '保存中…' : '保存修改'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
