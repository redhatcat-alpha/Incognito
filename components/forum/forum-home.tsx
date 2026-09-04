console.error('FH-MODULE-LOAD');
'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowRight, ChevronRight, Clock3, Flame, History, Lock, Sparkles } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ForumShell } from '@/components/forum/forum-shell';
import dynamic from 'next/dynamic';
import { createPostRequest } from '@/lib/forum-create';

const NewPostDialog = dynamic(() => import('@/components/forum/new-post-dialog'), { ssr: false });
import { PostList } from '@/components/forum/post-list';
import { apiJson } from '@/lib/api';
import { useRegisteredUser } from '@/lib/use-registered-user';
import { relativeTime } from '@/lib/format';
import type { ForumData, HistoryData, PostSummary } from '@/lib/forum-types';

type LoadState = 'loading' | 'ready' | 'offline';

function PostRowSkeleton() {
  return (
    <div className="space-y-5 border-y border-[var(--line)] py-6">
      {[0, 1, 2].map((index) => (
        <div key={index} className="grid gap-4 sm:grid-cols-[44px_minmax(0,1fr)_auto]">
          <Skeleton className="hidden size-11 rounded-full sm:block" />
          <div className="space-y-2.5">
            <Skeleton className="h-3.5 w-40" />
            <Skeleton className="h-6 w-full max-w-xl" />
            <Skeleton className="h-4 w-full max-w-lg" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function ForumHome({ boardSlug }: { boardSlug?: string }) {
  console.error('FH-RENDER-START');
  console.error('FH-BEFORE-HOOKS');
  const [forum, setForum] = useState<ForumData>({ boards: [], posts: [] });
  const [historyData, setHistoryData] = useState<HistoryData>({ enabled: true, entries: [] });
  const { me } = useRegisteredUser();
  const [state, setState] = useState<LoadState>('loading');
  const [tab, setTab] = useState('latest');

  const refresh = useCallback(async () => {
    setState('loading');
    try {
      const url = boardSlug ? `/api/v1/posts?board=${encodeURIComponent(boardSlug)}` : '/api/v1/posts';
      const [forumPayload, historyPayload] = await Promise.allSettled([
        apiJson<ForumData>(url),
        apiJson<HistoryData>('/api/v1/history'),
      ]);
      if (forumPayload.status === 'fulfilled') {
        setForum(forumPayload.value);
        setState('ready');
      } else {
        setState('offline');
      }
      if (historyPayload.status === 'fulfilled') setHistoryData(historyPayload.value);
    } catch {
      setState('offline');
    }
  }, [boardSlug]);

  useEffect(() => {
    const timer = window.setTimeout(() => void refresh(), 0);
    return () => window.clearTimeout(timer);
  }, [refresh]);

  const addPost = useCallback((post: PostSummary) => {
    setForum((current) => ({ ...current, posts: [post, ...current.posts] }));
  }, []);

  // 注册给模型/快捷工具使用的“发帖”能力（与页面入口共享同一提交逻辑）
  useEffect(() => {
    const context = document.modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    void Promise.resolve(
      context.registerTool(
        {
          name: 'create_forum_post',
          title: '发布匿名帖子',
          description: '在无名岛选择一个板块并发布匿名讨论。会立即创建公开帖子。',
          inputSchema: {
            type: 'object',
            properties: {
              boardSlug: { type: 'string', enum: ['tucao', 'tech', 'trending'] },
              title: { type: 'string', minLength: 4, maxLength: 120 },
              body: { type: 'string', minLength: 1, maxLength: 20000 },
              tags: { type: 'array', items: { type: 'string' }, maxItems: 5 },
            },
            required: ['boardSlug', 'title', 'body'],
            additionalProperties: false,
          },
          annotations: { readOnlyHint: false, untrustedContentHint: true },
          async execute(value) {
            if (!value || typeof value !== 'object') throw new Error('帖子参数无效');
            const input = value as { boardSlug: string; title: string; body: string; tags?: string[] };
            const post = await createPostRequest({ ...input, tags: input.tags ?? [] });
            addPost(post);
            return { id: post.id, title: post.title, board: post.board.slug, status: 'published' };
          },
        },
        { signal: lifecycle.signal },
      ),
    ).catch(() => undefined);
    return () => lifecycle.abort();
  }, [addPost]);

  const selectedBoard = boardSlug ? forum.boards.find((board) => board.slug === boardSlug) : undefined;
  const boards = selectedBoard ? [selectedBoard, ...forum.boards.filter((board) => board.slug !== boardSlug)] : forum.boards;
  const boardReadOnly = selectedBoard ? selectedBoard.status !== 'active' : false;
  const postBoards = selectedBoard && boardReadOnly ? forum.boards.filter((board) => board.slug !== selectedBoard.slug) : boards;
  const boardMissing = Boolean(boardSlug && state === 'ready' && !selectedBoard);


  const hotPosts = useMemo(() => [...forum.posts].sort((a, b) => b.score + b.replyCount * 2 - (a.score + a.replyCount * 2)), [forum.posts]);

  const unreadEntries = useMemo(
    () => historyData.entries.filter((entry) => entry.totalFloors > entry.maxReadFloor),
    [historyData],
  );

  const continueEntry = historyData.entries[0];

  const trendingTags = useMemo(() => Array.from(new Set(forum.posts.flatMap((post) => post.tags))).slice(0, 5), [forum.posts]);
  console.error('FH-AFTER-DERIVED');

  return (
    <ForumShell
      right={
        <div className="sticky top-32 space-y-7">
          <section className="overflow-hidden rounded-2xl bg-[var(--ink)] p-5 text-white">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="font-black">继续阅读</h2>
              <History className="size-4 text-[var(--signal)]" />
            </div>
            {continueEntry ? (
              <>
                <p className="line-clamp-2 text-sm font-bold leading-5">{continueEntry.title}</p>
                <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/15">
                  <div
                    className="h-full rounded-full bg-[var(--signal)]"
                    style={{ width: `${Math.min(100, Math.round((continueEntry.maxReadFloor / continueEntry.totalFloors) * 100))}%` }}
                  />
                </div>
                <p className="mt-2 flex justify-between text-xs text-white/55">
                  <span>上次看到 {continueEntry.maxReadFloor} 楼</span>
                  <span>共 {continueEntry.totalFloors} 楼</span>
                </p>
                <Button
                  render={<Link href={`/t/${continueEntry.postId}`} />}
                  className="mt-5 w-full rounded-full bg-[var(--signal)] text-[var(--ink)] hover:bg-[#e4ff87]"
                >
                  继续阅读 <ArrowRight data-icon="inline-end" />
                </Button>
              </>
            ) : (
              <>
                <p className="text-sm font-bold leading-6">
                  {historyData.enabled ? '读过的帖子会出现在这里，随时接着上次的位置继续。' : '云端历史已关闭，读完的内容不再被记录。'}
                </p>
                <Button render={<Link href="/boards" />} className="mt-5 w-full rounded-full bg-white/10 text-white hover:bg-white/20">
                  去逛逛板块
                </Button>
              </>
            )}
          </section>
          <section>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-black">正在升温</h2>
              <Flame className="size-4 text-[#ff795b]" />
            </div>
            <ol className="space-y-4">
              {(trendingTags.length ? trendingTags : []).map((tag, index) => (
                <li key={tag} className="flex items-baseline gap-3 text-sm">
                  <span className="w-5 font-mono text-xs font-bold text-muted-foreground">0{index + 1}</span>
                  <Link href={`/search?tag=${encodeURIComponent(tag)}`} className="font-semibold hover:underline">
                    # {tag}
                  </Link>
                </li>
              ))}
              {!trendingTags.length ? <p className="text-sm text-muted-foreground">帖子多起来后，这里会出现趋势话题</p> : null}
            </ol>
          </section>
          <p className="border-t border-[var(--line)] pt-5 text-xs leading-5 text-muted-foreground">
            无名岛不会要求邮箱或手机号。公开页面不会展示可跨帖追踪的固定账号。
          </p>
        </div>
      }
    >
      <div className="space-y-7 lg:space-y-8">
        {boardMissing ? (
          <div className="rounded-2xl border border-dashed border-[var(--line)] bg-white/60 px-6 py-20 text-center">
            <p className="text-2xl font-black tracking-tight">板块不存在或已关闭</p>
            <p className="mt-2 text-sm text-muted-foreground">它可能被管理员隐藏了，或者链接有误。</p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <Button className="rounded-full bg-[var(--ink)] text-white hover:bg-[var(--ink-soft)]" render={<Link href="/boards" />}>
                查看全部板块
              </Button>
              <Button variant="outline" className="rounded-full bg-white" render={<Link href="/" />}>
                回到首页
              </Button>
            </div>
          </div>
        ) : null}

        {!boardMissing ? (
          <>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0">
            <p className="mb-1 flex items-center gap-2 text-xs font-black uppercase tracking-[0.18em] text-[var(--signal-dark)]">
              {selectedBoard ? `BOARD / ${selectedBoard.slug}` : 'PUBLIC SQUARE / 公开广场'}
              {selectedBoard?.status === 'readonly' || selectedBoard?.status === 'archived' ? (
                <Badge className="h-5 gap-1 rounded-full bg-[var(--ink)] px-2 text-[10px] text-white">
                  <Lock className="size-2.5" />
                  {selectedBoard.status === 'readonly' ? '只读板块' : '已归档'}
                </Badge>
              ) : null}
            </p>
            <h1 className="text-3xl font-black tracking-[-0.045em] sm:text-4xl">
              {selectedBoard ? selectedBoard.name : '今天，大家在聊什么'}
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              {selectedBoard
                ? `${selectedBoard.description}${boardReadOnly ? ' · 该板块仅开放浏览，暂不接受新内容。' : ''}`
                : '匿名说点真心话，或围观别人的故事。'}
            </p>
          </div>
          <NewPostDialog boards={postBoards} onCreated={addPost} me={me} />
        </div>

        {state === 'offline' ? (
          <div className="rounded-2xl border border-amber-500/40 bg-amber-50 p-6 text-amber-950">
            <p className="font-bold">暂时连不上服务器</p>
            <p className="mt-1 text-sm">请检查网络后重试，已输入的内容不会被自动清除。</p>
            <Button variant="outline" className="mt-4 rounded-full bg-white" onClick={() => void refresh()}>
              重新加载
            </Button>
          </div>
        ) : null}

        <Tabs value={tab} onValueChange={setTab} defaultValue="latest">
          <div className="mb-3 flex items-center justify-between gap-4">
            <TabsList variant="line" className="gap-5">
              <TabsTrigger value="latest" className="px-0 font-bold">最新</TabsTrigger>
              <TabsTrigger value="hot" className="px-0 font-bold">热门</TabsTrigger>
              <TabsTrigger value="unread" className="px-0 font-bold">
                未读{unreadEntries.length ? <sup className="ml-1 rounded-full bg-[var(--signal)] px-1.5 py-0.5 text-[10px] font-black text-[var(--ink)]">{unreadEntries.length}</sup> : null}
              </TabsTrigger>
            </TabsList>
            <span className="hidden items-center gap-1.5 text-xs text-muted-foreground sm:flex">
              <Clock3 className="size-3.5" /> {state === 'loading' ? '正在同步' : '刚刚更新'}
            </span>
          </div>
          <TabsContent value="latest">
            {state === 'loading' && !forum.posts.length ? <PostRowSkeleton /> : null}
            {state === 'ready' ? <PostList posts={forum.posts} hideBoard={Boolean(selectedBoard)} /> : null}
          </TabsContent>
          <TabsContent value="hot">
            {state === 'ready' ? <PostList posts={hotPosts} hideBoard={Boolean(selectedBoard)} /> : <PostRowSkeleton />}
          </TabsContent>
          <TabsContent value="unread">
            {!historyData.enabled ? (
              <div className="border-y border-[var(--line)] py-16 text-center">
                <p className="font-bold">云端历史已关闭</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  开启历史同步后，有新增回复的帖子会出现在这里。
                </p>
                <Button variant="outline" className="mt-4 rounded-full bg-white" render={<Link href="/settings/privacy" />}>
                  前往隐私设置
                </Button>
              </div>
            ) : null}
            {historyData.enabled && unreadEntries.length === 0 ? (
              <div className="border-y border-[var(--line)] py-16 text-center">
                <p className="font-bold">没有未读的新讨论</p>
                <p className="mt-1 text-sm text-muted-foreground">帖子有新回复时，会从这里提醒你</p>
              </div>
            ) : null}
            {historyData.enabled && unreadEntries.length > 0 ? (
              <div className="divide-y divide-[var(--line)] border-y border-[var(--line)]">
                {unreadEntries.map((entry) => {
                  const unread = entry.totalFloors - entry.maxReadFloor;
                  return (
                    <article key={entry.postId} className="flex items-center gap-4 py-5">
                      <span className="grid size-11 shrink-0 place-items-center rounded-full bg-[var(--signal)] text-xs font-black text-[var(--ink)]" aria-hidden="true">
                        +{unread}
                      </span>
                      <div className="min-w-0 flex-1">
                        <Link href={`/t/${entry.postId}`} className="font-bold leading-snug hover:text-[var(--signal-dark)]">
                          {entry.title}
                        </Link>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {entry.board.name} · {relativeTime(entry.lastViewedAt)}看到 · {unread} 条新回复
                        </p>
                      </div>
                      <Button variant="outline" size="sm" className="rounded-full bg-white" render={<Link href={`/t/${entry.postId}`} />}>
                        去看 <ChevronRight data-icon="inline-end" />
                      </Button>
                    </article>
                  );
                })}
              </div>
            ) : null}
          </TabsContent>
        </Tabs>

        {state === 'ready' && forum.posts.length >= 50 ? (
          <Button variant="ghost" className="mt-2 w-full rounded-xl py-5 text-muted-foreground">
            已经到底了 <ChevronRight data-icon="inline-end" />
          </Button>
        ) : null}

        {state === 'ready' && forum.posts.length > 0 && forum.posts.length < 50 ? (
          <p className="flex items-center justify-center gap-1.5 pt-1 text-xs text-muted-foreground">
            <Sparkles className="size-3.5" /> 共 {forum.posts.length} 条公开讨论
          </p>
        ) : null}
          </>
        ) : null}
      </div>
    </ForumShell>
  );
}
