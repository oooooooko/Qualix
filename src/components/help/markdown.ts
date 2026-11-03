export type DocumentBlock =
  | { type: 'heading'; level: number; text: string }
  | { type: 'paragraph'; text: string }
  | { type: 'list'; ordered: boolean; items: string[] }
  | { type: 'code'; text: string; language: string }
  | { type: 'table'; headers: string[]; rows: string[][] };

const cleanText = (value: string) => value
  .replace(/\[([^\]]+)]\([^)]+\)/g, '$1')
  .replace(/\*\*([^*]+)\*\*/g, '$1')
  .replace(/`([^`]+)`/g, '$1')
  .trim();

const splitTableRow = (line: string) => line
  .replace(/^\||\|$/g, '')
  .split('|')
  .map(cell => cleanText(cell));

export function parseMarkdownDocument(content: string): DocumentBlock[] {
  const lines = content.replace(/\r\n/g, '\n').split('\n');
  const result: DocumentBlock[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index] ?? '';
    const trimmed = line.trim();
    if (!trimmed || /^\[简体中文\]\(/.test(trimmed)) {
      index += 1;
      continue;
    }

    if (/^([-*_])\1{2,}$/.test(trimmed)) {
      index += 1;
      continue;
    }

    if (trimmed.startsWith('```')) {
      const code: string[] = [];
      index += 1;
      while (index < lines.length && !lines[index]!.trim().startsWith('```')) {
        code.push(lines[index]!);
        index += 1;
      }
      result.push({ type: 'code', text: code.join('\n'), language: trimmed.slice(3) });
      index += 1;
      continue;
    }

    const heading = /^(#{1,6})\s+(.+)$/.exec(trimmed);
    if (heading) {
      result.push({ type: 'heading', level: heading[1]!.length, text: cleanText(heading[2]!) });
      index += 1;
      continue;
    }

    if (trimmed.includes('|') && /^\s*\|?\s*:?-{3,}/.test(lines[index + 1] ?? '')) {
      const headers = splitTableRow(trimmed);
      const rows: string[][] = [];
      index += 2;
      while (index < lines.length && lines[index]!.includes('|') && lines[index]!.trim()) {
        rows.push(splitTableRow(lines[index]!));
        index += 1;
      }
      result.push({ type: 'table', headers, rows });
      continue;
    }

    const listMatch = /^(?:[-*]\s+|(\d+)\.\s+)(.+)$/.exec(trimmed);
    if (listMatch) {
      const ordered = Boolean(listMatch[1]);
      const items: string[] = [];
      while (index < lines.length) {
        const item = /^(?:[-*]\s+|(\d+)\.\s+)(.+)$/.exec(lines[index]!.trim());
        if (!item || Boolean(item[1]) !== ordered) break;
        items.push(cleanText(item[2]!));
        index += 1;
      }
      result.push({ type: 'list', ordered, items });
      continue;
    }

    const paragraph: string[] = [];
    while (index < lines.length) {
      const next = lines[index]!.trim();
      if (!next || /^(#{1,6})\s+/.test(next) || next.startsWith('```') || /^(?:[-*]\s+|\d+\.\s+)/.test(next)) break;
      if (next.includes('|') && /^\s*\|?\s*:?-{3,}/.test(lines[index + 1] ?? '')) break;
      paragraph.push(cleanText(next));
      index += 1;
    }
    result.push({ type: 'paragraph', text: paragraph.join(' ') });
  }

  return result;
}
