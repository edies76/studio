import type { StudioBlock, StudioDocumentModel } from './studio-document';

export type NativePageMetrics = { width: number; height: number; margin: number; fontSize: number; lineHeight: number };
export type NativePlacedBlock = { block: StudioBlock; page: number; x: number; y: number; width: number; height: number };
export type NativeLayout = { pages: NativePlacedBlock[][]; placements: NativePlacedBlock[] };

/**
 * Deterministic first-pass layout for Docs Studio's native model. It is
 * intentionally independent of DOM/HTML: rendering can be swapped without
 * changing where content belongs. Fine typography is refined by the renderer.
 */
export function layoutNativeDocument(document: StudioDocumentModel, metrics: NativePageMetrics): NativeLayout {
  const contentWidth = Math.max(80, metrics.width - metrics.margin * 2);
  const contentBottom = Math.max(metrics.margin, metrics.height - metrics.margin);
  const pages: NativePlacedBlock[][] = [[]];
  let page = 0;
  let y = metrics.margin;
  const placements: NativePlacedBlock[] = [];
  const place = (block: StudioBlock, height: number) => {
    if (block.type === 'pageBreak' || (y + height > contentBottom && pages[page].length > 0)) {
      page += 1;
      pages[page] = [];
      y = metrics.margin;
      if (block.type === 'pageBreak') return;
    }
    const placed = { block, page, x: metrics.margin, y, width: contentWidth, height };
    pages[page].push(placed);
    placements.push(placed);
    y += height;
  };
  for (const block of document.blocks) {
    const chars = block.type === 'list'
      ? block.items.reduce((sum, item) => sum + item.runs.reduce((n, run) => n + run.text.length, 0), 0)
      : block.type === 'table'
        ? block.rows.reduce((sum, row) => sum + row.cells.reduce((n, cell) => n + cell.runs.reduce((r, run) => r + run.text.length, 0), 0), 0)
        : 'runs' in block ? block.runs.reduce((sum, run) => sum + run.text.length, 0) : 0;
    const lineCapacity = Math.max(12, Math.floor(contentWidth / Math.max(metrics.fontSize * 0.52, 1)));
    const lines = Math.max(1, Math.ceil(chars / lineCapacity));
    const multiplier = block.type === 'heading' ? 1.5 : block.type === 'quote' ? 1.15 : 1;
    const spacingAfter = ('style' in block && block.style?.spacingAfter) || 0;
    const height = block.type === 'image'
      ? Math.min(block.height || 260, Math.max(metrics.lineHeight, contentBottom - metrics.margin))
      : block.type === 'table'
        ? Math.max(metrics.lineHeight * 2, block.rows.length * metrics.lineHeight * 1.5)
        : Math.max(metrics.lineHeight, lines * metrics.lineHeight * multiplier) + spacingAfter;
    place(block, height);
  }
  return { pages, placements };
}
