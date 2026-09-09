'use client';

import Link from '@/lib/static-link';
import { Fragment } from 'react';
import { Lock, MessageCircle, ThumbsUp } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { relativeTime } from '@/lib/format';
import type { PostSummary } from '@/lib/forum-types';

export function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function Highlight({ text, query }: { text: string; query: string }) {
  const keyword = query.trim();
  if (!keyword) return <>{text}</>;
  const parts = text.split(new RegExp(`(${escapeRegExp(keyword)})`, 'gi'));
  return (
    <>
      {parts.map((part, index) =>
        part.toLowerCase() === keyword.toLowerCase() ? (
          <mark key={index} className="rounded-sm bg-[var(--signal)] px-0.5 text-[var(--ink)]">
            {part}
          </mark>
        ) : (
          <Fragment key={index}>{part}</Fragment>
        ),
      )}
    </>
  );
}

export function PostList({
  posts,
  query,
  hideBoard = false,
  empty,
}: {
  posts: PostSummary[];
  query?: string;
  hideBoard?: boolean;
  empty?: React.ReactNode;
}) {
  if (!posts.length) {
    return (
      <div className="border-y border-[var(--line)] py-16 text-center">
        {empty ?? (
          <>
            <p className="font-bold">这里还没有帖子</p>
            <p className="mt-1 text-sm text-muted-foreground">成为第一个发起讨论的人</p>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="divide-y divide-[var(--line)] border-y border-[var(--line)]">
      {posts.map((post) => (
        <PostCard key={post.id} post={post} query={query} hideBoard={hideBoard} />
      ))}
    </div>
  );
}

export function PostCard({
  post,
  query,
  hideBoard = false,
}: {
  post: PostSummary;
  query?: string;
  hideBoard?: boolean;
}) {
  return (
    <article className="group grid gap-4 py-6 sm:grid-cols-[44px_minmax(0,1fr)_auto] sm:gap-5">
      <div
        className="hidden size-11 items-center justify-center rounded-full border border-black/10 text-sm font-black sm:flex"
        style={{ backgroundColor: post.board.accent }}
        aria-hidden="true"
      >
        匿
      </div>
      <div className="min-w-0">
        <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          {!hideBoard ? (
            <>
              <Link href={`/b/${post.board.slug}`} className="font-semibold text-foreground hover:underline">
                {post.board.name}
              </Link>
              <span>·</span>
            </>
          ) : null}
          <span>{relativeTime(post.lastRepliedAt)}</span>
          <span>·</span>
          <span>{post.isMine ? '我发布的' : '楼主'}</span>
          {post.status === 'locked' ? (
            <Badge variant="outline" className="h-5 gap-1 border-black/10 bg-white px-1.5 text-[10px] font-semibold">
              <Lock className="size-2.5" />已锁定
            </Badge>
          ) : null}
        </div>
        <Link
          href={`/t/${post.id}`}
          className="text-[1.08rem] font-bold leading-snug tracking-[-0.015em] transition-colors group-hover:text-[var(--signal-dark)] sm:text-xl"
        >
          {query ? <Highlight text={post.title} query={query} /> : post.title}
        </Link>
        <p className="mt-2 line-clamp-2 max-w-2xl text-[0.93rem] leading-6 text-muted-foreground">
          {query ? <Highlight text={post.excerpt} query={query} /> : post.excerpt}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {post.tags.map((tag) => (
            <Badge key={tag} variant="outline" className="h-6 border-black/10 bg-white px-2.5 font-normal">
              # {tag}
            </Badge>
          ))}
        </div>
      </div>
      <div className="flex items-center gap-4 text-sm text-muted-foreground sm:flex-col sm:items-end sm:justify-center sm:gap-2">
        <span className="inline-flex items-center gap-1.5 font-semibold text-foreground">
          <ThumbsUp className="size-3.5" /> {post.score}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <MessageCircle className="size-3.5" /> {post.replyCount}
        </span>
      </div>
    </article>
  );
}
