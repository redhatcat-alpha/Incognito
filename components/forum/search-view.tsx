'use client';

import Link from '@/lib/static-link';
import { useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { SearchX } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { PostList } from '@/components/forum/post-list';
import { apiJson } from '@/lib/api';
import type { BoardSummary, PostSummary } from '@/lib/forum-types';

type SearchResult = { query: string; total: number; posts: PostSummary[] };

export function SearchView() {
  const params = useSearchParams();
  const query = params.get('q') ?? '';
  const board = params.get('board') ?? '';
  const tag = params.get('tag') ?? '';
  const [boards, setBoards] = useState<BoardSummary[]>([]);
  const [result, setResult] = useState<SearchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const timer = window.setTimeout(() => {
      apiJson<BoardSummary[]>('/api/v1/boards')
        .then(setBoards)
        .catch(() => undefined);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    const keywordTrimmed = query.trim();
    let cancelled = false;
    const timer = window.setTimeout(() => {
      if (!keywordTrimmed) {
        setResult(null);
        setError('');
        return;
      }
      setLoading(true);
      setError('');
      const searchParams = new URLSearchParams({ q: keywordTrimmed });
      if (board) searchParams.set('board', board);
      if (tag) searchParams.set('tag', tag);
      apiJson<SearchResult>(`/api/v1/search?${searchParams.toString()}`)
        .then((data) => {
          if (!cancelled) setResult(data);
        })
        .catch((cause: unknown) => {
          if (!cancelled) {
            setResult(null);
            setError(cause instanceof Error ? cause.message : '搜索失败，请稍后重试');
          }
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, 0);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [query, board, tag]);

  const updateParams = (patch: { q?: string; board?: string; tag?: string }) => {
    const next = new URLSearchParams();
    const q = patch.q !== undefined ? patch.q : query;
    const b = patch.board !== undefined ? patch.board : board;
    const t = patch.tag !== undefined ? patch.tag : tag;
    if (q.trim()) next.set('q', q.trim());
    if (b) next.set('board', b);
    if (t) next.set('tag', t);
    window.location.assign(next.size ? `/search?${next.toString()}` : '/search');
  };

  const selectedBoard = boards.find((item) => item.slug === board);
  const filterChips = [
    selectedBoard ? { key: 'board', label: `板块：${selectedBoard.name}`, clear: () => updateParams({ board: '' }) } : null,
    tag ? { key: 'tag', label: `标签：#${tag}`, clear: () => updateParams({ tag: '' }) } : null,
  ].filter((item): item is { key: string; label: string; clear: () => void } => item !== null);

  return (
    <div className="mx-auto w-full max-w-3xl">
      <p className="mb-1 text-xs font-black uppercase tracking-[0.18em] text-[var(--signal-dark)]">SEARCH / 搜索</p>
      <h1 className="text-3xl font-black tracking-[-0.045em] sm:text-4xl">搜索公开讨论</h1>
      <p className="mt-2 text-sm text-muted-foreground">搜索帖子标题与正文。隐藏、待审和已删除的内容不会出现。</p>

      <form
        className="mt-6 flex flex-col gap-3 sm:flex-row"
        onSubmit={(event) => {
          event.preventDefault();
          const value = new FormData(event.currentTarget).get('q');
          updateParams({ q: typeof value === 'string' ? value : '' });
        }}
        aria-label="搜索帖子"
      >
        <input
          key={query}
          name="q"
          defaultValue={query}
          placeholder="输入关键词，例如：SQLite、远程办公"
          aria-label="搜索关键词"
          className="h-12 min-w-0 flex-1 rounded-2xl border border-black/15 bg-white px-4 text-[0.95rem] outline-none focus:ring-2 focus:ring-[var(--signal)]"
          maxLength={100}
        />
        <Button type="submit" className="h-12 rounded-2xl bg-[var(--ink)] px-6 text-white hover:bg-[var(--ink-soft)]">
          搜索
        </Button>
      </form>

      {boards.length ? (
        <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
          <span className="text-xs font-semibold text-muted-foreground">范围：</span>
          <button
            type="button"
            onClick={() => updateParams({ board: '' })}
            className={!board ? 'rounded-full bg-[var(--ink)] px-3 py-1 text-xs font-bold text-white' : 'rounded-full border border-black/10 bg-white px-3 py-1 text-xs font-semibold hover:border-black/25'}
          >
            全部板块
          </button>
          {boards.map((item) => (
            <button
              key={item.slug}
              type="button"
              onClick={() => updateParams({ board: item.slug === board ? '' : item.slug })}
              className={item.slug === board ? 'rounded-full bg-[var(--ink)] px-3 py-1 text-xs font-bold text-white' : 'rounded-full border border-black/10 bg-white px-3 py-1 text-xs font-semibold hover:border-black/25'}
            >
              {item.name}
            </button>
          ))}
        </div>
      ) : null}

      {filterChips.length ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {filterChips.map((chip) => (
            <button
              key={chip.key}
              type="button"
              onClick={chip.clear}
              className="inline-flex items-center gap-1.5 rounded-full border border-[var(--signal-dark)]/40 bg-[var(--signal)]/30 px-3 py-1 text-xs font-bold text-[var(--signal-dark)] hover:bg-[var(--signal)]/60"
              aria-label={`清除筛选：${chip.label}`}
            >
              {chip.label} ✕
            </button>
          ))}
        </div>
      ) : null}

      <div className="mt-7">
        {!query.trim() ? (
          <div className="rounded-2xl border border-dashed border-[var(--line)] bg-white/50 px-6 py-16 text-center">
            <SearchX className="mx-auto size-9 text-[var(--line)]" />
            <p className="mt-3 font-bold">输入关键词开始搜索</p>
            <p className="mt-1 text-sm text-muted-foreground">也可以点击板块或话题标签来缩小范围</p>
          </div>
        ) : null}

        {loading && result === null ? (
          <div className="space-y-4">
            {[0, 1, 2].map((index) => (
              <Skeleton key={index} className="h-32 w-full rounded-2xl" />
            ))}
          </div>
        ) : null}

        {error ? (
          <div className="rounded-2xl border border-amber-500/40 bg-amber-50 p-6 text-amber-950">
            <p className="font-bold">搜索暂时不可用</p>
            <p className="mt-1 text-sm">{error}</p>
          </div>
        ) : null}

        {result ? (
          <>
            <p className="mb-3 text-sm text-muted-foreground" aria-live="polite">
              找到 <span className="font-black text-foreground">{result.total}</span> 条与「{result.query}」相关的讨论
            </p>
            <PostList
              posts={result.posts}
              query={result.query}
              empty={
                <>
                  <SearchX className="mx-auto size-8 text-[var(--line)]" />
                  <p className="mt-2 font-bold">没有找到相关帖子</p>
                  <p className="mt-1 text-sm text-muted-foreground">换个关键词试试，或清除板块/标签筛选。</p>
                  <div className="mt-4 flex flex-wrap justify-center gap-2">
                    {tag ? <Button variant="outline" className="rounded-full bg-white" onClick={() => updateParams({ tag: '' })}>清除标签</Button> : null}
                    {board ? <Button variant="outline" className="rounded-full bg-white" onClick={() => updateParams({ board: '' })}>清除板块</Button> : null}
                  </div>
                </>
              }
            />
          </>
        ) : null}

        {result === null && !loading && !error && query.trim() ? (
          <p className="py-10 text-center text-sm text-muted-foreground">正在等待结果…</p>
        ) : null}

        {result && result.total === 0 ? (
          <Link href="/boards" className="mt-8 inline-block text-sm font-bold text-[var(--signal-dark)] underline underline-offset-4">
            去全部板块逛逛 →
          </Link>
        ) : null}
      </div>
    </div>
  );
}
