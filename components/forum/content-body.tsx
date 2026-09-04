'use client';

import { Markdown } from '@/components/forum/markdown';
import { RichHtml } from '@/components/forum/rich-html';
import { isRichHtml } from '@/lib/rich-content';

/**
 * 正文渲染入口：新版内容（受限富文本 HTML）走白名单渲染；
 * 历史内容（受限 Markdown）继续由旧渲染器兼容展示。
 */
export function ContentBody({ body, className }: { body: string; className?: string }) {
  if (!body) return null;
  if (isRichHtml(body)) return <RichHtml html={body} className={className} />;
  return <Markdown text={body} />;
}
