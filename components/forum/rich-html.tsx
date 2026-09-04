'use client';

import { useMemo } from 'react';

import { sanitizeRichHtml, isAllowedEmojiSrc } from '@/lib/rich-content';

/** 渲染已清洗的富文本正文：只放行编辑器白名单标签与本地贴吧表情图。 */
export function RichHtml({ html, className }: { html: string; className?: string }) {
  const final = useMemo(() => {
    const sanitized = sanitizeRichHtml(html);
    const div = document.createElement('div');
    div.innerHTML = sanitized;
    div.querySelectorAll('img').forEach((img) => {
      if (!isAllowedEmojiSrc(img.getAttribute('src'))) img.remove();
    });
    div.querySelectorAll('a').forEach((link) => {
      const href = link.getAttribute('href') ?? '';
      if (!/^https?:\/\//i.test(href)) link.removeAttribute('href');
    });
    return div.innerHTML;
  }, [html]);

  return <div className={className ?? 'rich-body'} dangerouslySetInnerHTML={{ __html: final }} />;
}
