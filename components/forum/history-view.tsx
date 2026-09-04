'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { ArrowRight, Bookmark, Clock3, History as HistoryIcon, Trash2 } from 'lucide-react';

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
import { apiJson } from '@/lib/api';
import { absoluteTime, relativeTime } from '@/lib/format';
import type { HistoryData } from '@/lib/forum-types';

export function HistoryView() {
  const [history, setHistory] = useState<HistoryData | null>(null);
  const [offline, setOffline] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await apiJson<HistoryData>('/api/v1/history');
      setHistory(data);
    } catch {
      setOffline(true);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const removeEntry = async (postId: string) => {
    setHistory((current) => (current ? { ...current, entries: current.entries.filter((entry) => entry.postId !== postId) } : current));
    try {
      await apiJson(`/api/v1/history/${encodeURIComponent(postId)}`, { method: 'DELETE' });
    } catch {
      void load();
    }
  };

  const clearAll = async () => {
    try {
      await apiJson('/api/v1/history', { method: 'DELETE' });
      setHistory((current) => (current ? { ...current, entries: [] } : current));
    } catch {
      void load();
    }
  };

  if (offline) {
    return (
      <div className="rounded-2xl border border-amber-500/40 bg-amber-50 p-6 text-amber-950">
        <p className="font-bold">暂时连不上服务器</p>
        <p className="mt-1 text-sm">请稍后刷新重试。</p>
      </div>
    );
  }

  const entries = history?.entries ?? [];
  const enabled = history?.enabled ?? true;

  return (
    <div className="mx-auto w-full max-w-3xl">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="mb-1 text-xs font-black uppercase tracking-[0.18em] text-[var(--signal-dark)]">HISTORY / 浏览历史</p>
          <h1 className="text-3xl font-black tracking-[-0.045em] sm:text-4xl">浏览历史</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            只看得到你读过的帖子与阅读位置，按最近查看排序。历史与匿名账号关联，仅用于续读。
          </p>
        </div>
        {entries.length > 0 ? (
          <AlertDialog>
            <AlertDialogTrigger render={<Button variant="outline" className="gap-1.5 rounded-full bg-white text-destructive hover:bg-[#fdecea]" />}>
              <Trash2 className="size-3.5" />清空全部
            </AlertDialogTrigger>
            <AlertDialogContent className="border border-black/10 bg-[#f8faf6] p-6 sm:max-w-md">
              <AlertDialogHeader>
                <AlertDialogTitle className="text-xl font-black tracking-tight">清空全部浏览历史？</AlertDialogTitle>
                <AlertDialogDescription>
                  阅读位置将一并删除，所有设备都无法再恢复，也无法恢复已清数据。
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel className="rounded-full bg-white">取消</AlertDialogCancel>
                <AlertDialogAction className="rounded-full bg-[#d83b2d] text-white hover:bg-[#b32f24]" onClick={() => void clearAll()}>
                  确认清空
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        ) : null}
      </div>

      {!enabled ? (
        <div className="mt-7 rounded-2xl border border-sky-500/30 bg-sky-50 p-5 text-sky-950">
          <p className="font-bold">云端历史已关闭</p>
          <p className="mt-1 text-sm leading-6">
            服务端已停止记录并删除既有历史。当前浏览不会被保存，“继续阅读”也不可用。你可以随时在隐私设置中重新开启。
          </p>
          <Button className="mt-4 rounded-full bg-[var(--ink)] text-white hover:bg-[var(--ink-soft)]" render={<Link href="/settings/privacy" />}>
            前往隐私设置
          </Button>
        </div>
      ) : null}

      <div className="mt-7 space-y-4">
        {history === null
          ? [0, 1, 2].map((index) => <Skeleton key={index} className="h-28 w-full rounded-2xl" />)
          : null}
        {entries.length === 0 && enabled && history !== null ? (
          <div className="rounded-2xl border border-dashed border-[var(--line)] bg-white/50 px-6 py-16 text-center">
            <HistoryIcon className="mx-auto size-9 text-[var(--line)]" />
            <p className="mt-3 font-bold">还没有浏览记录</p>
            <p className="mt-1 text-sm text-muted-foreground">阅读帖子超过几秒后，会自动记录到这里，方便接着上次的位置继续。</p>
            <Button className="mt-5 rounded-full bg-[var(--ink)] text-white hover:bg-[var(--ink-soft)]" render={<Link href="/boards" />}>
              去逛逛板块 <ArrowRight data-icon="inline-end" />
            </Button>
          </div>
        ) : null}
        {entries.map((entry) => {
          const unread = Math.max(0, entry.totalFloors - entry.maxReadFloor);
          const percent = Math.min(100, Math.round((entry.maxReadFloor / entry.totalFloors) * 100));
          return (
            <article key={entry.postId} className="rounded-2xl border border-black/10 bg-white p-5">
              <div className="flex flex-wrap items-start gap-4">
                <span className="mt-1 hidden size-10 shrink-0 place-items-center rounded-xl bg-[var(--signal)] text-[var(--ink)] sm:grid" aria-hidden="true">
                  <Bookmark className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <Link href={`/b/${entry.board.slug}`} className="font-bold text-foreground hover:underline">
                      {entry.board.name}
                    </Link>
                    <span>·</span>
                    <span className="inline-flex items-center gap-1">
                      <Clock3 className="size-3" />
                      {relativeTime(entry.lastViewedAt)}看过
                    </span>
                    <span title={absoluteTime(entry.lastViewedAt)}>·</span>
                    {unread > 0 ? (
                      <Badge className="h-5 gap-1 rounded-full bg-[var(--signal)] px-2 text-[10px] font-black text-[var(--ink)]">
                        有 {unread} 层新内容
                      </Badge>
                    ) : null}
                  </div>
                  <Link href={`/t/${entry.postId}`} className="mt-1 block font-black leading-snug hover:text-[var(--signal-dark)]">
                    {entry.title}
                  </Link>
                  <div className="mt-3 flex flex-wrap items-center gap-3">
                    <div className="h-1.5 w-40 max-w-full overflow-hidden rounded-full bg-[var(--line)]" aria-hidden="true">
                      <div className="h-full rounded-full bg-[var(--signal-dark)]" style={{ width: `${percent}%` }} />
                    </div>
                    <span className="text-xs text-muted-foreground">
                      上次看到 {entry.maxReadFloor} 楼 / 共 {entry.totalFloors} 楼
                    </span>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Button
                    className="h-9 rounded-full bg-[var(--ink)] px-4 text-white hover:bg-[var(--ink-soft)]"
                    render={<Link href={`/t/${entry.postId}`} />}
                  >
                    继续阅读 <ArrowRight data-icon="inline-end" />
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger render={<Button variant="ghost" size="icon" className="size-9 rounded-full text-muted-foreground hover:bg-[#fdecea] hover:text-destructive" aria-label="删除这条历史记录" />}>
                      <Trash2 className="size-4" />
                    </AlertDialogTrigger>
                    <AlertDialogContent className="border border-black/10 bg-[#f8faf6] p-6 sm:max-w-md">
                      <AlertDialogHeader>
                        <AlertDialogTitle className="text-xl font-black tracking-tight">删除这条记录？</AlertDialogTitle>
                        <AlertDialogDescription>“{entry.title}”的阅读位置会被清除。</AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel className="rounded-full bg-white">取消</AlertDialogCancel>
                        <AlertDialogAction className="rounded-full bg-[#d83b2d] text-white hover:bg-[#b32f24]" onClick={() => void removeEntry(entry.postId)}>
                          确认删除
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
