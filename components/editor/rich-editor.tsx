'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import LinkExtension from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import {
  Bold,
  Code,
  CodeXml,
  Heading2,
  Heading3,
  Italic,
  Link2,
  List,
  ListOrdered,
  Quote,
  Redo2,
  Smile,
  Strikethrough,
  Undo2,
} from 'lucide-react';

import { TiebaEmoji } from '@/components/editor/tieba-emoji-extension';
import { isRichHtml, mdToHtmlLight } from '@/lib/rich-content';
import { tiebaEmojis } from '@/lib/tieba-emojis';
import { cn } from '@/lib/utils';

type RichEditorProps = {
  initialContent?: string;
  onChange: (html: string) => void;
  placeholder?: string;
  minHeightClass?: string;
};

const toolButton =
  'grid size-8 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-[var(--ink)]/[0.06] hover:text-foreground';

/** 常规所见即所得富文本编辑器（TipTap）。输出受限 HTML。 */
export function RichEditor({ initialContent = '', onChange, placeholder, minHeightClass }: RichEditorProps) {
  const [emojiOpen, setEmojiOpen] = useState(false);
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [2, 3] } }),
      TiebaEmoji,
      LinkExtension.configure({ openOnClick: false, autolink: true, HTMLAttributes: { rel: 'noreferrer noopener', target: '_blank' } }),
      Placeholder.configure({ placeholder: placeholder ?? '开始输入…' }),
    ],
    content: isRichHtml(initialContent) ? initialContent : mdToHtmlLight(initialContent),
    editorProps: {
      attributes: { class: 'rich-body rich-editor-area outline-none' },
    },
    onUpdate: ({ editor: instance }) => {
      onChangeRef.current(instance.getHTML());
    },
  });

  if (!editor) return null;

  const run = (fn: () => void) => {
    fn();
    setEmojiOpen(false);
  };

  const insertEmoji = (emojiId: number) => {
    const src = `/emoji/tieba/image_emoticon${emojiId}.png`;
    editor
      .chain()
      .focus()
      .insertContent({
        type: 'tiebaEmoji',
        attrs: { src, alt: `贴吧表情 ${emojiId}`, title: `贴吧表情 ${emojiId}`, width: 22, height: 22 },
      })
      .run();
    setEmojiOpen(false);
  };

  const setLink = () => {
    const previous = editor.getAttributes('link').href as string | undefined;
    const url = window.prompt('链接地址（以 http:// 或 https:// 开头）：', previous ?? '');
    if (url === null) return;
    if (!url.trim()) {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }
    if (!/^https?:\/\//i.test(url.trim())) return;
    editor.chain().focus().extendMarkRange('link').setLink({ href: url.trim() }).run();
  };

  const marks = [
    { key: 'bold', label: '加粗', icon: Bold, active: editor.isActive('bold'), action: () => run(() => editor.chain().focus().toggleBold().run()) },
    { key: 'italic', label: '斜体', icon: Italic, active: editor.isActive('italic'), action: () => run(() => editor.chain().focus().toggleItalic().run()) },
    { key: 'strike', label: '删除线', icon: Strikethrough, active: editor.isActive('strike'), action: () => run(() => editor.chain().focus().toggleStrike().run()) },
    { key: 'code', label: '行内代码', icon: Code, active: editor.isActive('code'), action: () => run(() => editor.chain().focus().toggleCode().run()) },
    { key: 'codeblock', label: '代码块', icon: CodeXml, active: editor.isActive('codeBlock'), action: () => run(() => editor.chain().focus().toggleCodeBlock().run()) },
  ];

  const blocks = [
    { key: 'h2', label: '标题 2', icon: Heading2, active: editor.isActive('heading', { level: 2 }), action: () => run(() => editor.chain().focus().toggleHeading({ level: 2 }).run()) },
    { key: 'h3', label: '标题 3', icon: Heading3, active: editor.isActive('heading', { level: 3 }), action: () => run(() => editor.chain().focus().toggleHeading({ level: 3 }).run()) },
    { key: 'quote', label: '引用', icon: Quote, active: editor.isActive('blockquote'), action: () => run(() => editor.chain().focus().toggleBlockquote().run()) },
    { key: 'ul', label: '无序列表', icon: List, active: editor.isActive('bulletList'), action: () => run(() => editor.chain().focus().toggleBulletList().run()) },
    { key: 'ol', label: '有序列表', icon: ListOrdered, active: editor.isActive('orderedList'), action: () => run(() => editor.chain().focus().toggleOrderedList().run()) },
  ];

  return (
    <div className="overflow-hidden rounded-xl border border-black/15 bg-white focus-within:ring-2 focus-within:ring-[var(--signal)]">
      <div className="flex flex-wrap items-center gap-0.5 border-b border-[var(--line)] bg-[#fbfcf9] px-2 py-1.5">
        {marks.map((item) => (
          <button
            key={item.key}
            type="button"
            aria-label={item.label}
            aria-pressed={item.active}
            title={item.label}
            onMouseDown={(event) => event.preventDefault()}
            onClick={item.action}
            className={cn(toolButton, item.active && 'bg-[var(--ink)] text-white')}
          >
            <item.icon className="size-4" />
          </button>
        ))}
        <span className="mx-1 h-5 w-px bg-[var(--line)]" aria-hidden="true" />
        {blocks.map((item) => (
          <button
            key={item.key}
            type="button"
            aria-label={item.label}
            aria-pressed={item.active}
            title={item.label}
            onMouseDown={(event) => event.preventDefault()}
            onClick={item.action}
            className={cn(toolButton, item.active && 'bg-[var(--ink)] text-white')}
          >
            <item.icon className="size-4" />
          </button>
        ))}
        <button
          type="button"
          aria-label="链接"
          title="链接"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => run(setLink)}
          className={cn(toolButton, editor.isActive('link') && 'bg-[var(--ink)] text-white')}
        >
          <Link2 className="size-4" />
        </button>
        <button
          type="button"
          aria-label="表情包"
          aria-expanded={emojiOpen}
          title="贴吧表情包"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => setEmojiOpen((value) => !value)}
          className={cn(toolButton, emojiOpen && 'bg-[var(--ink)] text-white')}
        >
          <Smile className="size-4" />
        </button>
        <div className="ml-auto flex items-center gap-0.5">
          <button
            type="button"
            aria-label="撤销"
            title="撤销"
            onMouseDown={(event) => event.preventDefault()}
            disabled={!editor.can().undo()}
            onClick={() => run(() => editor.chain().focus().undo().run())}
            className={cn(toolButton, 'disabled:opacity-35')}
          >
            <Undo2 className="size-4" />
          </button>
          <button
            type="button"
            aria-label="重做"
            title="重做"
            onMouseDown={(event) => event.preventDefault()}
            disabled={!editor.can().redo()}
            onClick={() => run(() => editor.chain().focus().redo().run())}
            className={cn(toolButton, 'disabled:opacity-35')}
          >
            <Redo2 className="size-4" />
          </button>
        </div>
      </div>

      {emojiOpen ? (
        <div className="grid max-h-56 grid-cols-8 gap-1 overflow-y-auto border-b border-[var(--line)] bg-[#fbfcf9] p-2">
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
      ) : null}

      <EditorContent editor={editor} className={cn('rich-editor-shell', minHeightClass ?? 'min-h-40')} />
    </div>
  );
}
