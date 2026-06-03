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
  const re = /\*\*(.+?)\*\*/g;
  let last = 0;
  let match: RegExpExecArray | null;
  let partIndex = 0;

  while ((match = re.exec(line)) !== null) {
    if (match.index > last) {
      parts.push(line.slice(last, match.index));
    }
    parts.push(
      <strong key={`${lineKey}-b-${partIndex++}`}>{match[1]}</strong>
    );
    last = match.index + match[0].length;
  }

  if (last < line.length) {
    parts.push(line.slice(last));
  }

  if (parts.length === 0) return null;
  return <>{parts}</>;
}
