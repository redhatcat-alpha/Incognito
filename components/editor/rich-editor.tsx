'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Bold, Code, Eye, Italic, Link2, PenLine, Quote, Smile } from 'lucide-react';

import { Markdown } from '@/components/forum/markdown';
import { cn } from '@/lib/utils';
import { emojiToken, tiebaEmojis } from '@/lib/tieba-emojis';

type RichEditorProps = {
  id: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  maxLength?: number;
  minHeightClass?: string;
};

function textareaOf(id: string): HTMLTextAreaElement | null {
  return document.getElementById(id) as HTMLTextAreaElement | null;
}

/**
 * 受限富文本编辑器：工具栏插入受限 Markdown 标记（加粗/斜体/行内代码/代码块/
 * 引用/链接），支持实时预览；输出与帖子渲染层共用同一套白名单语法。
 */
export function RichEditor({ id, value, onChange, placeholder, maxLength, minHeightClass }: RichEditorProps) {
  const [mode, setMode] = useState<'write' | 'preview'>('write');
  const [emojiOpen, setEmojiOpen] = useState(false);

  function apply(next: string, start: number, end: number) {
    onChange(next);
    window.requestAnimationFrame(() => {
      const el = textareaOf(id);
      if (!el) return;
      el.focus();
      el.setSelectionRange(start, end);
    });
  }

  function wrapInline(open: string, close: string, sample: string) {
    const el = textareaOf(id);
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const selected = value.slice(start, end) || sample;
    apply(value.slice(0, start) + open + selected + close + value.slice(end), start + open.length, start + open.length + selected.length);
  }

  function wrapBlock(prefix: string) {
    const el = textareaOf(id);
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const selected = value.slice(start, end);
    if (!selected) {
      onChange(`${value.slice(0, start)}${prefix}${value.slice(start)}`);
      window.requestAnimationFrame(() => {
        const target = textareaOf(id);
        if (!target) return;
        target.focus();
        target.setSelectionRange(start + prefix.length, start + prefix.length);
      });
      return;
    }
    const prefixed = selected
      .split('\n')
      .map((line) => `${prefix}${line}`)
      .join('\n');
    apply(value.slice(0, start) + prefixed + value.slice(end), start, start + prefixed.length);
  }

  function insertEmoji(emojiId: number) {
    const el = textareaOf(id);
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const token = emojiToken(emojiId);
    apply(value.slice(0, start) + token + value.slice(end), start + token.length, start + token.length);
    setEmojiOpen(false);
  }

  function wrapLink() {
    const url = window.prompt('链接地址（以 http:// 或 https:// 开头）：');
    if (!url || !/^https?:\/\//i.test(url.trim())) return;
    wrapInline('[', `](${url.trim()})`, '链接文字');
  }

  const buttons = [
    { key: 'bold', label: '加粗', title: '加粗（**文本**）', icon: Bold, call: () => wrapInline('**', '**', '加粗文字') },
    { key: 'italic', label: '斜体', title: '斜体（*文本*）', icon: Italic, call: () => wrapInline('*', '*', '斜体文字') },
    { key: 'code', label: '行内代码', title: '行内代码（`代码`）', icon: Code, call: () => wrapInline('`', '`', '代码') },
    { key: 'fence', label: '代码块', title: '代码块（``` 围栏）', icon: PenLine, call: () => wrapInline('```\n', '\n```', '代码块') },
    { key: 'quote', label: '引用', title: '引用块（> 前缀）', icon: Quote, call: () => wrapBlock('> ') },
    { key: 'link', label: '链接', title: '链接（[文字](https://…)）', icon: Link2, call: () => wrapLink() },
  ];

  return (
    <div className="relative overflow-hidden rounded-xl border border-black/15 bg-white focus-within:ring-2 focus-within:ring-[var(--signal)]">
      <div className="flex flex-wrap items-center gap-0.5 border-b border-[var(--line)] bg-[#fbfcf9] px-2 py-1.5">
        {mode === 'write'
          ? buttons.map((item) => (
              <button
                key={item.key}
                type="button"
                title={item.title}
                aria-label={item.label}
                onClick={() => item.call()}
                className="grid size-8 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-[var(--ink)]/[0.06] hover:text-foreground"
              >
                <item.icon className="size-4" />
              </button>
            ))
          : null}
        <button
          type="button"
          aria-label="表情包"
          aria-expanded={emojiOpen}
          onClick={() => { if (mode === 'preview') setMode('write'); setEmojiOpen((v) => !v); }}
          className={cn(
            'grid size-8 place-items-center rounded-lg transition-colors',
            emojiOpen ? 'bg-[var(--ink)] text-white' : 'text-muted-foreground hover:bg-[var(--ink)]/[0.06] hover:text-foreground',
          )}
        >
          <Smile className="size-4" />
        </button>
        <div className="ml-auto flex items-center gap-0.5">
          <button
            type="button"
            aria-pressed={mode === 'write'}
            onClick={() => setMode('write')}
            className={cn(
              'inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-bold transition-colors',
              mode === 'write' ? 'bg-[var(--ink)] text-white' : 'text-muted-foreground hover:bg-[var(--ink)]/[0.06]',
            )}
          >
            <PenLine className="size-3.5" />编辑
          </button>
          <button
            type="button"
            aria-pressed={mode === 'preview'}
            onClick={() => setMode('preview')}
            className={cn(
              'inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-bold transition-colors',
              mode === 'preview' ? 'bg-[var(--ink)] text-white' : 'text-muted-foreground hover:bg-[var(--ink)]/[0.06]',
            )}
          >
            <Eye className="size-3.5" />预览
          </button>
        </div>
      </div>
      {mode === 'write' && emojiOpen ? (
        <div
          aria-label="百度贴吧表情包"
          className="absolute inset-x-0 top-full z-20 max-h-64 overflow-y-auto border-t border-[var(--line)] bg-white p-2 shadow-[0_12px_32px_rgb(17_24_21/0.14)]"
        >
          <div className="grid grid-cols-8 gap-1">
            {tiebaEmojis.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => insertEmoji(item.id)}
                className="grid size-9 place-items-center rounded-lg hover:bg-[var(--ink)]/[0.06]"
              >
                <Image src={item.src} alt={item.alt} width={24} height={24} unoptimized className="size-6 object-contain" />
              </button>
            ))}
          </div>
        </div>
      ) : null}
      {mode === 'write' ? (
        <textarea
          id={id}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          maxLength={maxLength}
          className={cn('block w-full resize-y bg-transparent px-3.5 py-3 text-[0.95rem] leading-6 outline-none placeholder:text-muted-foreground/70', minHeightClass ?? 'min-h-36')}
        />
      ) : (
        <div className={cn('px-4 py-3 text-[0.95rem]', minHeightClass ?? 'min-h-36')}>
          {value.trim() ? (
            <Markdown text={value} />
          ) : (
            <p className="text-sm text-muted-foreground/70">还没有内容，切回「编辑」开始输入。</p>
          )}
        </div>
      )}
    </div>
  );
}
