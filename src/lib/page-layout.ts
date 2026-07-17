/**
 * Real multi-page layout for a single contentEditable.
 * Inserts non-editable break spacers so content never sits in the visual gap
 * between paper sheets. Page count = breaks + 1 from real content only.
 */

export const BREAK_ATTR = 'data-studio-break';

export type PageMetrics = {
  pageHeight: number;
  margin: number;
  pageGap: number;
  /** Content band per page (between top and bottom margins) */
  usableHeight: number;
  /**
   * Spacer between last line of page N and first line of page N+1:
   * bottom margin + visual gap + top margin
   */
  breakHeight: number;
};

export function pageMetrics(
  pageHeight: number,
  margin: number,
  pageGap: number,
): PageMetrics {
  const usableHeight = Math.max(120, pageHeight - margin * 2);
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
    'margin:0',
    'padding:0',
    'border:0',
    'outline:none',
    'user-select:none',
    'pointer-events:none',
    'clear:both',
  ].join(';');
  return br;
}

/**
 * Place page-break spacers so cumulative content per page ≤ usableHeight.
 * Returns resulting page count (≥ 1).
 */
export function reflowPageBreaks(root: HTMLElement, m: PageMetrics): number {
  // Snapshot selection
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

  const blocks = Array.from(root.children) as HTMLElement[];
  if (!blocks.length) {
    restoreSelection(root, selPath);
    return 1;
  }

  let used = 0;
  let pages = 1;
  const toInsert: { before: HTMLElement; height: number }[] = [];

  for (const block of blocks) {
    // Force layout
    const h = Math.ceil(block.getBoundingClientRect().height || block.offsetHeight || 0);
    const style = window.getComputedStyle(block);
    const mt = parseFloat(style.marginTop) || 0;
    const mb = parseFloat(style.marginBottom) || 0;
    const blockH = Math.max(1, h + mt + mb);

    // If a single block is taller than a page, still keep it (no mid-block split yet)
    if (used > 0 && used + blockH > m.usableHeight + 0.5) {
      toInsert.push({ before: block, height: m.breakHeight });
      pages += 1;
      used = blockH;
    } else {
      used += blockH;
    }
  }

  // Insert breaks from last to first so indices stay valid
  for (let i = toInsert.length - 1; i >= 0; i--) {
    const { before, height } = toInsert[i];
    before.parentNode?.insertBefore(createBreak(height), before);
  }

  restoreSelection(root, selPath);
  return Math.max(1, pages);
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
      if (endNode) {
        range.setEnd(endNode, Math.min(endOff, (endNode.textContent || '').length));
      } else {
        range.collapse(true);
      }
      sel.removeAllRanges();
      sel.addRange(range);
    }
  } catch {
    /* ignore */
  }
}

/** True content height for min-height (no artificial page stack) */
export function measureContentBottom(root: HTMLElement, margin: number): number {
  const kids = Array.from(root.children) as HTMLElement[];
  if (!kids.length) {
    const t = (root.innerText || '').replace(/\u00a0/g, ' ').trim();
    return t ? margin + 24 + margin : margin + margin;
  }
  let bottom = 0;
  kids.forEach((k) => {
    const b = k.offsetTop + k.offsetHeight;
    if (b > bottom) bottom = b;
  });
  // offsetTop is relative to padding edge of offsetParent
  return Math.max(bottom + margin, margin * 2 + 24);
}

/** Strip breaks before reading HTML for AI / export / history */
export function htmlWithoutBreaks(html: string): string {
  if (!html) return html;
  return html.replace(
    /<div[^>]*data-studio-break="1"[^>]*>[\s\S]*?<\/div>/gi,
    '',
  );
}

export function serializeEditorHtml(root: HTMLElement | null): string {
  if (!root) return '';
  const clone = root.cloneNode(true) as HTMLElement;
  clone.querySelectorAll(`[${BREAK_ATTR}]`).forEach((n) => n.remove());
  return clone.innerHTML;
}
