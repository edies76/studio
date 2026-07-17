'use client';

/**
 * Real continuous document editor (Word Online / Docs style).
 * One contentEditable — paste, type, and images just work.
 * Page chrome is visual: sheet height segments, break lines, page numbers.
 * No per-page clipping, no scroll trap inside a fake sheet.
 */

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { cn } from '@/lib/utils';
import type { PaperSize } from '@/lib/doc-tools';
import { sanitizeDocumentHtml, typesetEditor } from '@/lib/math-html';
import { buildCanvasDiffHtml } from '@/lib/canvas-diff';
import { placeCaretAtEnd } from '@/lib/page-layout';
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

const BLOCK_SEL = 'p, h1, h2, h3, h4, h5, h6, li, blockquote, pre, table';

export type PaperCanvasHandle = {
  getHtml: () => string;
  setHtml: (html: string, opts?: { reveal?: boolean }) => void;
  getPageCount: () => number;
  focusEnd: () => void;
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

  const scrollRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  const ghostRef = useRef<HTMLDivElement>(null);
  const skipInput = useRef(false);
  const lastExternalHtml = useRef<string | null>(null);
  const pageNotify = useRef(1);

  const [pageCount, setPageCount] = useState(1);
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
    // Prefer current live editor as "before" if beforeHtml missing (full-doc edits)
    const before =
      ghostBeforeHtml?.trim() ||
      (typeof document !== 'undefined' ? editorRef.current?.innerHTML || '' : '') ||
      '';
    return buildCanvasDiffHtml(before, ghostHtml || '');
  }, [hasGhost, ghostHtml, ghostBeforeHtml]);

  const measurePages = useCallback(() => {
    // When reviewing a proposal, size pages from the ghost (del+add stacked)
    const el = hasGhost && ghostRef.current ? ghostRef.current : editorRef.current;
    if (!el) return;
    void el.offsetHeight;
    const contentH = Math.max(el.scrollHeight, el.offsetHeight, 1);
    const n = Math.max(1, Math.ceil(contentH / spec.heightPx));
    setPageCount((prev) => (prev === n ? prev : n));
  }, [spec.heightPx, hasGhost]);

  // Typeset MathJax on structural ghost so LaTeX stays rendered
  useEffect(() => {
    if (!hasGhost || !ghostRef.current) return;
    const el = ghostRef.current;
    requestAnimationFrame(() => {
      typesetEditor(el);
      measurePages();
    });
  }, [hasGhost, diffOverlayHtml, measurePages]);

  const getHtml = useCallback(() => {
    const el = editorRef.current;
    if (!el) return '<p><br></p>';
    return el.innerHTML?.trim() || '<p><br></p>';
  }, []);

  const setHtml = useCallback(
    (html: string, opts?: { reveal?: boolean }) => {
      const clean = sanitizeDocumentHtml(html) || '<p><br></p>';
      lastExternalHtml.current = clean;
      const el = editorRef.current;
      if (!el) return;
      skipInput.current = true;
      el.innerHTML = clean;
      if (opts?.reveal) {
        el.classList.add('studio-first-reveal');
        window.setTimeout(() => el.classList.remove('studio-first-reveal'), 2200);
      }
      requestAnimationFrame(() => {
        skipInput.current = false;
        measurePages();
      });
    },
    [measurePages],
  );

  useImperativeHandle(
    ref,
    () => ({
      getHtml,
      setHtml,
      getPageCount: () => pageCount,
      focusEnd: () => {
        if (editorRef.current) placeCaretAtEnd(editorRef.current);
      },
      getBodies: () => (editorRef.current ? [editorRef.current] : []),
    }),
    [getHtml, setHtml, pageCount],
  );

  useEffect(() => {
    if (documentHtml == null) return;
    if (documentHtml === lastExternalHtml.current) return;
    setHtml(documentHtml);
  }, [documentHtml, setHtml]);

  useEffect(() => {
    if (pageNotify.current === pageCount) return;
    pageNotify.current = pageCount;
    onPageCountChange?.(pageCount);
  }, [pageCount, onPageCountChange]);

  useLayoutEffect(() => {
    measurePages();
  }, [measurePages, fontFamily, fontSize, zoom, paperSize, marginPreset]);

  useEffect(() => {
    const el = editorRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => measurePages());
    ro.observe(el);
    return () => ro.disconnect();
  }, [measurePages]);

  // Seed empty doc
  useEffect(() => {
    const el = editorRef.current;
    if (el && !el.innerHTML.trim()) {
      el.innerHTML = '<p><br></p>';
    }
  }, []);

  const handleInput = () => {
    if (skipInput.current) return;
    measurePages();
    onInput();
  };

  const handlePaste = () => {
    requestAnimationFrame(() => {
      // Clean up junk from Word paste a bit
      const el = editorRef.current;
      if (el) {
        // Strip Word mso styles on spans is heavy; keep native paste for fidelity
        measurePages();
      }
      onInput();
    });
  };

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
      if (!editorRef.current?.contains(t)) {
        clearHover();
        return;
      }
      const block = t.closest(BLOCK_SEL) as HTMLElement | null;
      if (!block || !editorRef.current.contains(block)) {
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
  }, [hasGhost, zoom, showEditButton, pageCount]);

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

  const paperHeight = Math.max(spec.heightPx, pageCount * spec.heightPx);

  // Repeating page break markers as background on the white sheet
  const pageBreakBg = useMemo(() => {
    // thin line every pageHeight
    return {
      backgroundColor: '#ffffff',
      backgroundImage: `repeating-linear-gradient(
        to bottom,
        transparent 0,
        transparent ${spec.heightPx - 1}px,
        rgba(0,0,0,0.06) ${spec.heightPx - 1}px,
        rgba(0,0,0,0.06) ${spec.heightPx}px
      )`,
    };
  }, [spec.heightPx]);

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
              marginBottom: Math.max(0, paperHeight * (zoom - 1)),
            }}
          >
            {/* Continuous white paper (real editor surface) */}
            <div
              className="relative overflow-hidden rounded-[2px] border border-neutral-200/90 shadow-[0_12px_40px_rgba(0,0,0,0.06)]"
              style={{
                width: spec.widthPx,
                minHeight: paperHeight,
                ...pageBreakBg,
              }}
            >
              {/* Page numbers (chrome) */}
              {Array.from({ length: pageCount }, (_, i) => (
                <div
                  key={`pn-${i}`}
                  className="pointer-events-none absolute left-0 right-0 z-0 text-center font-mono text-[10px] tracking-wide text-neutral-300"
                  style={{ top: (i + 1) * spec.heightPx - 28 }}
                  aria-hidden
                >
                  {i + 1}
                </div>
              ))}

              {/* Live document — faded under ghost (keeps real caret/DOM until accept) */}
              <div
                ref={editorRef}
                data-page-body
                data-studio-editor
                contentEditable={contentEditable && !hasGhost}
                suppressContentEditableWarning
                onInput={handleInput}
                onPaste={handlePaste}
                onMouseUp={onMouseUp}
                onDoubleClick={onDoubleClick}
                className={cn(
                  'studio-doc-editor relative z-10 max-w-none text-neutral-900 outline-none',
                  'prose prose-neutral prose-p:my-2.5 prose-headings:mb-3 prose-headings:mt-5 prose-headings:font-inherit',
                  isLoading && 'opacity-60',
                  hasGhost && 'studio-doc-faded pointer-events-none select-none',
                )}
                style={{
                  boxSizing: 'border-box',
                  width: '100%',
                  minHeight: hasGhost ? 0 : paperHeight,
                  // Collapse live height while ghost is shown so pages size from ghost
                  ...(hasGhost
                    ? { height: 0, overflow: 'hidden', padding: 0, margin: 0, opacity: 0 }
                    : {
                        padding: margin,
                        paddingBottom: margin + 32,
                      }),
                  fontFamily,
                  fontSize,
                  lineHeight: 1.65,
                  background: 'transparent',
                }}
              />

              {/*
                Structural ghost: real HTML blocks (h1/p/table/math) stacked.
                del then add share document flow — not the same absolute box.
              */}
              {hasGhost && diffOverlayHtml && (
                <div
                  ref={ghostRef}
                  className="studio-doc-editor studio-diff-layer relative z-20 max-w-none"
                  style={{
                    width: '100%',
                    minHeight: paperHeight,
                    boxSizing: 'border-box',
                    padding: margin,
                    paddingBottom: margin + 32,
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
  if (!el) return '';
  return el.innerHTML || '';
}
