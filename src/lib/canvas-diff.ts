import { diffWordSegments, htmlToPlain, type DiffLine } from '@/lib/html-diff';

/**
 * Structural HTML diff for the paper ghost.
 * Diffs top-level blocks so LaTeX, headings and tables keep their tags.
 * Changed text stays in its original paragraph. Only the changed words are
 * marked; whole paragraphs are not duplicated just because one word changed.
 */

const BLOCK_TAGS = new Set([
  'p',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'ul',
  'ol',
  'li',
  'blockquote',
  'pre',
  'table',
  'hr',
  'figure',
  'section',
  'div',
]);

export type DiffBlock = {
  type: 'same' | 'add' | 'del' | 'paired';
  html: string;
  beforeHtml?: string;
  afterHtml?: string;
};

/** Split document HTML into top-level block outerHTMLs */
export function htmlToBlockList(html: string): string[] {
  if (typeof document === 'undefined') {
    const cleaned = (html || '').trim();
    return cleaned ? [cleaned] : [];
  }
  const host = document.createElement('div');
  host.innerHTML = (html || '')
    .replace(/<\/?(html|head|body)[^>]*>/gi, '')
    .trim();

  const blocks: string[] = [];
  Array.from(host.childNodes).forEach((node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const t = (node.textContent || '').trim();
      if (t) blocks.push(`<p>${escapeText(t)}</p>`);
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const el = node as HTMLElement;
    const tag = el.tagName.toLowerCase();
    if (tag === 'div' && !el.className && el.children.length > 0) {
      Array.from(el.children).forEach((c) => blocks.push((c as HTMLElement).outerHTML));
      return;
    }
    if (BLOCK_TAGS.has(tag) || el.outerHTML.trim()) {
      blocks.push(el.outerHTML);
    }
  });
  return blocks;
}

function blockKey(html: string): string {
  return htmlToPlain(html)
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
    .slice(0, 400);
}

/** LCS block alignment */
export function diffHtmlBlocks(beforeHtml: string, afterHtml: string): DiffBlock[] {
  const a = htmlToBlockList(beforeHtml || '');
  const b = htmlToBlockList(afterHtml || '');
  if (!a.length && !b.length) return [];
  if (!a.length) return b.map((html) => ({ type: 'add' as const, html }));
  if (!b.length) return a.map((html) => ({ type: 'del' as const, html }));

  const ka = a.map(blockKey);
  const kb = b.map(blockKey);
  const n = ka.length;
  const m = kb.length;
  const dp: number[][] = Array.from({ length: n + 1 }, () => Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      if (ka[i] && ka[i] === kb[j]) dp[i][j] = 1 + dp[i + 1][j + 1];
      else dp[i][j] = Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }

  const raw: DiffBlock[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (ka[i] && ka[i] === kb[j]) {
      raw.push({ type: 'same', html: b[j] || a[i] });
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      raw.push({ type: 'del', html: a[i] });
      i++;
    } else {
      raw.push({ type: 'add', html: b[j] });
      j++;
    }
  }
  while (i < n) raw.push({ type: 'del', html: a[i++] });
  while (j < m) raw.push({ type: 'add', html: b[j++] });

  // Collapse adjacent delete/add runs into paired blocks. This is the key
  // difference from the old renderer: a one-word paragraph edit becomes one
  // paragraph with two inline marks, not two full-height paragraph cards.
  const out: DiffBlock[] = [];
  let k = 0;
  while (k < raw.length) {
    if (raw[k].type === 'same') {
      out.push(raw[k]);
      k++;
      continue;
    }
    const deleted: DiffBlock[] = [];
    const added: DiffBlock[] = [];
    while (k < raw.length && raw[k].type !== 'same') {
      if (raw[k].type === 'del') deleted.push(raw[k]);
      if (raw[k].type === 'add') added.push(raw[k]);
      k++;
    }
    const pairCount = Math.min(deleted.length, added.length);
    for (let p = 0; p < pairCount; p++) {
      out.push({
        type: 'paired',
        html: added[p].html,
        beforeHtml: deleted[p].html,
        afterHtml: added[p].html,
      });
    }
    for (let p = pairCount; p < deleted.length; p++) out.push(deleted[p]);
    for (let p = pairCount; p < added.length; p++) out.push(added[p]);
  }
  return out;
}

/**
 * Ghost HTML with original block markup preserved (h1, math delimiters, tables).
 * Del sits in its own vertical slot; add follows below — no absolute overlap.
 */
export function buildCanvasDiffHtml(beforeHtml: string, afterHtml: string): string {
  const blocks = diffHtmlBlocks(beforeHtml || '', afterHtml || '');
  if (!blocks.length) {
    if (afterHtml?.trim()) {
      return wrapBlocks(
        htmlToBlockList(afterHtml).map((html) => ({ type: 'add' as const, html })),
      );
    }
    return '';
  }
  return wrapBlocks(blocks);
}

function wrapBlocks(blocks: DiffBlock[]): string {
  const parts = blocks.map((b) => {
    if (b.type === 'same') {
      return `<div class="studio-diff-block studio-diff-same" data-diff="same">${b.html}</div>`;
    }
    if (b.type === 'del') {
      return `<div class="studio-diff-block studio-diff-del" data-diff="del" aria-label="Se quitará">${b.html}</div>`;
    }
    if (b.type === 'paired') {
      const before = b.beforeHtml || '';
      const after = b.afterHtml || b.html || '';
      const inline = inlineDiffHtml(before, after);
      if (inline) {
        return `<div class="studio-diff-block studio-diff-paired" data-diff="paired" aria-label="Cambio en el párrafo">${inline}</div>`;
      }
      return `<div class="studio-diff-block studio-diff-paired" data-diff="paired" aria-label="Cambio de bloque"><div class="studio-diff-part studio-diff-del">${before}</div><div class="studio-diff-part studio-diff-add">${after}</div></div>`;
    }
    return `<div class="studio-diff-block studio-diff-add" data-diff="add" aria-label="Se dejará">${b.html}</div>`;
  });
  return `<div class="studio-diff-root">${parts.join('')}</div>`;
}

function inlineDiffHtml(beforeHtml: string, afterHtml: string): string | null {
  const before = blockInfo(beforeHtml);
  const after = blockInfo(afterHtml);
  // A tag change (e.g. a bullet <li> rewritten as a <p>, or heading level
  // shifting) should not force the whole block into a red/green swap — the
  // words are still comparable text. Only bail out for structurally
  // incomparable content (tables, images, math, lists-as-containers).
  if (!before || !after) return null;
  if (/<(table|ul|ol|pre|figure|img|svg)\b/i.test(beforeHtml + afterHtml)) return null;
  if (/studio-math|data-tex|\\\(|\\\[|\$\$/i.test(beforeHtml + afterHtml)) return null;
  const segments = diffWordSegments(before.text, after.text);
  const body = segments
    .map((segment, index) => {
      if (segment.type === 'same') return escapeText(segment.text);
      return `<span class="studio-diff-word-del" data-diff-hunk="${index}">${escapeText(segment.before)}</span><span class="studio-diff-word-add" data-diff-hunk="${index}">${escapeText(segment.after)}</span>`;
    })
    .join('');
  return `<${after.tag}${after.attrs}>${body}</${after.tag}>`;
}

function blockInfo(html: string): { tag: string; attrs: string; text: string } | null {
  const match = html.trim().match(/^<(p|h[1-6]|blockquote|li)([^>]*)>[\s\S]*<\/\1>$/i);
  if (!match) return null;
  return { tag: match[1].toLowerCase(), attrs: match[2] || '', text: htmlToPlain(html) };
}

function escapeText(s: string) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export type { DiffLine };
