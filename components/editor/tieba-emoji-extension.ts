import { mergeAttributes, Node } from '@tiptap/core';

/**
 * 内联贴吧表情节点：作为 inline atom 插入，可在段落文字中间使用而不换行。
 * 输出 <img data-tieba-emoji …>；解析同时兼容旧内容中的本地表情 <img>。
 */
export const TiebaEmoji = Node.create({
  name: 'tiebaEmoji',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,

  addAttributes() {
    return {
      src: { default: null },
      alt: { default: '贴吧表情' },
      title: { default: null },
      width: { default: 22 },
      height: { default: 22 },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'img[data-tieba-emoji]',
        getAttrs: (element) => {
          const el = element as HTMLElement;
          return {
            src: el.getAttribute('src'),
            alt: el.getAttribute('alt') ?? '贴吧表情',
            title: el.getAttribute('title'),
            width: Number(el.getAttribute('width')) || 22,
            height: Number(el.getAttribute('height')) || 22,
          };
        },
      },
      {
        tag: 'img',
        getAttrs: (element) => {
          const el = element as HTMLElement;
          const src = el.getAttribute('src') ?? '';
          if (!src.startsWith('/emoji/tieba/')) return false;
          return {
            src,
            alt: el.getAttribute('alt') ?? '贴吧表情',
            title: el.getAttribute('title'),
            width: Number(el.getAttribute('width')) || 22,
            height: Number(el.getAttribute('height')) || 22,
          };
        },
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'img',
      mergeAttributes(HTMLAttributes, {
        'data-tieba-emoji': '',
        loading: 'lazy',
        draggable: 'false',
      }),
    ];
  },
});
