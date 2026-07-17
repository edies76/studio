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
  placeCaretAtEnd,
  reflowPageBreaks,
  serializeEditorHtml,
  stripBreaks,
  trimTrailingEmpty,
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

const PAGE_GAP = 40;
const BLOCK_SEL = 'p, h1, h2, h3, h4, h5, h6, li, blockquote, pre, table';
const MAX_PAGES = 80;
/** Don't reflow on every keystroke — kills typing UX */
const REFLOW_DEBOUNCE_MS = 220;

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
  const reflowTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
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

  useImperativeHandle(ref, () => editorRef.current as HTMLDivElement);

  const applyReflow = useCallback(
    (immediate = false) => {
      const run = () => {
        const el = editorRef.current;
        if (!el || reflowing.current) return;
        reflowing.current = true;
        try {
          const text = (el.innerText || '').replace(/\u00a0/g, ' ').trim();

          if (!text) {
            stripBreaks(el);
            trimTrailingEmpty(el);
            setStackHeight(spec.heightPx);
            if (pageCountRef.current !== 1) {
              pageCountRef.current = 1;
              setPageCount(1);
            }
            return;
          }

          const pages = reflowPageBreaks(el, metrics);
          const n = Math.min(MAX_PAGES, Math.max(1, pages));
          const stack = n * spec.heightPx + (n - 1) * PAGE_GAP;
          setStackHeight(stack);
          if (pageCountRef.current !== n) {
            pageCountRef.current = n;
            setPageCount(n);
          }

          if (ghostRef.current && hasGhost) {
            reflowPageBreaks(ghostRef.current, metrics);
          }
        } finally {
          reflowing.current = false;
        }
      };

      if (immediate) {
        if (reflowTimer.current) clearTimeout(reflowTimer.current);
        requestAnimationFrame(run);
        return;
      }
      if (reflowTimer.current) clearTimeout(reflowTimer.current);
      reflowTimer.current = setTimeout(run, REFLOW_DEBOUNCE_MS);
    },
    [metrics, spec.heightPx, hasGhost],
  );

  useEffect(() => {
    onPageCountChange?.(pageCount);
  }, [pageCount, onPageCountChange]);

  // Reflow when layout inputs change (AI content, paper size, etc.) — immediate
  useEffect(() => {
    applyReflow(true);
  }, [applyReflow, paperSize, fontFamily, fontSize, margin, hasGhost, ghostHtml, zoom]);

  // Hover: only 3+ line blocks, one fat rect
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

      try {
        const range = document.createRange();
        range.selectNodeContents(hit);
        const rects = Array.from(range.getClientRects()).filter((r) => r.width > 2 && r.height > 2);
        const isTable = hit.tagName.toLowerCase() === 'table';
        if (!isTable && rects.length < 3) {
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
        const pad = 7;
        setLineHls([
          {
            top: br.top - sr.top + scroll.scrollTop - pad,
            left: br.left - sr.left + scroll.scrollLeft - pad,
            width: br.width + pad * 2,
            height: br.height + pad * 2,
            radius: '12px',
          },
        ]);
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

  /** Typing: parent history immediately; reflow debounced (no lag) */
  const handleInput = () => {
    if (reflowing.current) return;
    onInput();
    applyReflow(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Word-like: Backspace at start of empty trailing content trims empty pages on reflow
    if (e.key === 'Backspace' || e.key === 'Delete' || e.key === 'Enter') {
      // reflow after browser applies the key
      requestAnimationFrame(() => applyReflow(false));
    }
  };

  /** Click empty white of a page → focus caret at end (can type) */
  const handlePageClick = (e: React.MouseEvent) => {
    const el = editorRef.current;
    if (!el || !contentEditable || hasGhost) return;
    const t = e.target as HTMLElement;
    // If click already inside a text node / block, let browser handle
    if (t.closest(BLOCK_SEL) && t !== el) return;
    if (t.closest('[data-block-edit]')) return;
    e.preventDefault();
    placeCaretAtEnd(el);
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
    // Exactly the page stack — content drives pageCount via breaks, not the reverse
    minHeight: stackHeight,
    height: stackHeight,
    boxSizing: 'border-box',
    paddingLeft: margin,
    paddingRight: margin,
    paddingTop: margin,
    paddingBottom: margin,
    fontFamily,
    fontSize,
    lineHeight: 1.65,
    overflow: 'hidden', // never paint into the air outside the stack
  };

  return (
    <div className={cn('flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-neutral-100', className)}>
      <div
        ref={scrollRef}
        className="relative min-h-0 flex-1 overflow-y-auto overflow-x-auto"
        style={{ WebkitOverflowScrolling: 'touch' }}
        onClick={handlePageClick}
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
                  {i + 1}
                </div>
              </div>
            ))}

            {/* Solid gap covers (no text visible in the air) */}
            {pages.slice(0, -1).map((i) => (
              <div
                key={`gap-${i}`}
                className="pointer-events-none absolute bg-neutral-100"
                style={{
                  top: i * (spec.heightPx + PAGE_GAP) + spec.heightPx - 1,
                  left: -32,
                  width: spec.widthPx + 64,
                  height: PAGE_GAP + 2,
                  zIndex: 20,
                }}
                aria-hidden
              />
            ))}

            <div
              ref={editorRef}
              contentEditable={contentEditable && !hasGhost}
              suppressContentEditableWarning
              onInput={handleInput}
              onKeyDown={handleKeyDown}
              onMouseUp={onMouseUp}
              onDoubleClick={onDoubleClick}
              className={cn(
                'studio-doc-editor absolute left-0 top-0 z-10 max-w-none text-neutral-900 outline-none',
                'prose prose-neutral prose-p:my-2.5 prose-headings:mb-3 prose-headings:mt-5 prose-headings:font-inherit prose-headings:tracking-tight',
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
                className="studio-doc-editor studio-diff-layer pointer-events-none absolute left-0 top-0 z-10 max-w-none"
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
            }}
            onMouseDown={(e) => e.preventDefault()}
            onClick={editHovered}
            title="Editar bloque"
            className={cn(
              'studio-edit-fab absolute z-30 flex h-10 w-10 items-center justify-center rounded-full bg-studio-brown text-[#f3f1ec] shadow-lg',
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

export function readCleanEditorHtml(el: HTMLDivElement | null): string {
  return serializeEditorHtml(el);
}
