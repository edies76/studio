/** Lightweight HTML → plain text + line diff for change previews */

export function htmlToPlain(html: string): string {
  if (!html) return '';
  let t = html
    .replace(/<\/(p|div|h[1-6]|li|tr|br|blockquote)>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"');
  t = t
    .split('\n')
    .map((l) => l.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join('\n');
  return t;
}

export type DiffLine = { type: 'same' | 'add' | 'del'; text: string };

export type WordDiffSegment =
  | { type: 'same'; text: string }
  | { type: 'change'; before: string; after: string };

const WORD_TOKEN_RE = /\s+|[\p{L}\p{N}_]+|[^\s\p{L}\p{N}_]/gu;

function wordTokens(value: string): string[] {
  return value.match(WORD_TOKEN_RE) || (value ? [value] : []);
}

/** Word-level diff that keeps unchanged context in the same paragraph. */
export function diffWordSegments(before: string, after: string): WordDiffSegment[] {
  const a = wordTokens(before);
  const b = wordTokens(after);
  const n = a.length;
  const m = b.length;
  if (!n && !m) return [];

  const dp: number[][] = Array.from({ length: n + 1 }, () => Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = a[i] === b[j] ? 1 + dp[i + 1][j + 1] : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }

  const raw: Array<{ type: 'same' | 'del' | 'add'; text: string }> = [];
  let i = 0;
  let j = 0;
  while (i < n || j < m) {
    if (i < n && j < m && a[i] === b[j]) {
      raw.push({ type: 'same', text: a[i] });
      i++;
      j++;
    } else if (j < m && (i >= n || dp[i][j + 1] >= dp[i + 1][j])) {
      raw.push({ type: 'add', text: b[j++] });
    } else if (i < n) {
      raw.push({ type: 'del', text: a[i++] });
    }
  }

  const out: WordDiffSegment[] = [];
  let same = '';
  const flushSame = () => {
    if (same) out.push({ type: 'same', text: same });
    same = '';
  };
  for (let k = 0; k < raw.length; k++) {
    const current = raw[k];
    if (current.type === 'same') {
      same += current.text;
      continue;
    }
    flushSame();
    let beforePart = current.type === 'del' ? current.text : '';
    let afterPart = current.type === 'add' ? current.text : '';
    while (k + 1 < raw.length && raw[k + 1].type !== 'same') {
      const next = raw[++k];
      if (next.type === 'del') beforePart += next.text;
      if (next.type === 'add') afterPart += next.text;
    }
    out.push({ type: 'change', before: beforePart, after: afterPart });
  }
  flushSame();
  return out;
}

/** Return only actual changes, useful for per-hunk accept/reject controls. */
export function diffWordHunks(before: string, after: string) {
  return diffWordSegments(before, after).filter(
    (segment): segment is Extract<WordDiffSegment, { type: 'change' }> => segment.type === 'change',
  );
}

/**
 * Resolve one inline hunk without duplicating the rest of the paragraph.
 * `accept-one` keeps every other change pending; `reject-one` keeps every
 * other proposed change while restoring only the selected hunk.
 */
export function mergeSingleInlineHunk(
  beforeHtml: string,
  afterHtml: string,
  hunkIndex: number,
  mode: 'accept-one' | 'reject-one',
): string | null {
  const before = simpleBlockInfo(beforeHtml);
  const after = simpleBlockInfo(afterHtml);
  if (!before || !after || before.tag !== after.tag) return null;
  const segments = diffWordSegments(before.text, after.text);
  let currentHunk = 0;
  const body = segments
    .map((segment) => {
      if (segment.type === 'same') return escapeHtmlText(segment.text);
      const selected = currentHunk++ === hunkIndex;
      const useAfter = mode === 'accept-one' ? selected : !selected;
      return escapeHtmlText(useAfter ? segment.after : segment.before);
    })
    .join('');
  return `<${after.tag}${after.attrs}>${body}</${after.tag}>`;
}

function simpleBlockInfo(html: string): { tag: string; attrs: string; text: string } | null {
  const match = html.trim().match(/^<(p|h[1-6]|blockquote)([^>]*)>[\s\S]*<\/\1>$/i);
  if (!match) return null;
  return { tag: match[1].toLowerCase(), attrs: match[2] || '', text: htmlToPlain(html) };
}

function escapeHtmlText(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Simple line LCS-ish diff (good enough for paragraph review) */
export function diffPlain(before: string, after: string): DiffLine[] {
  const a = before ? before.split('\n') : [];
  const b = after ? after.split('\n') : [];
  if (!a.length && !b.length) return [];
  if (!a.length) return b.map((text) => ({ type: 'add' as const, text }));
  if (!b.length) return a.map((text) => ({ type: 'del' as const, text }));

  // Myers-lite: greedy matching
  const out: DiffLine[] = [];
  let i = 0;
  let j = 0;
  while (i < a.length || j < b.length) {
    if (i < a.length && j < b.length && a[i] === b[j]) {
      out.push({ type: 'same', text: a[i] });
      i++;
      j++;
      continue;
    }
    // look ahead for match
    let found = false;
    for (let k = 1; k <= 4 && !found; k++) {
      if (j + k < b.length && i < a.length && a[i] === b[j + k]) {
        for (let t = 0; t < k; t++) out.push({ type: 'add', text: b[j + t] });
        j += k;
        found = true;
      } else if (i + k < a.length && j < b.length && a[i + k] === b[j]) {
        for (let t = 0; t < k; t++) out.push({ type: 'del', text: a[i + t] });
        i += k;
        found = true;
      }
    }
    if (found) continue;
    if (i < a.length) out.push({ type: 'del', text: a[i++] });
    if (j < b.length) out.push({ type: 'add', text: b[j++] });
  }
  return out;
}
