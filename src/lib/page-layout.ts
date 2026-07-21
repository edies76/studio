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
  footerReserve: number;
};

export function pageMetrics(
  pageHeight: number,
  margin: number,
  pageGap: number,
  contentWidth: number,
  footerReserve = 0,
): PageMetrics {
  return {
    pageHeight,
    margin,
    pageGap,
    usableHeight: Math.max(200, pageHeight - margin * 2 - footerReserve),
    contentWidth: Math.max(200, contentWidth - margin * 2),
    footerReserve,
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
  // A manual page break is visually empty but semantically meaningful. Keep it
  // in the serialized document so a reflow/history round-trip cannot erase it.
  if (el.matches('[data-studio-break="1"], .studio-page-break')) return false;
  const t = (el.textContent || '').replace(/\u00a0/g, ' ').trim();
  if (t) return false;
  return !el.querySelector('img, table, svg, mjx-container, canvas, video, hr');
}

/** Normalize incoming HTML into top-level block list */
export function htmlToBlockHtmls(html: string): string[] {
  const cleaned = (html || '')
    .replace(/<\/?(html|head|body)[^>]*>/gi, '')
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
    // Chrome represents an empty paragraph created with Enter as
    // <div><br></div>. Keep its line box or pagination under-counts blank
    // lines and lets the caret continue below the sheet.
    if (tag === 'br') {
      blocks.push('<p><br></p>');
      return;
    }
    if (tag === 'div' && !el.className && !el.getAttribute('style') && el.attributes.length === 0) {
      if (el.children.length === 1 && el.firstElementChild?.tagName.toLowerCase() === 'br' && !(el.textContent || '').trim()) {
        blocks.push('<p><br></p>');
        return;
      }
      // flatten simple wrappers
      if (el.children.length) {
        Array.from(el.children).forEach((c) => blocks.push((c as HTMLElement).outerHTML));
      } else if ((el.textContent || '').trim()) {
        blocks.push(`<p>${el.innerHTML}</p>`);
      }
      return;
    }
    if (tag === 'ol' || tag === 'ul') {
      const items = Array.from(el.children).filter((child) => child.tagName.toLowerCase() === 'li') as HTMLElement[];
      // A long list used to be one indivisible block. Once it exceeded a
      // sheet, the lower items were clipped by the page's overflow:hidden.
      // Keep each item as a valid one-item list so pagination can move it to
      // the next sheet while preserving markers, nesting and ordered starts.
      if (items.length > 1) {
        const attributes = Array.from(el.attributes)
          .filter((attribute) => attribute.name.toLowerCase() !== 'start')
          .map((attribute) => ` ${attribute.name}="${attribute.value.replace(/"/g, '&quot;')}"`)
          .join('');
        const originalStart = Number.parseInt(el.getAttribute('start') || '1', 10) || 1;
        items.forEach((item, index) => {
          // Preserve imported Word/HTML numbering rather than restarting a
          // split list at one when its items cross visual pages.
          const start = tag === 'ol' ? ` start="${originalStart + index}"` : '';
          blocks.push(`<${tag}${attributes}${start}>${item.outerHTML}</${tag}>`);
        });
        return;
      }
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
  // This must match the real page body. Measuring with only `prose` silently
  // under-counts paragraph/heading/table margins, then the fixed sheet clips
  // content that the paginator believed fit.
  measure.className = [
    'studio-doc-editor',
    'prose',
    'prose-neutral',
    'prose-p:my-2.5',
    'prose-headings:mb-3',
    'prose-headings:mt-5',
    'prose-headings:font-inherit',
    'prose-table:my-3',
    'prose-img:my-3',
  ].join(' ');
  document.body.appendChild(measure);

  const pages: string[][] = [[]];
  let used = 0;
  // A partial reflow can start after an existing table fragment. Reserve any
  // identifiers already present in that tail so a newly split table can never
  // be stitched into an unrelated earlier table on save.
  const usedTableFragmentGroups = new Set<string>();
  blockHtmls.forEach((html) => {
    const matches = html.matchAll(/data-studio-table-fragment=["']([^"']+)["']/gi);
    for (const match of matches) usedTableFragmentGroups.add(match[1]);
  });
  let tableFragmentGroup = 0;

  const pushPage = () => {
    pages.push([]);
    used = 0;
  };

  const measureHtml = (html: string): number => {
    measure.innerHTML = html;
    const element = measure.firstElementChild as HTMLElement | null;
    return element ? Math.max(1, blockOuterHeight(element)) : 0;
  };

  /**
   * Tables used to be atomic layout blocks. A table taller than one sheet was
   * therefore inserted whole and clipped by the fixed page body. Split only
   * genuinely over-height tables into valid table fragments, repeating the
   * header. joinPageHtmls() stitches those temporary fragments back into one
   * semantic table before persistence/export.
   */
  const splitTallTable = (raw: string, height: number): string[] | null => {
    if (height <= m.usableHeight + 0.5 || !/^<table\b/i.test(raw.trim())) return null;
    const host = document.createElement('div');
    host.innerHTML = raw;
    const table = host.querySelector(':scope > table') as HTMLTableElement | null;
    if (!table) return null;

    const rows = Array.from(table.rows);
    if (rows.length < 2) return null;
    const headerRows = table.tHead
      ? Array.from(table.tHead.rows)
      : rows[0].querySelectorAll('th').length === rows[0].cells.length
        ? [rows[0]]
        : [];
    const bodyRows = rows.filter((row) => !headerRows.includes(row));
    if (!bodyRows.length) return null;

    let group = `table-${tableFragmentGroup++}`;
    while (usedTableFragmentGroups.has(group)) group = `table-${tableFragmentGroup++}`;
    usedTableFragmentGroups.add(group);
    const createFragment = (fragmentRows: HTMLTableRowElement[]) => {
      const clone = table.cloneNode(false) as HTMLTableElement;
      clone.dataset.studioTableFragment = group;
      // Captions and column geometry must be repeated so each rendered sheet
      // remains intelligible while the serialized document stays lossless.
      table.querySelectorAll(':scope > caption, :scope > colgroup').forEach((node) => clone.append(node.cloneNode(true)));
      if (headerRows.length) {
        const head = document.createElement('thead');
        headerRows.forEach((row) => head.append(row.cloneNode(true)));
        clone.append(head);
      }
      const body = document.createElement('tbody');
      fragmentRows.forEach((row) => body.append(row.cloneNode(true)));
      clone.append(body);
      return clone.outerHTML;
    };

    const fragments: string[] = [];
    let current: HTMLTableRowElement[] = [];
    for (const row of bodyRows) {
      const candidate = [...current, row];
      if (current.length && measureHtml(createFragment(candidate)) > m.usableHeight + 0.5) {
        fragments.push(createFragment(current));
        current = [row];
      } else {
        current = candidate;
      }
    }
    if (current.length) fragments.push(createFragment(current));
    return fragments.length > 1 ? fragments : null;
  };

  try {
    for (const originalRaw of blockHtmls) {
      const initialHeight = measureHtml(originalRaw);
      const raws = splitTallTable(originalRaw, initialHeight) || [originalRaw];
      for (const raw of raws) {
      // Manual breaks are layout boundaries, not visible content. Keep the
      // marker at the start of the next page so the boundary survives joining
      // pages, autosave, undo/redo, and a second pagination pass.
      if (/^<(div|p)\b[^>]*(?:data-studio-break="1"|class="[^"]*studio-page-break)[^>]*>/i.test(raw)) {
        if (pages[pages.length - 1].length > 0) pushPage();
        pages[pages.length - 1].push(raw);
        continue;
      }
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
    const children = Array.from(tmp.children);
    const empty = children.length > 0 && children.every((c) => isVisuallyEmpty(c as HTMLElement));
    const onlyAutomaticFiller = empty && children.length <= 1;
    if (onlyAutomaticFiller || !joined.trim()) pages.pop();
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
      const children = Array.from(d.children);
      const empty = children.length > 0 && children.every((c) => isVisuallyEmpty(c as HTMLElement));
      // A single empty paragraph is the editor's automatic trailing filler.
      // Multiple empty paragraphs are intentional blank lines and must remain
      // serializable so repeated Enter presses survive a React round-trip.
      return !empty || pages.length === 1 || children.length > 1;
    });
  if (!parts.length) return '<p><br></p>';

  const host = document.createElement('div');
  host.innerHTML = parts.join('');
  const fragments = new Map<string, HTMLTableElement>();
  host.querySelectorAll('table[data-studio-table-fragment]').forEach((node) => {
    const table = node as HTMLTableElement;
    const group = table.dataset.studioTableFragment;
    if (!group) return;
    const first = fragments.get(group);
    if (!first) {
      fragments.set(group, table);
      table.removeAttribute('data-studio-table-fragment');
      return;
    }
    const targetBody = first.tBodies[0] || first.createTBody();
    Array.from(table.tBodies).forEach((body) => {
      Array.from(body.rows).forEach((row) => targetBody.append(row.cloneNode(true)));
    });
    table.remove();
  });
  // If only empties kept for caret on page 1
  return host.innerHTML || '<p><br></p>';
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
