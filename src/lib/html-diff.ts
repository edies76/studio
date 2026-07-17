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
