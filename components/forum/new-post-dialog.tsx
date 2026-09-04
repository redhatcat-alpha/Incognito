'use client';

import { type SyntheticEvent, useState } from 'react';
import { MessageSquarePlus } from 'lucide-react';

import { Button } from '@/components/ui/button';
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
import { apiJson } from '@/lib/api';
import type { BoardSummary, PostSummary, AuthMe } from '@/lib/forum-types';
import { IdentityPicker, type Identity } from '@/components/forum/identity-picker';
import { RichEditor } from '@/components/editor/rich-editor';

export async function createPostRequest(input: {
  boardSlug: string;
  title: string;
  body: string;
  tags: string[];
  identity?: Identity;
}): Promise<PostSummary> {
  const data = await apiJson<PostSummary>('/api/v1/posts', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ ...input, identity: input.identity ?? 'anonymous' }),
  });
  return data;
}

export function NewPostDialog({
  boards,
  onCreated,
  me = null,
}: {
  boards: BoardSummary[];
  onCreated: (post: PostSummary) => void;
  me?: AuthMe | null;
}) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [boardSlug, setBoardSlug] = useState(boards.find((board) => board.status === 'active')?.slug ?? boards[0]?.slug ?? '');
  const [tags, setTags] = useState('');
  const [identity, setIdentity] = useState<Identity>('anonymous');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const writableBoards = boards.filter((board) => board.status === 'active');
  if (!writableBoards.length) return null;

  async function submit(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    const activeBoard = boardSlug || writableBoards[0]?.slug || '';
    setSaving(true);
    setError('');
    try {
      const post = await createPostRequest({
        boardSlug: activeBoard,
        title,
        body,
        tags: tags.split(/[,，]/).map((tag) => tag.trim()).filter(Boolean).slice(0, 5),
        identity,
      });
      onCreated(post);
      setTitle('');
      setBody('');
      setTags('');
      setIdentity('anonymous');
      setOpen(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '发布失败，请稍后重试');
    } finally {
      setSaving(false);
    }
  }

  const openDialog = (next: boolean) => {
    setOpen(next);
    if (next && !boardSlug && writableBoards[0]) setBoardSlug(writableBoards[0].slug);
  };

  return (
    <Dialog open={open} onOpenChange={openDialog}>
      <DialogTrigger
        render={<Button className="h-10 rounded-full bg-[var(--ink)] px-5 text-white hover:bg-[var(--ink-soft)]" />}
      >
        <MessageSquarePlus data-icon="inline-start" />
        发布帖子
      </DialogTrigger>
      <DialogContent className="border border-black/10 bg-[#f8faf6] p-6 sm:max-w-xl">
        <form onSubmit={submit}>
          <DialogHeader>
            <DialogTitle className="text-xl font-black tracking-tight">发布一条新讨论</DialogTitle>
            <DialogDescription>不要填写姓名、联系方式、住址或其他可识别个人的信息。</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-5">
            <label htmlFor="new-post-board" className="grid gap-1.5 text-sm font-semibold">
              板块
              <select
                id="new-post-board"
                value={boardSlug}
                onChange={(event) => setBoardSlug(event.target.value)}
                className="h-10 rounded-lg border border-black/15 bg-white px-3 font-normal outline-none focus:ring-2 focus:ring-[var(--signal)]"
              >
                {writableBoards.map((board) => (
                  <option key={board.slug} value={board.slug}>
                    {board.name}
                  </option>
                ))}
              </select>
            </label>
            <label htmlFor="new-post-title" className="grid gap-1.5 text-sm font-semibold">
              标题
              <Input
                id="new-post-title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                className="h-10 border-black/15 bg-white"
                placeholder="把你想讨论的事说清楚"
                minLength={4}
                maxLength={120}
                required
              />
            </label>
            <label htmlFor="new-post-body" className="grid gap-1.5 text-sm font-semibold">
              正文 <span className="font-normal text-muted-foreground">支持富文本（加粗、代码、引用等）</span>
              <RichEditor
                id="new-post-body"
                value={body}
                onChange={setBody}
                placeholder="请避免泄露自己或他人的身份信息……"
                maxLength={20000}
              />
            </label>
            <label htmlFor="new-post-tags" className="grid gap-1.5 text-sm font-semibold">
              标签{' '}
              <span className="font-normal text-muted-foreground">用逗号分隔，最多 5 个</span>
              <Input
                id="new-post-tags"
                value={tags}
                onChange={(event) => setTags(event.target.value)}
                className="h-10 border-black/15 bg-white"
                placeholder="例如：职场，求助"
              />
            </label>
            <div className="grid gap-1.5 text-sm font-semibold">
              发言身份
              <IdentityPicker me={me} value={identity} onChange={setIdentity} />
            </div>
            {error ? (
              <p role="alert" className="text-sm font-semibold text-destructive">
                {error}
              </p>
            ) : null}
          </div>
          <DialogFooter className="-mx-6 -mb-6 px-6">
            <Button type="submit" disabled={saving || title.trim().length < 4 || !body.trim()} className="rounded-full px-5">
              {saving ? '正在发布…' : '匿名发布'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
