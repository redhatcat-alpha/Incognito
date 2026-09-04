'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ArrowRight, Lock, MessageCircle } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { BoardIcon } from '@/components/forum/forum-shell';
import { apiJson } from '@/lib/api';
import type { BoardSummary } from '@/lib/forum-types';

export function BoardsView() {
  const [boards, setBoards] = useState<BoardSummary[] | null>(null);
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

  if (offline) {
    return (
      <div className="rounded-2xl border border-amber-500/40 bg-amber-50 p-6 text-amber-950">
        <p className="font-bold">暂时连不上服务器</p>
        <p className="mt-1 text-sm">请稍后刷新重试。</p>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-3xl">
      <p className="mb-1 text-xs font-black uppercase tracking-[0.18em] text-[var(--signal-dark)]">BOARDS / 全部板块</p>
      <h1 className="text-3xl font-black tracking-[-0.045em] sm:text-4xl">讨论板块</h1>
      <p className="mt-2 text-sm text-muted-foreground">每个板块有独立的氛围和规则，挑一个你感兴趣的进去看看。</p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        {boards === null
          ? [0, 1, 2, 3].map((index) => <Skeleton key={index} className="h-36 w-full rounded-2xl" />)
          : boards.map((board) => (
              <Link
                key={board.slug}
                href={`/b/${board.slug}`}
                className="group rounded-2xl border border-[var(--line)] bg-white p-5 transition-shadow hover:shadow-[0_8px_28px_rgb(17_24_21/0.08)]"
              >
                <div className="flex items-start justify-between gap-3">
                  <span className="grid size-11 place-items-center rounded-xl" style={{ backgroundColor: board.accent }}>
                    <BoardIcon name={board.icon} className="size-5" />
                  </span>
                  {board.status !== 'active' ? (
                    <Badge variant="outline" className="h-5 gap-1 border-black/10 bg-white px-2 text-[10px] font-semibold">
                      <Lock className="size-2.5" />
                      {board.status === 'readonly' ? '只读' : '已归档'}
                    </Badge>
                  ) : null}
                </div>
                <h2 className="mt-4 text-lg font-black tracking-tight group-hover:text-[var(--signal-dark)]">{board.name}</h2>
                <p className="mt-1 line-clamp-2 text-sm leading-6 text-muted-foreground">{board.description}</p>
                <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1.5">
                    <MessageCircle className="size-3.5" /> {board.postCount} 条讨论
                  </span>
                  <span className="inline-flex items-center gap-1 font-bold text-[var(--ink)] group-hover:text-[var(--signal-dark)]">
                    进入板块 <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
                  </span>
                </div>
              </Link>
            ))}
      </div>

      {boards !== null && boards.length === 0 ? (
        <div className="mt-10 rounded-2xl border border-dashed border-[var(--line)] py-16 text-center">
          <p className="font-bold">还没有开放板块</p>
          <p className="mt-1 text-sm text-muted-foreground">稍后再来看看吧</p>
          <Button variant="outline" className="mt-4 rounded-full bg-white" render={<Link href="/" />}>
            回首页
          </Button>
        </div>
      ) : null}
    </div>
  );
}
