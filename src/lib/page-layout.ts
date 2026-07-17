/**
 * Word-like multi-page packing.
 * Content is split into page HTML fragments. Each page is a fixed-height sheet;
 * blocks never sit in the inter-page gap because they live inside a page body.
 */

export type PageMetrics = {
  pageHeight: number;
  margin: number;
  pageGap: number;
  usableHeight: number;
  contentWidth: number;
};

export function pageMetrics(
  pageHeight: number,
  margin: number,
  pageGap: number,
  contentWidth: number,
): PageMetrics {
  return {
    pageHeight,
    margin,
    pageGap,
    usableHeight: Math.max(200, pageHeight - margin * 2),
    contentWidth: Math.max(200, contentWidth - margin * 2),
  };
}

function blockOuterHeight(el: HTMLElement): number {
  void el.offsetHeight;
  const cs = window.getComputedStyle(el);
  return Math.ceil(
    (el.offsetHeight || 0) +
      (parseFloat(cs.marginTop) || 0) +
      (parseFloat(cs.marginBottom) || 0),
  );
}

function isVisuallyEmpty(el: HTMLElement): boolean {
  const t = (el.textContent || '').replace(/\u00a0/g, ' ').trim();
  if (t) return false;
  return !el.querySelector('img, table, svg, mjx-container, canvas, video, hr');
}

/** Normalize incoming HTML into top-level block list */
export function htmlToBlockHtmls(html: string): string[] {
  const cleaned = (html || '')
    .replace(/<\/?(html|head|body)[^>]*>/gi, '')
    .replace(/<div[^>]*data-studio-break[^>]*>[\s\S]*?<\/div>/gi, '')
    .trim();
  if (!cleaned) return ['<p><br></p>'];

  const host = document.createElement('div');
  host.innerHTML = cleaned;

  // Unwrap bare text nodes
  const blocks: string[] = [];
  Array.from(host.childNodes).forEach((node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const t = (node.textContent || '').trim();
      if (t) blocks.push(`<p>${t}</p>`);
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const el = node as HTMLElement;
    const tag = el.tagName.toLowerCase();
    if (tag === 'div' && !el.className) {
      // flatten simple wrappers
      if (el.children.length) {
        Array.from(el.children).forEach((c) => blocks.push((c as HTMLElement).outerHTML));
      } else if ((el.textContent || '').trim()) {
        blocks.push(`<p>${el.innerHTML}</p>`);
      }
      return;
    }
    blocks.push(el.outerHTML);
  });

  return blocks.length ? blocks : ['<p><br></p>'];
}

/**
 * Pack block HTML strings into pages that fit usableHeight.
 * Measures in an off-screen container matching content width + font.
 */
export function packBlocksIntoPages(
  blockHtmls: string[],
  m: PageMetrics,
  style?: { fontFamily?: string; fontSize?: string },
): string[] {
  if (typeof document === 'undefined') {
    return [blockHtmls.join('') || '<p><br></p>'];
  }

  const measure = document.createElement('div');
  measure.style.cssText = [
    'position:absolute',
    'left:-10000px',
    'top:0',
    `width:${m.contentWidth}px`,
    'visibility:hidden',
    'pointer-events:none',
    `font-family:${style?.fontFamily || 'Inter, Segoe UI, sans-serif'}`,
    `font-size:${style?.fontSize || '12px'}`,
    'line-height:1.65',
    'box-sizing:border-box',
  ].join(';');
  measure.className = 'prose prose-neutral';
  document.body.appendChild(measure);

  const pages: string[][] = [[]];
  let used = 0;

  const pushPage = () => {
    pages.push([]);
    used = 0;
  };

  try {
    for (const raw of blockHtmls) {
      measure.innerHTML = raw;
      const el = measure.firstElementChild as HTMLElement | null;
      if (!el) continue;
      const h = Math.max(1, blockOuterHeight(el));

      // Empty trailing fillers don't force new pages alone
      if (isVisuallyEmpty(el) && pages[pages.length - 1].length === 0) {
        pages[pages.length - 1].push(raw);
        used += Math.min(h, 28);
        continue;
      }

      if (used > 0 && used + h > m.usableHeight + 0.5) {
        pushPage();
      }
      pages[pages.length - 1].push(raw);
      used += h;
      if (used > m.usableHeight) used = m.usableHeight;
    }
  } finally {
    measure.remove();
  }

  // Drop empty trailing pages (keep at least one)
  while (pages.length > 1) {
    const last = pages[pages.length - 1];
    const joined = last.join('');
    const tmp = document.createElement('div');
    tmp.innerHTML = joined;
    const empty = Array.from(tmp.children).every((c) => isVisuallyEmpty(c as HTMLElement));
    if (empty || !joined.trim()) pages.pop();
    else break;
  }

  return pages.map((p) => (p.length ? p.join('') : '<p><br></p>'));
}

export function distributeHtmlToPages(
  html: string,
  m: PageMetrics,
  style?: { fontFamily?: string; fontSize?: string },
): string[] {
  return packBlocksIntoPages(htmlToBlockHtmls(html), m, style);
}

/** Join page HTMLs into one document HTML (for AI / export / history) */
export function joinPageHtmls(pages: string[]): string {
  const parts = pages
    .map((p) => p.trim())
    .filter(Boolean)
    .filter((p) => {
      const d = document.createElement('div');
      d.innerHTML = p;
      return !Array.from(d.children).every((c) => isVisuallyEmpty(c as HTMLElement)) || pages.length === 1;
    });
  if (!parts.length) return '<p><br></p>';
  // If only empties kept for caret on page 1
  return parts.join('') || '<p><br></p>';
}

/**
 * After editing page `idx`, re-pack from that page forward.
 * Returns new pages array.
 */
export function rebalanceFromPage(
  pages: string[],
  idx: number,
  m: PageMetrics,
  style?: { fontFamily?: string; fontSize?: string },
): string[] {
  const head = pages.slice(0, idx);
  const tailHtml = pages.slice(idx).join('');
  const tailBlocks = htmlToBlockHtmls(tailHtml);
  const packedTail = packBlocksIntoPages(tailBlocks, m, style);
  const next = [...head, ...packedTail];
  // Ensure at least one page
  return next.length ? next : ['<p><br></p>'];
}

export function serializeEditorHtml(root: HTMLElement | null): string {
  if (!root) return '';
  // Multi-page root: each [data-page-body]
  const bodies = root.querySelectorAll('[data-page-body]');
  if (bodies.length) {
    return joinPageHtmls(Array.from(bodies).map((b) => (b as HTMLElement).innerHTML));
  }
  return root.innerHTML;
}

/** @deprecated break-spacer API removed — kept as no-ops for safe imports */
export const BREAK_ATTR = 'data-studio-break';
export function stripBreaks(_root?: HTMLElement | null) {
  /* no-op: multi-page model has no spacers */
}
export function reflowPageBreaks(_root: HTMLElement, _m: unknown): number {
  return 1;
}
export function trimTrailingEmpty(_root: HTMLElement) {
  /* no-op */
}
export function placeCaretAtEnd(root: HTMLElement) {
  root.focus();
  const sel = window.getSelection();
  if (!sel) return;
  const range = document.createRange();
  range.selectNodeContents(root);
  range.collapse(false);
  sel.removeAllRanges();
  sel.addRange(range);
}
export function htmlWithoutBreaks(html: string): string {
  return (html || '').replace(/<div[^>]*data-studio-break="1"[^>]*>[\s\S]*?<\/div>/gi, '');
}
