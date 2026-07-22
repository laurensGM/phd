import React from 'react';

type BulletNode = { content: string; children: BulletNode[] };

const BULLET_RE = /^(\s*)([-*•])\s+(.*)$/;

function leadingIndentUnits(spaces: string): number {
  return Math.floor(spaces.replace(/\t/g, '  ').length / 2);
}

function buildBulletTree(items: { indent: number; content: string }[]): BulletNode[] {
  const root: BulletNode[] = [];
  const stack: { indent: number; node: BulletNode }[] = [];

  for (const item of items) {
    const node: BulletNode = { content: item.content, children: [] };
    while (stack.length > 0 && stack[stack.length - 1].indent >= item.indent) {
      stack.pop();
    }
    if (stack.length === 0) {
      root.push(node);
    } else {
      stack[stack.length - 1].node.children.push(node);
    }
    stack.push({ indent: item.indent, node });
  }
  return root;
}

function BulletList({ nodes, listKey }: { nodes: BulletNode[]; listKey: string }) {
  return (
    <ul className="fmt-bullet-list">
      {nodes.map((node, i) => (
        <li key={`${listKey}-${i}`}>
          <FormatBoldLine line={node.content} lineKey={`${listKey}-${i}`} />
          {node.children.length > 0 ? (
            <BulletList nodes={node.children} listKey={`${listKey}-${i}`} />
          ) : null}
        </li>
      ))}
    </ul>
  );
}

/** Renders text with line breaks, **bold**, and nested `-` / `*` bullet lists. */
export function FormatDiaryText({ text }: { text: string }) {
  if (!text) return null;
  const lines = text.split('\n');
  const nodes: React.ReactNode[] = [];
  let i = 0;
  let block = 0;

  while (i < lines.length) {
    const bulletMatch = lines[i].match(BULLET_RE);
    if (bulletMatch) {
      const items: { indent: number; content: string }[] = [];
      while (i < lines.length) {
        const m = lines[i].match(BULLET_RE);
        if (!m) break;
        items.push({
          indent: leadingIndentUnits(m[1]),
          content: m[3],
        });
        i++;
      }
      const listKey = `list-${block++}`;
      nodes.push(
        <BulletList key={listKey} nodes={buildBulletTree(items)} listKey={listKey} />
      );
      continue;
    }

    const paraLines: string[] = [];
    while (i < lines.length && !BULLET_RE.test(lines[i])) {
      paraLines.push(lines[i]);
      i++;
    }
    nodes.push(
      <span key={`para-${block++}`} className="fmt-text-block">
        {paraLines.map((line, lineIndex) => (
          <React.Fragment key={lineIndex}>
            {lineIndex > 0 ? <br /> : null}
            <FormatBoldLine line={line} lineKey={lineIndex} />
          </React.Fragment>
        ))}
      </span>
    );
  }

  return <>{nodes}</>;
}

function FormatBoldLine({ line, lineKey }: { line: string; lineKey: string | number }) {
  const parts: React.ReactNode[] = [];
  const re = /\*\*(.+?)\*\*|__(.+?)__/g;
  let last = 0;
  let match: RegExpExecArray | null;
  let partIndex = 0;

  while ((match = re.exec(line)) !== null) {
    if (match.index > last) {
      parts.push(line.slice(last, match.index));
    }
    const boldText = match[1] ?? match[2];
    parts.push(<strong key={`${lineKey}-b-${partIndex++}`}>{boldText}</strong>);
    last = match.index + match[0].length;
  }

  if (last < line.length) {
    parts.push(line.slice(last));
  }

  if (parts.length === 0) return line === '' ? '\u00a0' : null;
  return <>{parts}</>;
}

function lineBounds(value: string, cursor: number): { lineStart: number; lineEnd: number; line: string } {
  const lineStart = value.lastIndexOf('\n', cursor - 1) + 1;
  const nextBreak = value.indexOf('\n', cursor);
  const lineEnd = nextBreak === -1 ? value.length : nextBreak;
  return { lineStart, lineEnd, line: value.slice(lineStart, lineEnd) };
}

function setTextareaValue(
  textarea: HTMLTextAreaElement,
  next: string,
  setValue: (next: string) => void,
  selectionStart: number,
  selectionEnd: number = selectionStart
): void {
  setValue(next);
  requestAnimationFrame(() => {
    textarea.focus();
    textarea.setSelectionRange(selectionStart, selectionEnd);
  });
}

/** Wrap the current textarea selection (or insert markers) with ** for bold. */
export function wrapTextareaSelectionWithBold(
  textarea: HTMLTextAreaElement,
  value: string,
  setValue: (next: string) => void
): void {
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const selected = value.slice(start, end);

  // Toggle off if selection is already wrapped in **…**
  if (selected.startsWith('**') && selected.endsWith('**') && selected.length >= 4) {
    const inner = selected.slice(2, -2);
    const next = `${value.slice(0, start)}${inner}${value.slice(end)}`;
    setTextareaValue(textarea, next, setValue, start, start + inner.length);
    return;
  }

  // Toggle off if markers sit just outside the selection
  if (
    start >= 2 &&
    end + 2 <= value.length &&
    value.slice(start - 2, start) === '**' &&
    value.slice(end, end + 2) === '**'
  ) {
    const next = `${value.slice(0, start - 2)}${selected}${value.slice(end + 2)}`;
    setTextareaValue(textarea, next, setValue, start - 2, end - 2);
    return;
  }

  const next = `${value.slice(0, start)}**${selected}**${value.slice(end)}`;
  const cursorStart = start + 2;
  const cursorEnd = selected.length > 0 ? end + 2 : cursorStart;
  setTextareaValue(textarea, next, setValue, cursorStart, cursorEnd);
}

/** Cmd/Ctrl+B handler for textareas that use **bold** markdown. */
export function handleBoldShortcut(
  e: React.KeyboardEvent<HTMLTextAreaElement>,
  value: string,
  setValue: (next: string) => void
): void {
  if (!(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== 'b') return;
  e.preventDefault();
  wrapTextareaSelectionWithBold(e.currentTarget, value, setValue);
}

/**
 * Rich-notes shortcuts for textareas:
 * - Cmd/Ctrl+B → bold
 * - Enter on a bullet line → continue list (empty bullet exits)
 * - Tab / Shift+Tab on a bullet line → indent / outdent
 */
export function handleRichTextareaKeyDown(
  e: React.KeyboardEvent<HTMLTextAreaElement>,
  value: string,
  setValue: (next: string) => void
): void {
  handleBoldShortcut(e, value, setValue);
  if (e.defaultPrevented) return;

  const ta = e.currentTarget;
  const start = ta.selectionStart;
  const end = ta.selectionEnd;

  if (e.key === 'Enter' && !e.shiftKey && start === end) {
    const { lineStart, lineEnd, line } = lineBounds(value, start);
    const m = line.match(BULLET_RE);
    if (!m) return;

    e.preventDefault();
    const indent = m[1];
    const marker = m[2];
    const content = m[3];

    // Empty bullet → exit list (strip the marker on this line)
    if (content === '') {
      const prefixLen = indent.length + marker.length + 1;
      const next = `${value.slice(0, lineStart)}${value.slice(lineStart + prefixLen)}`;
      setTextareaValue(ta, next, setValue, lineStart);
      return;
    }

    const insert = `\n${indent}${marker} `;
    const next = `${value.slice(0, start)}${insert}${value.slice(end)}`;
    setTextareaValue(ta, next, setValue, start + insert.length);
    return;
  }

  if (e.key === 'Tab' && start === end) {
    const { lineStart, line } = lineBounds(value, start);
    const m = line.match(BULLET_RE);
    if (!m) return;

    e.preventDefault();
    const indent = m[1];

    if (e.shiftKey) {
      if (!indent) return;
      const remove = indent.startsWith('\t') ? 1 : Math.min(2, indent.length);
      const next = `${value.slice(0, lineStart)}${indent.slice(remove)}${value.slice(lineStart + indent.length)}`;
      setTextareaValue(ta, next, setValue, Math.max(lineStart, start - remove));
      return;
    }

    const next = `${value.slice(0, lineStart)}  ${value.slice(lineStart)}`;
    setTextareaValue(ta, next, setValue, start + 2);
  }
}
