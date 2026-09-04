import DOMPurify from 'dompurify';

/** 旧版受限 Markdown 是否为新版富文本 HTML 的启发式判断。 */
export function isRichHtml(value: string): boolean {
  return /^\s*</.test(value);
}

/** 服务端友好的标签剥离（用于摘要/计数，不依赖 DOM）。 */
export function stripHtmlText(value: string): string {
  return value
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

/** 纯文本可见字符数（中英文均按字符计）。 */
export function htmlTextLength(value: string): number {
  if (!isRichHtml(value)) return value.length;
  return stripHtmlText(value).length;
}

export function htmlHasText(value: string): boolean {
  if (!isRichHtml(value)) return value.trim().length > 0;
  return stripHtmlText(value).length > 0;
}

DOMPurify.addHook('afterSanitizeAttributes', (node) => {
  if (node.tagName === 'A') {
    node.setAttribute('rel', 'noreferrer noopener');
    node.setAttribute('target', '_blank');
  }
  if (node.tagName === 'IMG') {
    node.setAttribute('loading', 'lazy');
  }
});

/** 富文本 HTML 白名单清洗：只允许编辑器产物与本地贴吧表情图。 */
export function sanitizeRichHtml(raw: string): string {
  return DOMPurify.sanitize(raw, {
    ALLOWED_TAGS: [
      'p', 'br', 'strong', 'b', 'em', 'i', 's', 'strike',
      'h2', 'h3', 'code', 'pre', 'blockquote', 'ul', 'ol', 'li', 'a', 'img',
    ],
    ALLOWED_ATTR: ['href', 'target', 'rel', 'src', 'alt', 'title', 'width', 'height', 'data-tieba-emoji'],
    ALLOWED_URI_REGEXP: /^(?:https?:\/\/|mailto:|tel:|#)/i,
    RETURN_TRUSTED_TYPE: false,
  })
    .replace(/<a /g, '<a ')
    .replace(/<img /g, '<img ');
}

/** 仅本地贴吧表情图路径允许渲染。 */
export function isAllowedEmojiSrc(src: string | null): boolean {
  return typeof src === 'string' && src.startsWith('/emoji/tieba/');
}

/**
 * 把旧版受限 Markdown 转换为编辑器可编辑的 HTML（初始化回填用，尽力而为）。
 * 支持的标记与历史上限一致：**粗体**、*斜体*、`行内代码`、``` 代码块、
 * > 引用、# 标题、[文字](链接)、贴吧表情图片标记。
 */
export function mdToHtmlLight(markdown: string): string {
  if (isRichHtml(markdown)) return markdown;

  const escapeText = (input: string): string =>
    input
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;');

  const lines = markdown.replaceAll('\r\n', '\n').split('\n');
  const out: string[] = [];
  let inCode = false;
  let codeBuf: string[] = [];
  let listBuf: string[] = [];
  let inList = false;

  const flushList = () => {
    if (!inList) return;
    out.push(`<ul>${listBuf.join('')}</ul>`);
    listBuf = [];
    inList = false;
  };
  const flushCode = () => {
    if (!inCode) return;
    out.push(`<pre><code>${escapeText(codeBuf.join('\n'))}</code></pre>`);
    codeBuf = [];
    inCode = false;
  };

  for (const raw of lines) {
    const fence = raw.match(/^```(\w*)$/);
    if (fence) {
      flushList();
      if (inCode) flushCode();
      else inCode = true;
      continue;
    }
    if (inCode) {
      codeBuf.push(raw);
      continue;
    }
    flushCode();

    const inline = (text: string): string => {
      let html = escapeText(text);
      // 表情图片标记
      html = html.replace(
        /!\[([^\]]*)\]\(\s*(\/emoji\/tieba\/image_emoticon\d+\.png)\s*\)/g,
        (_, alt, src) => `<img src="${src}" alt="${alt}" width="22" height="22" />`,
      );
      html = html.replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, (_, label, url) => `<a href="${url}">${label}</a>`);
      html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
      html = html.replace(/(^|[^*])\*([^*]+)\*(?!\*)/g, '$1<em>$2</em>');
      html = html.replace(/`([^`\n]+)`/g, '<code>$1</code>');
      return html;
    };

    const heading = raw.match(/^(#{1,3})\s+(.+)$/);
    if (heading) {
      flushList();
      const level = heading[1].length === 1 ? 2 : heading[1].length === 2 ? 2 : 3;
      out.push(`<h${level}>${inline(heading[2])}</h${level}>`);
      continue;
    }
    if (/^\s*>\s?/.test(raw)) {
      flushList();
      out.push(`<blockquote><p>${inline(raw.replace(/^\s*>\s?/, ''))}</p></blockquote>`);
      continue;
    }
    if (/^\s*[-*]\s+/.test(raw)) {
      inList = true;
      listBuf.push(`<li>${inline(raw.replace(/^\s*[-*]\s+/, ''))}</li>`);
      continue;
    }
    flushList();
    if (raw.trim() === '') {
      out.push('<p></p>');
      continue;
    }
    out.push(`<p>${inline(raw)}</p>`);
  }
  flushList();
  flushCode();
  return out.join('');
}
