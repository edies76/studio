/**
 * Word-like pagination (continuous contentEditable).
 *
 * Rules (like Word):
 * - Start with 1 page.
 * - A new page appears only when real content overflows the current page band.
 * - Empty trailing pages are never kept.
 * - Page count NEVER comes from scrollHeight/minHeight (that caused 40–400 phantoms).
 * - Break spacers = visual gap + margins so text never sits in the “air” between sheets.
 */

export const BREAK_ATTR = 'data-studio-break';

export type PageMetrics = {
  pageHeight: number;
  margin: number;
  pageGap: number;
  usableHeight: number;
  breakHeight: number;
};

export function pageMetrics(
  pageHeight: number,
  margin: number,
  pageGap: number,
): PageMetrics {
  const usableHeight = Math.max(200, pageHeight - margin * 2);
  return {
    pageHeight,
    margin,
    pageGap,
    usableHeight,
    breakHeight: pageGap + margin * 2,
  };
}

export function isBreakEl(el: Element | null | undefined): boolean {
  return Boolean(el && el.getAttribute?.(BREAK_ATTR) === '1');
}

export function stripBreaks(root: HTMLElement): void {
  root.querySelectorAll(`[${BREAK_ATTR}]`).forEach((n) => n.remove());
}

function createBreak(height: number): HTMLDivElement {
  const br = document.createElement('div');
  br.setAttribute(BREAK_ATTR, '1');
  br.contentEditable = 'false';
  br.className = 'studio-page-break';
  br.setAttribute('aria-hidden', 'true');
  br.style.cssText = [
    `height:${height}px`,
    'width:100%',
    'margin:0',
    'padding:0',
    'border:0',
    'outline:none',
    'user-select:none',
    'pointer-events:none',
    'display:block',
    'clear:both',
  ].join(';');
  return br;
}

function outerH(el: HTMLElement): number {
  void el.offsetHeight;
  const h = el.offsetHeight || 0;
  const cs = window.getComputedStyle(el);
  return Math.ceil(h + (parseFloat(cs.marginTop) || 0) + (parseFloat(cs.marginBottom) || 0));
}

function isEmptyBlock(el: HTMLElement): boolean {
  if (isBreakEl(el)) return true;
  const t = (el.textContent || '').replace(/\u00a0/g, ' ').trim();
  if (t) return false;
  // empty p/div with only br
  return !el.querySelector('img, table, svg, mjx-container, canvas, video');
}

/** Drop trailing empty paragraphs (Word doesn't keep empty pages) */
export function trimTrailingEmpty(root: HTMLElement): void {
  // Keep at least one block so caret has a home
  while (root.children.length > 1) {
    const last = root.lastElementChild as HTMLElement;
    if (!last) break;
    if (isBreakEl(last) || isEmptyBlock(last)) {
      last.remove();
      continue;
    }
    break;
  }
  // Also strip trailing breaks
  while (root.lastElementChild && isBreakEl(root.lastElementChild)) {
    root.lastElementChild.remove();
  }
  if (!root.children.length) {
    const p = document.createElement('p');
    p.innerHTML = '<br>';
    root.appendChild(p);
  }
}

/**
 * Insert page breaks between blocks. Returns page count (≥1).
 * Safe to call often if debounced by caller.
 */
export function reflowPageBreaks(root: HTMLElement, m: PageMetrics): number {
  const sel = typeof window !== 'undefined' ? window.getSelection() : null;
  let selPath: { start: number; end: number } | null = null;
  if (sel && sel.rangeCount && root.contains(sel.anchorNode)) {
    try {
      const r = sel.getRangeAt(0);
      const pre = r.cloneRange();
      pre.selectNodeContents(root);
      pre.setEnd(r.startContainer, r.startOffset);
      const start = pre.toString().length;
      selPath = { start, end: start + r.toString().length };
    } catch {
      selPath = null;
    }
  }

  stripBreaks(root);
  trimTrailingEmpty(root);
  void root.offsetHeight;

  const blocks = Array.from(root.children) as HTMLElement[];
  if (!blocks.length) {
    restoreSelection(root, selPath);
    return 1;
  }

  // Pure content? (single empty p)
  if (blocks.length === 1 && isEmptyBlock(blocks[0])) {
    restoreSelection(root, selPath);
    return 1;
  }

  let used = 0;
  let pages = 1;
  const inserts: { before: HTMLElement; h: number }[] = [];

  for (const block of blocks) {
    const h = Math.max(1, outerH(block));
    // Empty trailing-ish blocks: don't force new pages alone
    if (isEmptyBlock(block) && used === 0) {
      used += Math.min(h, 24);
      continue;
    }

    if (used > 0 && used + h > m.usableHeight + 1) {
      // Whole block goes to next page (Word: avoid orphaning mid-block when possible)
      inserts.push({ before: block, h: m.breakHeight });
      pages += 1;
      used = Math.min(h, m.usableHeight);
    } else {
      used += h;
      if (used > m.usableHeight) used = m.usableHeight;
    }
  }

  for (let i = inserts.length - 1; i >= 0; i--) {
    const { before, h } = inserts[i];
    if (before.isConnected) before.parentNode?.insertBefore(createBreak(h), before);
  }

  // Never end with a break (would create empty last page)
  while (root.lastElementChild && isBreakEl(root.lastElementChild)) {
    root.lastElementChild.remove();
    pages = Math.max(1, pages - 1);
  }

  // Recount from DOM
  const n = root.querySelectorAll(`[${BREAK_ATTR}]`).length + 1;
  restoreSelection(root, selPath);
  return Math.min(80, Math.max(1, n));
}

function restoreSelection(
  root: HTMLElement,
  selPath: { start: number; end: number } | null,
) {
  if (!selPath || typeof window === 'undefined') return;
  const sel = window.getSelection();
  if (!sel) return;
  try {
    const range = document.createRange();
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let pos = 0;
    let startNode: Node | null = null;
    let startOff = 0;
    let endNode: Node | null = null;
    let endOff = 0;
    let node: Node | null;
    while ((node = walker.nextNode())) {
      const len = (node.textContent || '').length;
      if (!startNode && pos + len >= selPath.start) {
        startNode = node;
        startOff = selPath.start - pos;
      }
      if (!endNode && pos + len >= selPath.end) {
        endNode = node;
        endOff = selPath.end - pos;
        break;
      }
      pos += len;
    }
    if (startNode) {
      range.setStart(startNode, Math.min(startOff, (startNode.textContent || '').length));
      if (endNode) range.setEnd(endNode, Math.min(endOff, (endNode.textContent || '').length));
      else range.collapse(true);
      sel.removeAllRanges();
      sel.addRange(range);
    }
  } catch {
    /* ignore */
  }
}

export function serializeEditorHtml(root: HTMLElement | null): string {
  if (!root) return '';
  const clone = root.cloneNode(true) as HTMLElement;
  clone.querySelectorAll(`[${BREAK_ATTR}]`).forEach((n) => n.remove());
  // trim empty tails for AI
  while (clone.lastElementChild) {
    const last = clone.lastElementChild as HTMLElement;
    const t = (last.textContent || '').replace(/\u00a0/g, ' ').trim();
    if (!t && !last.querySelector('img,table,svg')) {
      last.remove();
      continue;
    }
    break;
  }
  return clone.innerHTML;
}

export function htmlWithoutBreaks(html: string): string {
  if (!html) return html;
  return html.replace(/<div[^>]*data-studio-break="1"[^>]*>[\s\S]*?<\/div>/gi, '');
}

/** Place caret at end of editor (Word-like click on empty page area) */
export function placeCaretAtEnd(root: HTMLElement): void {
  root.focus();
  const sel = window.getSelection();
  if (!sel) return;
  const range = document.createRange();
  range.selectNodeContents(root);
  range.collapse(false);
  sel.removeAllRanges();
  sel.addRange(range);
}
