'use client';

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import { cn } from '@/lib/utils';
import type { PaperSize } from '@/lib/doc-tools';
import { sanitizeDocumentHtml } from '@/lib/math-html';
import { buildCanvasDiffHtml } from '@/lib/canvas-diff';
import {
  distributeHtmlToPages,
  joinPageHtmls,
  pageMetrics,
  placeCaretAtEnd,
  rebalanceFromPage,
  serializeEditorHtml,
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
const REBALANCE_MS = 180;

export type PaperCanvasHandle = {
  getHtml: () => string;
  setHtml: (html: string, opts?: { reveal?: boolean }) => void;
  getPageCount: () => number;
  focusEnd: () => void;
  /** For MathJax: all page body elements */
  getBodies: () => HTMLElement[];
};

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
  /** External full-document HTML (AI apply). When changes, redistributes pages. */
  documentHtml?: string;
};

const PaperCanvas = forwardRef<PaperCanvasHandle, Props>(function PaperCanvas(
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
    documentHtml,
  },
  ref,
) {
  const spec = PAPER[paperSize];
  const margin = MARGIN_PRESETS[marginPreset] ?? 72;
  const metrics = useMemo(
    () => pageMetrics(spec.heightPx, margin, PAGE_GAP, spec.widthPx),
    [spec.heightPx, spec.widthPx, margin],
  );

  const scrollRef = useRef<HTMLDivElement>(null);
  const bodyRefs = useRef<(HTMLDivElement | null)[]>([]);
  const skipInput = useRef(false);
  const rebalanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastExternalHtml = useRef<string | null>(null);

  const [pages, setPages] = useState<string[]>(['<p><br></p>']);
  const [activePage, setActivePage] = useState(0);
  const [hoverBtn, setHoverBtn] = useState<{ top: number; left: number; el: HTMLElement } | null>(
    null,
  );
  const [lineHls, setLineHls] = useState<
    { top: number; left: number; width: number; height: number; radius: string }[]
  >([]);
  const [editVisible, setEditVisible] = useState(false);
  const hoverLock = useRef(false);

  const hasGhost = Boolean(ghostHtml && ghostHtml.trim());
  const diffOverlayHtml = useMemo(() => {
    if (!hasGhost) return null;
    if (ghostBeforeHtml?.trim()) return buildCanvasDiffHtml(ghostBeforeHtml, ghostHtml || '');
    return buildCanvasDiffHtml('', ghostHtml || '');
  }, [hasGhost, ghostHtml, ghostBeforeHtml]);

  const styleOpts = useMemo(
    () => ({ fontFamily, fontSize }),
    [fontFamily, fontSize],
  );

  /** Prefer live DOM (typing) over React state so exports/AI see latest text */
  const getHtml = useCallback(() => {
    const live = bodyRefs.current
      .slice(0, Math.max(pages.length, bodyRefs.current.length))
      .filter(Boolean)
      .map((b) => (b as HTMLElement).innerHTML);
    if (live.length) return joinPageHtmls(live);
    return joinPageHtmls(pages);
  }, [pages]);

  const setHtml = useCallback(
    (html: string, opts?: { reveal?: boolean }) => {
      const clean = sanitizeDocumentHtml(html);
      const packed = distributeHtmlToPages(clean, metrics, styleOpts);
      skipInput.current = true;
      setPages(packed);
      lastExternalHtml.current = clean;
      // Force DOM write next frame (including focused bodies — full replace is intentional)
      requestAnimationFrame(() => {
        packed.forEach((pageHtml, i) => {
          const el = bodyRefs.current[i];
          if (el && el.innerHTML !== pageHtml) el.innerHTML = pageHtml;
        });
        skipInput.current = false;
        if (opts?.reveal && bodyRefs.current[0]) {
          const el = bodyRefs.current[0];
          el.classList.add('studio-first-reveal');
          window.setTimeout(() => el.classList.remove('studio-first-reveal'), 2200);
        }
      });
    },
    [metrics, styleOpts],
  );

  useImperativeHandle(
    ref,
    () => ({
      getHtml,
      setHtml,
      getPageCount: () => pages.length,
      focusEnd: () => {
        const last = bodyRefs.current[pages.length - 1];
        if (last) placeCaretAtEnd(last);
      },
      getBodies: () => bodyRefs.current.filter(Boolean) as HTMLElement[],
    }),
    [getHtml, setHtml, pages.length],
  );

  // External documentHtml prop sync (AI / undo)
  useEffect(() => {
    if (documentHtml == null) return;
    if (documentHtml === lastExternalHtml.current) return;
    setHtml(documentHtml);
  }, [documentHtml, setHtml]);

  useEffect(() => {
    onPageCountChange?.(pages.length);
  }, [pages.length, onPageCountChange]);

  // Re-pack when paper metrics / font change
  useEffect(() => {
    const html = joinPageHtmls(pages);
    const packed = distributeHtmlToPages(html, metrics, styleOpts);
    if (packed.length !== pages.length || packed.some((p, i) => p !== pages[i])) {
      skipInput.current = true;
      setPages(packed);
      requestAnimationFrame(() => {
        skipInput.current = false;
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [metrics, styleOpts.fontFamily, styleOpts.fontSize]);

  const scheduleRebalance = useCallback(
    (pageIdx: number) => {
      if (rebalanceTimer.current) clearTimeout(rebalanceTimer.current);
      rebalanceTimer.current = setTimeout(() => {
        // Read live HTML from DOM bodies (freshest)
        const liveCount = Math.max(bodyRefs.current.filter(Boolean).length, 1);
        const live = Array.from({ length: liveCount }, (_, i) =>
          bodyRefs.current[i]?.innerHTML ?? '<p><br></p>',
        );
        const next = rebalanceFromPage(live, pageIdx, metrics, styleOpts);
        lastExternalHtml.current = joinPageHtmls(next);
        skipInput.current = true;
        setPages(next);
        // Always write rebalanced HTML (overflow must leave the page — Word-like)
        requestAnimationFrame(() => {
          const grew = next.length > live.length;
          next.forEach((pageHtml, i) => {
            const el = bodyRefs.current[i];
            if (!el) return;
            if (el.innerHTML === pageHtml) return;
            const wasFocused = document.activeElement === el;
            el.innerHTML = pageHtml;
            // Only restore caret when this page actually changed (overflow/underflow)
            if (wasFocused && !grew) placeCaretAtEnd(el);
          });
          // Overflow created a new page while typing → caret follows content (Word-like)
          if (grew) {
            const last = bodyRefs.current[next.length - 1];
            if (last) placeCaretAtEnd(last);
          }
          skipInput.current = false;
          onInput();
        });
      }, REBALANCE_MS);
    },
    [metrics, styleOpts, onInput],
  );

  const handlePageInput = (pageIdx: number) => {
    if (skipInput.current) return;
    // Sync this page from DOM into state lightly via rebalance schedule
    scheduleRebalance(pageIdx);
  };

  // Hover (3+ lines only)
  useEffect(() => {
    const scroll = scrollRef.current;
    if (!scroll || hasGhost) return;

    const clearHover = () => {
      if (hoverLock.current) return;
      document.querySelectorAll('.studio-block-hover').forEach((n) => n.classList.remove('studio-block-hover'));
      setHoverBtn(null);
      setLineHls([]);
      setEditVisible(false);
    };

    const onMove = (e: MouseEvent) => {
      if (hoverLock.current) return;
      const t = e.target as HTMLElement;
      const body = t.closest('[data-page-body]') as HTMLElement | null;
      if (!body) {
        clearHover();
        return;
      }
      const block = t.closest(BLOCK_SEL) as HTMLElement | null;
      if (!block || !body.contains(block)) {
        clearHover();
        return;
      }

      try {
        const range = document.createRange();
        range.selectNodeContents(block);
        const rects = Array.from(range.getClientRects()).filter((r) => r.width > 2 && r.height > 2);
        const isTable = block.tagName.toLowerCase() === 'table';
        if (!isTable && rects.length < 3) {
          clearHover();
          return;
        }
        document.querySelectorAll('.studio-block-hover').forEach((n) => {
          if (n !== block) n.classList.remove('studio-block-hover');
        });
        block.classList.add('studio-block-hover');
        const br = block.getBoundingClientRect();
        const sr = scroll.getBoundingClientRect();
        const pad = 7;
        setHoverBtn({
          top: br.top - sr.top + scroll.scrollTop + 2,
          left: Math.min(br.right - sr.left + scroll.scrollLeft + 8, scroll.scrollLeft + scroll.clientWidth - 52),
          el: block,
        });
        setEditVisible(true);
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
  }, [pages.length, hasGhost, zoom, showEditButton]);

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
  };

  /** Click empty area of a page → focus that page body (Word: click blank sheet to type) */
  const onPageShellClick = (pageIdx: number, e: React.MouseEvent) => {
    if (!contentEditable || hasGhost) return;
    const t = e.target as HTMLElement;
    if (t.closest('[data-block-edit]')) return;
    // Clicks inside the editable body already place the caret natively
    if (t.closest('[data-page-body]') && t.closest(BLOCK_SEL)) return;
    const body = bodyRefs.current[pageIdx];
    if (!body) return;
    // Click on margin/padding of sheet or empty body padding
    if (t === body || !body.contains(t) || t === e.currentTarget) {
      e.preventDefault();
      setActivePage(pageIdx);
      placeCaretAtEnd(body);
    }
  };

  const onKeyDownPage = (pageIdx: number, e: React.KeyboardEvent) => {
    // Backspace on empty last page → remove page (Word-like)
    if (e.key === 'Backspace' && pageIdx > 0) {
      const body = bodyRefs.current[pageIdx];
      if (!body) return;
      const text = (body.innerText || '').replace(/\u00a0/g, ' ').trim();
      const sel = window.getSelection();
      const atStart =
        sel &&
        sel.isCollapsed &&
        sel.anchorOffset === 0 &&
        (sel.anchorNode === body || body.contains(sel.anchorNode));
      if (!text && atStart) {
        e.preventDefault();
        setPages((prev) => {
          if (prev.length <= 1) return prev;
          const next = prev.filter((_, i) => i !== pageIdx);
          lastExternalHtml.current = joinPageHtmls(next);
          return next;
        });
        requestAnimationFrame(() => {
          const prevBody = bodyRefs.current[pageIdx - 1];
          if (prevBody) placeCaretAtEnd(prevBody);
          onInput();
        });
      }
    }
  };

  // Keep bodyRefs length in sync
  bodyRefs.current = bodyRefs.current.slice(0, pages.length);

  // Sync pages HTML → DOM when pack/rebalance/external set changes state.
  // Skip only while user is mid-keystroke on that body AND skipInput is false
  // (rebalance path forces writes via skipInput + rAF above).
  useEffect(() => {
    pages.forEach((html, i) => {
      const el = bodyRefs.current[i];
      if (!el) return;
      if (!skipInput.current && document.activeElement === el) {
        // Live typing: DOM is source of truth until rebalance commits
        return;
      }
      if (el.innerHTML !== html) {
        const wasSkip = skipInput.current;
        skipInput.current = true;
        el.innerHTML = html;
        skipInput.current = wasSkip;
      }
    });
  }, [pages]);

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
              transform: `scale(${zoom})`,
              marginBottom: Math.max(0, (pages.length * (spec.heightPx + PAGE_GAP) - PAGE_GAP) * (zoom - 1)),
            }}
          >
            {pages.map((html, i) => (
              <div
                key={`page-${i}`}
                className="studio-page-sheet relative mb-10 overflow-hidden rounded-[2px] border border-neutral-200/90 bg-white shadow-[0_12px_40px_rgba(0,0,0,0.06)] last:mb-0"
                style={{
                  width: spec.widthPx,
                  height: spec.heightPx,
                }}
                onMouseDown={() => setActivePage(i)}
                onClick={(e) => onPageShellClick(i, e)}
              >
                <div
                  ref={(el) => {
                    bodyRefs.current[i] = el;
                  }}
                  data-page-body
                  data-page-index={i}
                  contentEditable={contentEditable && !hasGhost}
                  suppressContentEditableWarning
                  onInput={() => handlePageInput(i)}
                  onKeyDown={(e) => onKeyDownPage(i, e)}
                  onMouseUp={onMouseUp}
                  onDoubleClick={onDoubleClick}
                  className={cn(
                    'studio-doc-editor h-full max-w-none overflow-hidden text-neutral-900 outline-none',
                    'prose prose-neutral prose-p:my-2.5 prose-headings:mb-3 prose-headings:mt-5 prose-headings:font-inherit',
                    isLoading && 'opacity-60',
                    hasGhost && 'studio-doc-faded pointer-events-none select-none',
                  )}
                  style={{
                    boxSizing: 'border-box',
                    padding: margin,
                    fontFamily,
                    fontSize,
                    lineHeight: 1.65,
                    height: spec.heightPx,
                    overflow: 'hidden',
                  }}
                />
                <div className="pointer-events-none absolute bottom-4 left-0 right-0 text-center font-mono text-[10px] tracking-wide text-neutral-300">
                  {i + 1}
                </div>
              </div>
            ))}

            {/* Ghost overlay on first page only (point edits) */}
            {hasGhost && diffOverlayHtml && (
              <div
                className="studio-doc-editor studio-diff-layer pointer-events-none absolute left-0 top-0 z-20 max-w-none overflow-hidden"
                style={{
                  width: spec.widthPx,
                  height: spec.heightPx,
                  boxSizing: 'border-box',
                  padding: margin,
                  fontFamily,
                  fontSize,
                  lineHeight: 1.65,
                }}
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

export function readCleanEditorHtml(el: HTMLElement | null): string {
  return serializeEditorHtml(el);
}
