import { Fragment, type ReactNode } from 'react';

/** 受限 Markdown：转义全部 HTML 后仅渲染白名单语法。 */
export function Markdown({ text }: { text: string }) {
  return <div className="md-content min-w-0 break-words">{renderBlocks(text)}</div>;
}

function escapeHtml(input: string): string {
  return input.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

const INLINE_PATTERN =
  /(\*\*(.+?)\*\*)|(`([^`\n]+)`)|(\|\|(.+?)\|\|)|(\bhttps?:\/\/[^\s<"']+)/g;

function inlineToNodes(text: string, keyBase: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const source = escapeHtml(text);
  let cursor = 0;
  let index = 0;
  for (const match of source.matchAll(INLINE_PATTERN)) {
    const start = match.index ?? 0;
    if (start > cursor) nodes.push(<Fragment key={`${keyBase}-t${index}`}>{source.slice(cursor, start)}</Fragment>);
    const [full, , bold, , code, , spoiler, link] = match;
    index += 1;
    const key = `${keyBase}-m${index}`;
    if (bold) {
      nodes.push(<strong key={key} className="font-bold">{bold}</strong>);
    } else if (code) {
      nodes.push(
        <code key={key} className="rounded-md bg-[var(--ink)]/[0.06] px-1.5 py-0.5 font-mono text-[0.88em] text-[var(--ink)]">
          {code}
        </code>,
      );
    } else if (spoiler) {
      nodes.push(<Spoiler key={key}>{spoiler}</Spoiler>);
    } else if (link) {
      nodes.push(
        <a
          key={key}
          href={link}
          target="_blank"
          rel="noreferrer noopener"
          className="break-all font-semibold text-[var(--signal-dark)] underline underline-offset-2 hover:text-[var(--ink)]"
        >
          {link}
        </a>,
      );
    } else if (full) {
      nodes.push(<Fragment key={key}>{full}</Fragment>);
    }
    cursor = start + full.length;
  }
  if (cursor < source.length) nodes.push(<Fragment key={`${keyBase}-end`}>{source.slice(cursor)}</Fragment>);
  return nodes;
}

function Spoiler({ children }: { children: string }) {
  return (
    <button
      type="button"
      onClick={(event) => event.currentTarget.replaceWith(document.createTextNode(children))}
      className="rounded-md bg-[var(--ink)]/[0.85] px-1.5 text-[var(--ink)] hover:bg-[var(--signal)]"
      title="剧透内容，点击查看"
    >
      {children}
    </button>
  );
}

function renderBlocks(text: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const segments = text.replaceAll('\r\n', '\n').split(/(```[\s\S]*?```)/g);
  let blockIndex = 0;
  for (const segment of segments) {
    if (!segment) continue;
    const fence = segment.match(/^```(\w*)\n?([\s\S]*?)```$/);
    if (fence) {
      blockIndex += 1;
      nodes.push(
        <pre
          key={`fence-${blockIndex}`}
          className="my-3 overflow-x-auto rounded-xl border border-black/10 bg-[var(--ink)] p-4 text-[0.83rem] leading-6 text-white"
        >
          <code className="font-mono">{escapeHtml(fence[2].replace(/\n$/, ''))}</code>
        </pre>,
      );
      continue;
    }

    for (const paragraph of segment.split(/\n{2,}/)) {
      if (!paragraph.trim()) continue;
      blockIndex += 1;
      const key = `p-${blockIndex}`;
      const lines = paragraph.split('\n');
      if (lines.every((line) => line.startsWith('>'))) {
        const quote = lines.map((line) => line.replace(/^>\s?/, '')).join('\n');
        nodes.push(
          <blockquote key={key} className="my-3 border-l-[3px] border-[var(--signal-dark)] pl-4 text-muted-foreground">
            {renderParagraph(quote, key)}
          </blockquote>,
        );
        continue;
      }
      const heading = paragraph.match(/^(#{1,3})\s+(.+)$/);
      if (heading && lines.length === 1) {
        const level = Math.min(heading[1].length, 3);
        const Tag = level === 1 ? 'h3' : level === 2 ? 'h4' : 'h5';
        nodes.push(
          <Tag key={key} className={level === 1 ? 'mb-3 mt-5 text-lg font-black tracking-tight' : level === 2 ? 'mb-2 mt-4 font-black' : 'mb-2 mt-3 font-bold'}>
            {inlineToNodes(heading[2], key)}
          </Tag>,
        );
        continue;
      }
      nodes.push(<p key={key} className="my-3 first:mt-0 last:mb-0">{renderParagraph(paragraph, key)}</p>);
    }
  }
  return nodes;
}

function renderParagraph(paragraph: string, keyBase: string): ReactNode {
  const lines = paragraph.split('\n').filter(Boolean);
  if (lines.length === 1) return inlineToNodes(lines[0], keyBase);
  return (
    <>
      {lines.map((line, index) => (
        <Fragment key={`${keyBase}-l${index}`}>
          {index > 0 && <br />}
          {inlineToNodes(line, `${keyBase}-l${index}`)}
        </Fragment>
      ))}
    </>
  );
}
