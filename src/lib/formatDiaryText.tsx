import React from 'react';

/** Renders diary text with line breaks preserved and **bold** segments. */
export function FormatDiaryText({ text }: { text: string }) {
  if (!text) return null;
  const lines = text.split('\n');
  return (
    <>
      {lines.map((line, lineIndex) => (
        <React.Fragment key={lineIndex}>
          {lineIndex > 0 ? <br /> : null}
          <FormatBoldLine line={line} lineKey={lineIndex} />
        </React.Fragment>
      ))}
    </>
  );
}

function FormatBoldLine({ line, lineKey }: { line: string; lineKey: number }) {
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

/** Wrap the current textarea selection (or insert markers) with ** for bold. */
export function wrapTextareaSelectionWithBold(
  textarea: HTMLTextAreaElement,
  value: string,
  setValue: (next: string) => void
): void {
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const selected = value.slice(start, end);
  const next = `${value.slice(0, start)}**${selected}**${value.slice(end)}`;
  setValue(next);
  const cursorStart = start + 2;
  const cursorEnd = selected.length > 0 ? end + 2 : cursorStart;
  requestAnimationFrame(() => {
    textarea.focus();
    textarea.setSelectionRange(cursorStart, cursorEnd);
  });
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
