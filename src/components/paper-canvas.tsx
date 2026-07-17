'use client';

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from 'react';
import { cn } from '@/lib/utils';
import type { PaperSize } from '@/lib/doc-tools';
import { sanitizeDocumentHtml } from '@/lib/math-html';
import { buildCanvasDiffHtml } from '@/lib/canvas-diff';
import {
  pageMetrics,
  reflowPageBreaks,
  serializeEditorHtml,
  stripBreaks,
} from '@/lib/page-layout';
import { Pencil } from 'lucide-react';
import type { StudioPrefs } from '@/components/studio-settings';

export const PAPER: Record<
  PaperSize,
  { widthPx: number; heightPx: number; label: string }
> = {
  letter: { widthPx: 816, heightPx: 1056, label: 'Letter 8.5×11"' },
  legal: { widthPx: 816, heightPx: 1344, label: 'Legal 8.5×14"' },
};

export const MARGIN_PRESETS: Record<StudioPrefs['marginPreset'], number> = {
  normal: 72,
  narrow: 48,
  wide: 96,
  apa: 72,
};

const PAGE_GAP = 36;
const BLOCK_SEL = 'p, h1, h2, h3, h4, h5, h6, li, blockquote, pre, table';
const MAX_PAGES = 60;

type Props = {
  paperSize: PaperSize;
  onPaperSizeChange: (s: PaperSize) => void;
  fontFamily: string;
  fontSize: string;
  contentEditable: boolean;
  isLoading?: boolean;
  onInput: () => void;
  onMouseUp: (e: React.MouseEvent) => void;
  onDoubleClick?: (e: React.MouseEvent) => void;
  onEditBlock?: (html: string, plain: string) => void;
  onPageCountChange?: (n: number) => void;
  ghostHtml?: string | null;
  ghostBeforeHtml?: string | null;
  ghostTitle?: string | null;
  zoom?: number;
  marginPreset?: StudioPrefs['marginPreset'];
  showEditButton?: boolean;
  className?: string;
};

const PaperCanvas = forwardRef<HTMLDivElement, Props>(function PaperCanvas(
  {
    paperSize,
    fontFamily,
    fontSize,
    contentEditable,
    isLoading,
    onInput,
    onMouseUp,
    onDoubleClick,
    onEditBlock,
    onPageCountChange,
    ghostHtml,
    ghostBeforeHtml,
    zoom = 1,
    marginPreset = 'normal',
    showEditButton = true,
    className,
  },
  ref,
) {
  const spec = PAPER[paperSize];
  const margin = MARGIN_PRESETS[marginPreset] ?? 72;
  const metrics = useMemo(
    () => pageMetrics(spec.heightPx, margin, PAGE_GAP),
    [spec.heightPx, margin],
  );

  const editorRef = useRef<HTMLDivElement>(null);
  const ghostRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const hoverLock = useRef(false);
  const reflowing = useRef(false);
  const pageCountRef = useRef(1);

  const [pageCount, setPageCount] = useState(1);
  const [stackHeight, setStackHeight] = useState(spec.heightPx);
  const [hoverBtn, setHoverBtn] = useState<{ top: number; left: number; el: HTMLElement } | null>(
    null,
  );
  const [lineHls, setLineHls] = useState<
    { top: number; left: number; width: number; height: number; radius: string }[]
  >([]);
  const [editVisible, setEditVisible] = useState(false);

  const hasGhost = Boolean(ghostHtml && ghostHtml.trim());
  const diffOverlayHtml = useMemo(() => {
    if (!hasGhost) return null;
    if (ghostBeforeHtml && ghostBeforeHtml.trim()) {
      return buildCanvasDiffHtml(ghostBeforeHtml, ghostHtml || '');
    }
    return buildCanvasDiffHtml('', ghostHtml || '');
  }, [hasGhost, ghostHtml, ghostBeforeHtml]);

  // Parent reads HTML without break spacers
  useImperativeHandle(ref, () => {
    const el = editorRef.current as HTMLDivElement;
    if (!el) return el;
    // Monkey-patch: get clean HTML via property used by parent through innerHTML reads
    // Parent should use serialize — we expose helper on element
    (el as any).__studioSerialize = () => serializeEditorHtml(el);
    return el;
  });

  const applyReflow = useCallback(() => {
    const el = editorRef.current;
    if (!el || reflowing.current) return;
    reflowing.current = true;
    try {
      // Layout breaks so content never lands in the visual gap
      const pages = reflowPageBreaks(el, metrics);
      const n = Math.min(MAX_PAGES, Math.max(1, pages));

      // Stack height from real pages only (not scrollHeight feedback)
      const stack = n * spec.heightPx + (n - 1) * PAGE_GAP;
      setStackHeight(stack);

      if (pageCountRef.current !== n) {
        pageCountRef.current = n;
        setPageCount(n);
      }

      // Ghost overlay: same break logic for height match
      const gh = ghostRef.current;
      if (gh && hasGhost) {
        reflowPageBreaks(gh, metrics);
      }
    } finally {
      reflowing.current = false;
    }
  }, [metrics, spec.heightPx, hasGhost]);

  useEffect(() => {
    onPageCountChange?.(pageCount);
  }, [pageCount, onPageCountChange]);

  useEffect(() => {
    const el = editorRef.current;
    if (!el) return;
    // Double rAF: wait for DOM/HTML paint then reflow
    let raf = requestAnimationFrame(() => {
      raf = requestAnimationFrame(() => applyReflow());
    });
    const ro = new ResizeObserver(() => {
      requestAnimationFrame(applyReflow);
    });
    ro.observe(el);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [applyReflow, paperSize, fontFamily, fontSize, margin, hasGhost, ghostHtml, zoom]);

  // Hover: vertical hit only
  useEffect(() => {
    const root = editorRef.current;
    const scroll = scrollRef.current;
    if (!root || !scroll || hasGhost) return;

    const clearHover = () => {
      if (hoverLock.current) return;
      root.querySelectorAll('.studio-block-hover').forEach((n) => n.classList.remove('studio-block-hover'));
      setHoverBtn(null);
      setLineHls([]);
      setEditVisible(false);
    };

    const onMove = (e: MouseEvent) => {
      if (hoverLock.current) return;
      const sr = scroll.getBoundingClientRect();
      const yDoc = e.clientY - sr.top + scroll.scrollTop;

      const blocks = Array.from(root.querySelectorAll(BLOCK_SEL)) as HTMLElement[];
      let hit: HTMLElement | null = null;
      for (const block of blocks) {
        if (!root.contains(block) || block.closest('[data-studio-break]')) continue;
        const br = block.getBoundingClientRect();
        const top = br.top - sr.top + scroll.scrollTop;
        const bottom = top + br.height;
        if (yDoc >= top - 2 && yDoc <= bottom + 2) {
          hit = block;
          break;
        }
      }

      if (!hit) {
        clearHover();
        return;
      }

      root.querySelectorAll('.studio-block-hover').forEach((n) => {
        if (n !== hit) n.classList.remove('studio-block-hover');
      });
      hit.classList.add('studio-block-hover');

      const br = hit.getBoundingClientRect();
      const top = br.top - sr.top + scroll.scrollTop + 2;
      const left = Math.min(
        br.right - sr.left + scroll.scrollLeft + 8,
        scroll.scrollLeft + scroll.clientWidth - 52,
      );
      setHoverBtn({ top, left, el: hit });
      setEditVisible(true);

      try {
        const range = document.createRange();
        range.selectNodeContents(hit);
        const rects = Array.from(range.getClientRects());
        if (hit.tagName.toLowerCase() === 'table' || rects.length <= 1) {
          setLineHls([
            {
              top: br.top - sr.top + scroll.scrollTop - 2,
              left: br.left - sr.left + scroll.scrollLeft - 4,
              width: br.width + 8,
              height: br.height + 4,
              radius: '10px',
            },
          ]);
        } else {
          const lineH = Math.max(...rects.map((r) => r.height), 16);
          const padY = Math.max(2, (lineH * 0.35) / 2);
          setLineHls(
            rects
              .filter((r) => r.width > 2 && r.height > 2)
              .map((r, i, arr) => {
                const isFirst = i === 0;
                const isLast = i === arr.length - 1;
                return {
                  top: r.top - sr.top + scroll.scrollTop - padY,
                  left: r.left - sr.left + scroll.scrollLeft - 5,
                  width: r.width + 10,
                  height: r.height + padY * 2,
                  radius:
                    isFirst && isLast
                      ? '10px'
                      : isFirst
                        ? '10px 10px 4px 4px'
                        : isLast
                          ? '4px 4px 10px 10px'
                          : '4px',
                };
              }),
          );
        }
      } catch {
        setLineHls([]);
      }
    };

    scroll.addEventListener('mousemove', onMove);
    scroll.addEventListener('mouseleave', clearHover);
    return () => {
      scroll.removeEventListener('mousemove', onMove);
      scroll.removeEventListener('mouseleave', clearHover);
    };
  }, [pageCount, hasGhost, zoom, showEditButton]);

  const handleInput = () => {
    if (reflowing.current) return;
    onInput();
    requestAnimationFrame(applyReflow);
  };

  const pages = useMemo(() => Array.from({ length: pageCount }, (_, i) => i), [pageCount]);

  const editHovered = () => {
    if (!hoverBtn?.el || !onEditBlock) return;
    const el = hoverBtn.el;
    const range = document.createRange();
    range.selectNodeContents(el);
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);
    onEditBlock(el.outerHTML, el.innerText || '');
    hoverLock.current = false;
    setHoverBtn(null);
    setLineHls([]);
    setEditVisible(false);
  };

  const contentStyle: CSSProperties = {
    width: spec.widthPx,
    /**
     * stackHeight comes from break count × page size — NOT from scrollHeight.
     * (Old bug: minHeight = f(scrollHeight) → scrollHeight = f(minHeight) → 400 pages)
     */
    minHeight: stackHeight,
    boxSizing: 'border-box',
    paddingLeft: margin,
    paddingRight: margin,
    paddingTop: margin,
    paddingBottom: margin,
    fontFamily,
    fontSize,
    lineHeight: 1.65,
  };

  return (
    <div className={cn('flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-neutral-100', className)}>
      <div
        ref={scrollRef}
        className="relative min-h-0 flex-1 overflow-y-auto overflow-x-auto"
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        <div className="px-8 py-10">
          <div
            className="relative mx-auto origin-top transition-transform duration-150"
            style={{
              width: spec.widthPx,
              height: stackHeight,
              transform: `scale(${zoom})`,
              marginBottom: Math.max(0, stackHeight * (zoom - 1)),
            }}
          >
            {/* Paper sheets — one per real page */}
            {pages.map((i) => (
              <div
                key={i}
                className="studio-page-sheet pointer-events-none absolute left-0 overflow-hidden rounded-[2px] border border-neutral-200/90 bg-white"
                style={{
                  top: i * (spec.heightPx + PAGE_GAP),
                  width: spec.widthPx,
                  height: spec.heightPx,
                  zIndex: 0,
                }}
                aria-hidden
              >
                <div className="absolute bottom-4 left-0 right-0 text-center font-mono text-[10px] tracking-wide text-neutral-300">
                  {i + 1} / {pageCount}
                </div>
              </div>
            ))}

            {/* Gap masks: cover the "air" between pages so nothing shows through */}
            {pages.slice(0, -1).map((i) => (
              <div
                key={`gap-${i}`}
                className="pointer-events-none absolute left-0 bg-neutral-100"
                style={{
                  top: i * (spec.heightPx + PAGE_GAP) + spec.heightPx,
                  width: spec.widthPx,
                  height: PAGE_GAP,
                  zIndex: 5,
                }}
                aria-hidden
              />
            ))}

            <div
              ref={editorRef}
              contentEditable={contentEditable && !hasGhost}
              suppressContentEditableWarning
              onInput={handleInput}
              onMouseUp={onMouseUp}
              onDoubleClick={onDoubleClick}
              onKeyUp={() => requestAnimationFrame(applyReflow)}
              className={cn(
                'studio-doc-editor absolute left-0 top-0 z-10 max-w-none text-neutral-900 outline-none transition-opacity',
                'prose prose-neutral prose-p:my-2.5 prose-headings:mb-3 prose-headings:mt-5 prose-headings:font-editorial',
                isLoading && 'opacity-60',
                hasGhost && 'studio-doc-faded pointer-events-none select-none',
              )}
              style={contentStyle}
              data-paper={paperSize}
              data-pages={pageCount}
            />

            {hasGhost && diffOverlayHtml && (
              <div
                ref={ghostRef}
                className="studio-doc-editor studio-diff-layer pointer-events-none absolute left-0 top-0 z-20 max-w-none"
                style={contentStyle}
                aria-hidden
                dangerouslySetInnerHTML={{ __html: sanitizeDocumentHtml(diffOverlayHtml) }}
              />
            )}
          </div>
        </div>

        {lineHls.map((hl, i) => (
          <div
            key={i}
            className="studio-line-hl"
            style={{
              top: hl.top,
              left: hl.left,
              width: hl.width,
              height: hl.height,
              borderRadius: hl.radius,
            }}
          />
        ))}

        {showEditButton && hoverBtn && onEditBlock && !hasGhost && (
          <button
            type="button"
            data-block-edit
            onMouseEnter={() => {
              hoverLock.current = true;
              setEditVisible(true);
            }}
            onMouseLeave={() => {
              hoverLock.current = false;
              setHoverBtn(null);
              setLineHls([]);
              setEditVisible(false);
              editorRef.current
                ?.querySelectorAll('.studio-block-hover')
                .forEach((n) => n.classList.remove('studio-block-hover'));
            }}
            onMouseDown={(e) => e.preventDefault()}
            onClick={editHovered}
            title="Editar bloque"
            className={cn(
              'studio-edit-fab absolute z-30 flex h-10 w-10 items-center justify-center rounded-full bg-[#2c2a26] text-[#f3f1ec] shadow-lg',
              editVisible ? 'studio-edit-fab-in' : 'studio-edit-fab-out',
            )}
            style={{ top: hoverBtn.top, left: hoverBtn.left }}
          >
            <Pencil className="h-4 w-4" strokeWidth={1.75} />
          </button>
        )}
      </div>
    </div>
  );
});

export default PaperCanvas;

/** Clean HTML for parent (AI / export / history) */
export function readCleanEditorHtml(el: HTMLDivElement | null): string {
  return serializeEditorHtml(el);
}

export function clearPageBreaks(el: HTMLDivElement | null): void {
  if (el) stripBreaks(el);
}
