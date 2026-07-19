'use client';

/**
 * Real multi-page document editor (Word-like).
 * Each page is a fixed-height white sheet. Content lives only inside
 * [data-page-body] — never in the inter-page gap (real DOM spacing).
 * Blocks are packed with page-layout.ts so prose cannot cross sheet edges.
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
  type MutableRefObject,
} from 'react';
import { cn } from '@/lib/utils';
import type { PaperSize } from '@/lib/doc-tools';
import { insertImageAtSelection, sanitizeDocumentHtml, typesetEditor } from '@/lib/math-html';
import { buildCanvasDiffHtml } from '@/lib/canvas-diff';
import {
  distributeHtmlToPages,
  joinPageHtmls,
  pageMetrics,
  placeCaretAtEnd,
  rebalanceFromPage,
  serializeEditorHtml,
} from '@/lib/page-layout';
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Maximize2,
  Minus,
  Plus,
  Trash2,
  WrapText,
} from 'lucide-react';
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

/** Visual gap between real sheets — empty DOM space, not painted under text */
const PAGE_GAP = 28;
const REBALANCE_MS = 160;
const BLOCK_SEL = 'p, h1, h2, h3, h4, h5, h6, li, blockquote, pre, table';

type ImageWrapMode = 'inline' | 'left' | 'right' | 'center' | 'break' | 'behind';

const IMAGE_WRAP_OPTIONS: { value: ImageWrapMode; label: string }[] = [
  { value: 'inline', label: 'En línea' },
  { value: 'left', label: 'Ajuste izquierda' },
  { value: 'right', label: 'Ajuste derecha' },
  { value: 'center', label: 'Centrada' },
  { value: 'break', label: 'Texto arriba y abajo' },
  { value: 'behind', label: 'Detrás del texto · mover libre' },
];

type ImageToolsRect = {
  top: number;
  left: number;
  width: number;
  height: number;
};

type TableToolsRect = {
  top: number;
  left: number;
  width: number;
};

type ResizeSession = {
  image: HTMLImageElement;
  direction: 'nw' | 'ne' | 'sw' | 'se';
  startX: number;
  startWidth: number;
  ratio: number;
};

type DragSession = {
  target: HTMLElement;
  startX: number;
  startY: number;
  startLeft: number;
  startTop: number;
};

function getImageWrapMode(image: HTMLImageElement): ImageWrapMode {
  const explicit = image.dataset.studioWrap as ImageWrapMode | undefined;
  if (explicit && ['inline', 'left', 'right', 'center', 'break', 'behind'].includes(explicit)) return explicit;
  if (image.style.float === 'left') return 'left';
  if (image.style.float === 'right') return 'right';
  if (image.style.display === 'inline-block') return 'inline';
  if (image.style.marginLeft === 'auto' && image.style.marginRight === 'auto') return 'center';
  return 'break';
}

function applyImageWrapMode(image: HTMLImageElement, mode: ImageWrapMode, editor?: HTMLElement | null): void {
  const previousRect = image.getBoundingClientRect();
  const editorRect = editor?.getBoundingClientRect();
  image.dataset.studioWrap = mode;
  image.style.maxWidth = '100%';
  image.style.height = 'auto';
  image.style.float = mode === 'left' || mode === 'right' ? mode : 'none';
  image.style.display = mode === 'inline' ? 'inline-block' : 'block';
  image.style.verticalAlign = mode === 'inline' ? 'middle' : '';

  if (mode === 'behind') {
    image.style.position = 'absolute';
    image.style.zIndex = '0';
    image.style.margin = '0';
    if (editorRect) {
      const scale = editorRect.width ? editorRect.width / Math.max(editor?.offsetWidth || editorRect.width, 1) : 1;
      image.style.left = `${Math.max(0, (previousRect.left - editorRect.left) / Math.max(scale, 0.01))}px`;
      image.style.top = `${Math.max(0, (previousRect.top - editorRect.top) / Math.max(scale, 0.01))}px`;
    }
    return;
  }

  image.style.position = '';
  image.style.left = '';
  image.style.top = '';
  image.style.zIndex = '';

  if (mode === 'inline') image.style.margin = '0 0.3em';
  if (mode === 'left') image.style.margin = '0.25em 1.1em 0.6em 0';
  if (mode === 'right') image.style.margin = '0.25em 0 0.6em 1.1em';
  if (mode === 'center') image.style.margin = '0.85em auto';
  if (mode === 'break') image.style.margin = '0.85em 0';
}

function bodyContaining(node: Node | null, bodies: (HTMLElement | null)[]): HTMLElement | null {
  if (!node) return null;
  for (const b of bodies) {
    if (b && (b === node || b.contains(node))) return b;
  }
  return null;
}

/** Math only supports the two modes that make sense for an equation: flow
 *  with the text (inline), or take the entire line exclusively (block),
 *  optionally freed from the flow entirely so it can be dragged (behind). */
type MathWrapMode = 'inline' | 'block' | 'behind';

function getMathWrapMode(host: HTMLElement): MathWrapMode {
  const explicit = host.dataset.studioWrap as MathWrapMode | undefined;
  if (explicit === 'behind') return 'behind';
  if (explicit === 'inline') return 'inline';
  if (explicit === 'block') return 'block';
  return host.getAttribute('data-display') === '1' || host.classList.contains('studio-math-block')
    ? 'block'
    : 'inline';
}

function getMathScale(host: HTMLElement): number {
  const value = Number(host.dataset.mathScale);
  return Number.isFinite(value) && value > 0 ? value : 100;
}

function applyMathScale(host: HTMLElement, scale: number): void {
  const next = Math.min(180, Math.max(60, Math.round(scale / 10) * 10));
  host.dataset.mathScale = String(next);
  host.style.fontSize = `${next}%`;
}

function applyMathWrapMode(host: HTMLElement, mode: MathWrapMode, editor?: HTMLElement | null): void {
  const previousRect = host.getBoundingClientRect();
  const editorRect = editor?.getBoundingClientRect();
  host.dataset.studioWrap = mode;
  host.setAttribute('data-display', mode === 'inline' ? '0' : '1');

  if (mode === 'behind') {
    host.classList.remove('studio-math-inline');
    host.classList.add('studio-math-block');
    host.style.position = 'absolute';
    host.style.zIndex = '0';
    host.style.margin = '0';
    host.style.display = 'inline-block';
    if (editorRect) {
      const scale = editorRect.width ? editorRect.width / Math.max(editor?.offsetWidth || editorRect.width, 1) : 1;
      host.style.left = `${Math.max(0, (previousRect.left - editorRect.left) / Math.max(scale, 0.01))}px`;
      host.style.top = `${Math.max(0, (previousRect.top - editorRect.top) / Math.max(scale, 0.01))}px`;
    }
    return;
  }

  host.style.position = '';
  host.style.left = '';
  host.style.top = '';
  host.style.zIndex = '';
  host.style.display = '';
  host.style.margin = '';

  if (mode === 'block') {
    // Exclusive full line — same idea as a "break" wrapped image.
    host.classList.remove('studio-math-inline');
    host.classList.add('studio-math-block');
  } else {
    host.classList.remove('studio-math-block');
    host.classList.add('studio-math-inline');
  }
}

export type PaperCanvasHandle = {
  getHtml: () => string;
  setHtml: (html: string, opts?: { reveal?: boolean }) => void;
  getPageCount: () => number;
  focusEnd: () => void;
  restoreSelection: () => boolean;
  getBodies: () => HTMLElement[];
  insertImage: (file: File) => Promise<boolean>;
  /** Commits a toolbar/selection command that mutates contentEditable DOM. */
  commitExternalMutation: () => void;
};

type Props = {
  paperSize: PaperSize;
  onPaperSizeChange: (s: PaperSize) => void;
  fontFamily: string;
  fontSize: string;
  contentEditable: boolean;
  isLoading?: boolean;
  onInput: () => void;
  /** Called right after a word boundary key (space/enter/tab/punctuation)
   *  or backspace, BEFORE the DOM reflects it, so the caller can snapshot
   *  the previous word as its own undo step instead of batching keystrokes
   *  into one large debounced entry. */
  onHistoryBoundary?: () => void;
  onUndo?: () => void;
  onRedo?: () => void;
  onMouseUp: (e: React.MouseEvent) => void;
  onDoubleClick?: (e: React.MouseEvent) => void;
  onEditMath?: (math: HTMLElement) => void;
  onEditBlock?: (html: string, plain: string) => void;
  onPageCountChange?: (n: number) => void;
  ghostHtml?: string | null;
  ghostBeforeHtml?: string | null;
  ghostTitle?: string | null;
  zoom?: number;
  marginPreset?: StudioPrefs['marginPreset'];
  showEditButton?: boolean;
  allowImages?: boolean;
  imageMaxMb?: number;
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
    onHistoryBoundary,
    onUndo,
    onRedo,
    onMouseUp,
    onDoubleClick,
    onEditMath,
    onPageCountChange,
    ghostHtml,
    ghostBeforeHtml,
    zoom = 1,
    marginPreset = 'normal',
    allowImages = true,
    imageMaxMb = 5,
    className,
    documentHtml,
  },
  ref,
) {
  const spec = PAPER[paperSize];
  const margin = MARGIN_PRESETS[marginPreset] ?? 72;
  const maxImageBytes = Math.max(1, imageMaxMb) * 1024 * 1024;
  const metrics = useMemo(
    () => pageMetrics(spec.heightPx, margin, PAGE_GAP, spec.widthPx),
    [spec.heightPx, spec.widthPx, margin],
  );
  const styleOpts = useMemo(() => ({ fontFamily, fontSize }), [fontFamily, fontSize]);

  const scrollRef = useRef<HTMLDivElement>(null);
  const bodyRefs = useRef<(HTMLDivElement | null)[]>([]);
  const skipInput = useRef(false);
  const rebalanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastExternalHtml = useRef<string | null>(null);
  const lastSelection = useRef<Range | null>(null);
  const pageNotify = useRef(1);
  const resizeSession = useRef<ResizeSession | null>(null);
  const dragSession = useRef<DragSession | null>(null);
  /** Tracks the HTML we last wrote per page body, so the React→DOM sync
   *  effect doesn't diff against MathJax-mutated (rendered) DOM and stomp
   *  rendered formulas back to their raw source form. */
  const lastWrittenHtml = useRef<string[]>([]);

  const [pages, setPages] = useState<string[]>(['<p><br></p>']);
  const [activePage, setActivePage] = useState(0);
  const [selectedImage, setSelectedImage] = useState<HTMLImageElement | null>(null);
  const [imageTools, setImageTools] = useState<ImageToolsRect | null>(null);
  const [selectedTable, setSelectedTable] = useState<HTMLTableElement | null>(null);
  const [tableTools, setTableTools] = useState<TableToolsRect | null>(null);
  const [selectedMath, setSelectedMath] = useState<HTMLElement | null>(null);
  const [mathTools, setMathTools] = useState<TableToolsRect | null>(null);

  const hasGhost = Boolean(ghostHtml && ghostHtml.trim());

  const liveBodies = useCallback(
    () => bodyRefs.current.filter(Boolean) as HTMLElement[],
    [],
  );

  const rememberSelection = useCallback(() => {
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount || !sel.anchorNode) return;
    const body = bodyContaining(sel.anchorNode, bodyRefs.current);
    if (!body) return;
    lastSelection.current = sel.getRangeAt(0).cloneRange();
  }, []);

  const getHtml = useCallback(() => {
    const live = bodyRefs.current
      .slice(0, Math.max(pages.length, bodyRefs.current.length))
      .filter(Boolean)
      .map((b) => (b as HTMLElement).innerHTML);
    if (live.length) return joinPageHtmls(live);
    return joinPageHtmls(pages);
  }, [pages]);

  const writePagesToDom = useCallback((packed: string[]) => {
    packed.forEach((pageHtml, i) => {
      const el = bodyRefs.current[i];
      if (el && el.innerHTML !== pageHtml) el.innerHTML = pageHtml;
      lastWrittenHtml.current[i] = pageHtml;
    });
  }, []);

  const setHtml = useCallback(
    (html: string, opts?: { reveal?: boolean }) => {
      const clean = sanitizeDocumentHtml(html) || '<p><br></p>';
      const packed = distributeHtmlToPages(clean, metrics, styleOpts);
      skipInput.current = true;
      setSelectedImage(null);
      setImageTools(null);
      setSelectedTable(null);
      setTableTools(null);
      setSelectedMath(null);
      setMathTools(null);
      setPages(packed);
      lastExternalHtml.current = clean;
      requestAnimationFrame(() => {
        writePagesToDom(packed);
        packed.forEach((_, i) => {
          const el = bodyRefs.current[i];
          if (el) typesetEditor(el);
        });
        skipInput.current = false;
        if (opts?.reveal && bodyRefs.current[0]) {
          const el = bodyRefs.current[0];
          el.classList.add('studio-first-reveal');
          window.setTimeout(() => el.classList.remove('studio-first-reveal'), 2200);
        }
      });
    },
    [metrics, styleOpts, writePagesToDom],
  );

  const scheduleRebalance = useCallback(
    (pageIdx: number) => {
      if (rebalanceTimer.current) clearTimeout(rebalanceTimer.current);
      rebalanceTimer.current = setTimeout(() => {
        const liveCount = Math.max(bodyRefs.current.filter(Boolean).length, 1);
        const live = Array.from({ length: liveCount }, (_, i) =>
          bodyRefs.current[i]?.innerHTML ?? '<p><br></p>',
        );
        const next = rebalanceFromPage(live, pageIdx, metrics, styleOpts);
        lastExternalHtml.current = joinPageHtmls(next);
        skipInput.current = true;
        setPages(next);
        requestAnimationFrame(() => {
          const grew = next.length > live.length;
          next.forEach((pageHtml, i) => {
            const el = bodyRefs.current[i];
            if (!el) return;
            if (el.innerHTML === pageHtml) return;
            const wasFocused = document.activeElement === el;
            el.innerHTML = pageHtml;
            typesetEditor(el);
            if (wasFocused && !grew) placeCaretAtEnd(el);
          });
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
      restoreSelection: () => {
        const range = lastSelection.current;
        if (!range) return false;
        const body = bodyContaining(range.startContainer, bodyRefs.current);
        if (!body || !body.contains(range.startContainer)) return false;
        const sel = window.getSelection();
        sel?.removeAllRanges();
        sel?.addRange(range.cloneRange());
        body.focus({ preventScroll: true });
        return true;
      },
      getBodies: () => liveBodies(),
      commitExternalMutation: () => {
        const bodies = liveBodies();
        const selected = window.getSelection()?.anchorNode ?? lastSelection.current?.startContainer ?? null;
        const body = bodyContaining(selected, bodies) || bodies[activePage] || bodies[0];
        const index = Math.max(0, bodies.indexOf(body));
        scheduleRebalance(index);
        requestAnimationFrame(() => onInput());
      },
      insertImage: async (file: File) => {
        if (!allowImages || !file.type.startsWith('image/') || file.size > maxImageBytes) return false;
        const bodies = liveBodies();
        let el =
          bodyContaining(lastSelection.current?.startContainer ?? null, bodies) ||
          bodies[activePage] ||
          bodies[0];
        if (!el) return false;
        const src = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result || ''));
          reader.onerror = () => reject(reader.error || new Error('Could not read image'));
          reader.readAsDataURL(file);
        });
        const image = insertImageAtSelection(
          el,
          src,
          file.name.replace(/\.[^.]+$/, '') || 'Inserted image',
          lastSelection.current,
        );
        applyImageWrapMode(image, 'break', el);
        setSelectedImage(image);
        const idx = bodies.indexOf(el);
        scheduleRebalance(Math.max(0, idx));
        requestAnimationFrame(() => onInput());
        return true;
      },
    }),
    [getHtml, setHtml, pages.length, liveBodies, activePage, scheduleRebalance, onInput],
  );

  useEffect(() => {
    if (documentHtml == null) return;
    if (documentHtml === lastExternalHtml.current) return;
    setHtml(documentHtml);
  }, [documentHtml, setHtml]);

  useEffect(() => {
    if (pageNotify.current === pages.length) return;
    pageNotify.current = pages.length;
    onPageCountChange?.(pages.length);
  }, [pages.length, onPageCountChange]);

  // Re-pack when paper metrics / font change
  useEffect(() => {
    const html = getHtml();
    const packed = distributeHtmlToPages(html, metrics, styleOpts);
    if (packed.length !== pages.length || packed.some((p, i) => p !== pages[i])) {
      skipInput.current = true;
      setPages(packed);
      requestAnimationFrame(() => {
        writePagesToDom(packed);
        skipInput.current = false;
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [metrics, styleOpts.fontFamily, styleOpts.fontSize, paperSize, marginPreset]);

  // Sync React page state → DOM when not mid-keystroke.
  // IMPORTANT: after MathJax typesets a page, the live DOM (<mjx-container>)
  // no longer matches the raw source HTML kept in `pages` — comparing
  // el.innerHTML to that raw HTML would always look "stale" and this effect
  // would keep stomping the rendered math back to its raw <span data-tex>
  // form forever. Track what we last WROTE per page instead of diffing
  // against the (possibly MathJax-mutated) live DOM.
  useEffect(() => {
    pages.forEach((html, i) => {
      const el = bodyRefs.current[i];
      if (!el) return;
      if (!skipInput.current && document.activeElement === el) return;
      if (lastWrittenHtml.current[i] === html) return;
      const wasSkip = skipInput.current;
      skipInput.current = true;
      el.innerHTML = html;
      lastWrittenHtml.current[i] = html;
      skipInput.current = wasSkip;
      typesetEditor(el);
    });
  }, [pages]);

  bodyRefs.current = bodyRefs.current.slice(0, pages.length);

  const ghostPages = useMemo(() => {
    if (!hasGhost) return null;
    const before =
      ghostBeforeHtml?.trim() ||
      (typeof document !== 'undefined' ? getHtml() : '') ||
      '';
    const diff = buildCanvasDiffHtml(before, ghostHtml || '');
    return distributeHtmlToPages(sanitizeDocumentHtml(diff) || '<p><br></p>', metrics, styleOpts);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasGhost, ghostHtml, ghostBeforeHtml, metrics, styleOpts]);

  useEffect(() => {
    if (!hasGhost || !ghostPages) return;
    requestAnimationFrame(() => {
      document.querySelectorAll('[data-ghost-page-body]').forEach((el) => typesetEditor(el as HTMLElement));
    });
  }, [hasGhost, ghostPages]);

  const updateImageTools = useCallback(() => {
    const scroll = scrollRef.current;
    const image = selectedImage;
    if (!scroll || !image || hasGhost) {
      setImageTools(null);
      return;
    }
    const bodies = liveBodies();
    if (!bodies.some((b) => b.contains(image))) {
      setImageTools(null);
      return;
    }
    const rect = image.getBoundingClientRect();
    const scrollRect = scroll.getBoundingClientRect();
    setImageTools({
      top: rect.top - scrollRect.top + scroll.scrollTop,
      left: rect.left - scrollRect.left + scroll.scrollLeft,
      width: rect.width,
      height: rect.height,
    });
  }, [hasGhost, selectedImage, liveBodies]);

  const updateTableTools = useCallback(() => {
    const table = selectedTable;
    const scroll = scrollRef.current;
    if (!table || !scroll || hasGhost) {
      setTableTools(null);
      return;
    }
    if (!liveBodies().some((b) => b.contains(table))) {
      setTableTools(null);
      return;
    }
    const rect = table.getBoundingClientRect();
    const scrollRect = scroll.getBoundingClientRect();
    setTableTools({
      top: Math.max(8, rect.top - scrollRect.top + scroll.scrollTop - 44),
      left: Math.max(8, rect.left - scrollRect.left + scroll.scrollLeft),
      width: rect.width,
    });
  }, [selectedTable, hasGhost, liveBodies]);

  const updateMathTools = useCallback(() => {
    const math = selectedMath;
    const scroll = scrollRef.current;
    if (!math || !scroll || hasGhost) {
      setMathTools(null);
      return;
    }
    if (!liveBodies().some((b) => b.contains(math))) {
      setMathTools(null);
      return;
    }
    const rect = math.getBoundingClientRect();
    const scrollRect = scroll.getBoundingClientRect();
    const toolbarWidth = Math.max(180, Math.min(360, rect.width + 180));
    const centeredLeft = rect.left - scrollRect.left + scroll.scrollLeft + rect.width / 2 - toolbarWidth / 2;
    setMathTools({
      top: Math.max(8, rect.top - scrollRect.top + scroll.scrollTop - 44),
      left: Math.max(8, Math.min(scroll.clientWidth - toolbarWidth - 8, centeredLeft)),
      width: rect.width,
    });
  }, [hasGhost, selectedMath, liveBodies]);

  useLayoutEffect(() => {
    updateImageTools();
    const scroll = scrollRef.current;
    if (!scroll || !selectedImage) return;
    const onScroll = () => updateImageTools();
    scroll.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(onScroll) : null;
    if (observer) observer.observe(selectedImage);
    return () => {
      scroll.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      observer?.disconnect();
    };
  }, [selectedImage, updateImageTools]);

  useEffect(() => {
    if (!selectedTable) return;
    const scroll = scrollRef.current;
    const sync = () => updateTableTools();
    scroll?.addEventListener('scroll', sync, { passive: true });
    window.addEventListener('resize', sync);
    requestAnimationFrame(sync);
    return () => {
      scroll?.removeEventListener('scroll', sync);
      window.removeEventListener('resize', sync);
    };
  }, [selectedTable, updateTableTools]);

  useEffect(() => {
    if (!selectedMath) return;
    const scroll = scrollRef.current;
    const sync = () => updateMathTools();
    scroll?.addEventListener('scroll', sync, { passive: true });
    window.addEventListener('resize', sync);
    requestAnimationFrame(sync);
    return () => {
      scroll?.removeEventListener('scroll', sync);
      window.removeEventListener('resize', sync);
    };
  }, [selectedMath, updateMathTools]);

  useEffect(() => {
    liveBodies().forEach((editor) => {
      editor.querySelectorAll('[data-studio-image-selected="1"]').forEach((node) => {
        node.removeAttribute('data-studio-image-selected');
      });
    });
    if (selectedImage) {
      selectedImage.setAttribute('data-studio-image-selected', '1');
    }
  }, [selectedImage, liveBodies, pages.length]);

  useEffect(() => {
    if (hasGhost || !contentEditable) setSelectedImage(null);
  }, [contentEditable, hasGhost]);

  useEffect(() => {
    if (hasGhost || !contentEditable) {
      setSelectedMath(null);
      setMathTools(null);
    }
  }, [contentEditable, hasGhost]);

  const commitImageMutation = useCallback(() => {
    const bodies = liveBodies();
    const body = selectedImage ? bodyContaining(selectedImage, bodies) : null;
    const idx = body ? bodies.indexOf(body) : activePage;
    scheduleRebalance(Math.max(0, idx));
    requestAnimationFrame(() => updateImageTools());
    onInput();
  }, [liveBodies, selectedImage, activePage, scheduleRebalance, updateImageTools, onInput]);

  const commitMathMutation = useCallback(() => {
    const bodies = liveBodies();
    const body = selectedMath ? bodyContaining(selectedMath, bodies) : null;
    const idx = body ? bodies.indexOf(body) : activePage;
    scheduleRebalance(Math.max(0, idx));
    requestAnimationFrame(() => updateMathTools());
    onInput();
  }, [liveBodies, selectedMath, activePage, scheduleRebalance, updateMathTools, onInput]);

  const changeMathWrap = useCallback(
    (mode: MathWrapMode) => {
      if (!selectedMath) return;
      const body = bodyContaining(selectedMath, bodyRefs.current);
      applyMathWrapMode(selectedMath, mode, body);
      commitMathMutation();
    },
    [commitMathMutation, selectedMath],
  );

  const changeMathScale = useCallback(
    (delta: number) => {
      if (!selectedMath) return;
      applyMathScale(selectedMath, getMathScale(selectedMath) + delta);
      commitMathMutation();
    },
    [commitMathMutation, selectedMath],
  );

  const updateImageWidth = useCallback(
    (nextWidth: number) => {
      const image = selectedImage;
      if (!image) return;
      const parentWidth = image.parentElement?.clientWidth || metrics.contentWidth || 1200;
      const maxWidth = Math.max(120, parentWidth);
      const width = Math.min(Math.max(Math.round(nextWidth || 0), 80), maxWidth);
      image.style.width = `${width}px`;
      image.style.height = 'auto';
      image.style.maxWidth = '100%';
      updateImageTools();
    },
    [selectedImage, metrics.contentWidth, updateImageTools],
  );

  const handleResizePointerDown = useCallback(
    (event: React.PointerEvent<HTMLButtonElement>, direction: ResizeSession['direction']) => {
      const image = selectedImage;
      if (!image) return;
      event.preventDefault();
      event.stopPropagation();
      const rect = image.getBoundingClientRect();
      const ratio =
        image.naturalWidth && image.naturalHeight
          ? image.naturalWidth / image.naturalHeight
          : rect.width / Math.max(rect.height, 1);
      resizeSession.current = {
        image,
        direction,
        startX: event.clientX,
        startWidth: rect.width,
        ratio: ratio || 1,
      };
      event.currentTarget.setPointerCapture?.(event.pointerId);
    },
    [selectedImage],
  );

  useEffect(() => {
    const onPointerMove = (event: PointerEvent) => {
      const session = resizeSession.current;
      if (!session) return;
      event.preventDefault();
      const sign = session.direction.endsWith('e') ? 1 : -1;
      const delta = (event.clientX - session.startX) * sign;
      const parentWidth = session.image.parentElement?.clientWidth || metrics.contentWidth || 1200;
      const width = Math.min(Math.max(session.startWidth + delta, 80), Math.max(120, parentWidth));
      session.image.style.width = `${Math.round(width)}px`;
      session.image.style.height = 'auto';
      session.image.style.maxWidth = '100%';
      updateImageTools();
    };
    const onPointerUp = () => {
      if (!resizeSession.current) return;
      resizeSession.current = null;
      commitImageMutation();
    };
    window.addEventListener('pointermove', onPointerMove, { passive: false });
    window.addEventListener('pointerup', onPointerUp);
    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
    };
  }, [commitImageMutation, updateImageTools, metrics.contentWidth]);

  const changeImageWrap = useCallback(
    (mode: ImageWrapMode) => {
      if (!selectedImage) return;
      const body = bodyContaining(selectedImage, bodyRefs.current);
      applyImageWrapMode(selectedImage, mode, body);
      commitImageMutation();
    },
    [commitImageMutation, selectedImage],
  );

  const removeSelectedImage = useCallback(() => {
    if (!selectedImage) return;
    selectedImage.remove();
    setSelectedImage(null);
    setImageTools(null);
    commitImageMutation();
  }, [commitImageMutation, selectedImage]);

  const mutateTable = useCallback(
    (action: 'add-row' | 'remove-row' | 'add-column' | 'remove-column' | 'toggle-header' | 'delete') => {
      const table = selectedTable;
      if (!table) return;
      const body = table.tBodies[0] || table.createTBody();
      const rows = Array.from(table.rows);
      const columnCount = rows[0]?.cells.length || 1;
      if (action === 'delete') {
        table.remove();
        setSelectedTable(null);
        setTableTools(null);
        onInput();
        return;
      } else if (action === 'toggle-header') {
        const first = rows[0];
        if (!first) return;
        Array.from(first.cells).forEach((cell) => {
          const replacement = document.createElement(cell.tagName.toLowerCase() === 'th' ? 'td' : 'th');
          replacement.className = replacement.tagName === 'TH' ? 'studio-th' : 'studio-td';
          replacement.innerHTML = cell.innerHTML || '<br>';
          cell.replaceWith(replacement);
        });
      } else if (action === 'add-row') {
        const row = body.insertRow(-1);
        for (let i = 0; i < columnCount; i++) {
          const cell = row.insertCell(-1);
          cell.className = 'studio-td';
          cell.innerHTML = '<br>';
        }
      } else if (action === 'remove-row') {
        // Always drop the last row and keep at least the header (or one
        // row if there is no header) — never leave an empty <tbody> or a
        // stray, unstyled row behind.
        if (rows.length > 1) {
          const last = rows[rows.length - 1];
          last.remove();
          // A <tbody> can become an empty, invisible wrapper once its last
          // row is gone; drop it so the exported/serialized table has no
          // leftover artifact.
          if (body.rows.length === 0 && body.parentNode) body.remove();
        }
      } else if (action === 'add-column') {
        rows.forEach((row, rowIndex) => {
          const cell = row.insertCell(-1);
          cell.className = rowIndex === 0 ? 'studio-th' : 'studio-td';
          cell.innerHTML = rowIndex === 0 ? `Col ${row.cells.length}` : '<br>';
        });
      } else if (action === 'remove-column' && columnCount > 1) {
        rows.forEach((row) => row.deleteCell(-1));
      } else {
        return;
      }
      updateTableTools();
      const idx = liveBodies().findIndex((b) => b.contains(table));
      scheduleRebalance(Math.max(0, idx));
      onInput();
    },
    [onInput, selectedTable, updateTableTools, liveBodies, scheduleRebalance],
  );

  const handlePageInput = (pageIdx: number) => {
    if (skipInput.current) return;
    rememberSelection();
    if (selectedImage && !liveBodies().some((b) => b.contains(selectedImage))) {
      setSelectedImage(null);
    }
    scheduleRebalance(pageIdx);
    onInput();
  };

  const handlePaste = (pageIdx: number, event: React.ClipboardEvent<HTMLDivElement>) => {
    const imageItem = Array.from(event.clipboardData.items).find((item) => item.type.startsWith('image/'));
    if (imageItem) {
      const file = imageItem.getAsFile();
      if (file) {
        event.preventDefault();
        void (async () => {
          const el = bodyRefs.current[pageIdx];
          if (!el || !allowImages || file.size > maxImageBytes) return;
          rememberSelection();
          const src = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result || ''));
            reader.onerror = () => reject(reader.error || new Error('Could not read image'));
            reader.readAsDataURL(file);
          });
          const image = insertImageAtSelection(el, src, 'Pasted image', lastSelection.current);
          applyImageWrapMode(image, 'break', el);
          setSelectedImage(image);
          scheduleRebalance(pageIdx);
          requestAnimationFrame(() => onInput());
        })().catch(() => {
          /* keep native paste */
        });
        return;
      }
    }
    requestAnimationFrame(() => {
      rememberSelection();
      scheduleRebalance(pageIdx);
      onInput();
    });
  };

  const handleKeyDown = (pageIdx: number, event: React.KeyboardEvent<HTMLDivElement>) => {
    const modifier = event.ctrlKey || event.metaKey;
    if (modifier && event.key.toLowerCase() === 'z') {
      event.preventDefault();
      event.stopPropagation();
      if (event.shiftKey) onRedo?.();
      else onUndo?.();
      return;
    }
    if (modifier && event.key.toLowerCase() === 'y') {
      event.preventDefault();
      event.stopPropagation();
      onRedo?.();
      return;
    }

    // Word-boundary keys close out the in-progress word as its own undo
    // step BEFORE they take effect, so Ctrl+Z undoes one word/line/paste at
    // a time (like Word/Docs) instead of an entire fast-typed sentence.
    if (
      !modifier &&
      (event.key === ' ' ||
        event.key === 'Enter' ||
        event.key === 'Tab' ||
        event.key === 'Backspace' ||
        event.key === 'Delete' ||
        /^[.,;:!?)\]"'’”]$/.test(event.key))
    ) {
      onHistoryBoundary?.();
    }

    // Backspace on empty last page → remove page (Word-like)
    if (event.key === 'Backspace' && pageIdx > 0) {
      const body = bodyRefs.current[pageIdx];
      if (body) {
        const text = (body.innerText || '').replace(/\u00a0/g, ' ').trim();
        const sel = window.getSelection();
        const atStart =
          sel &&
          sel.isCollapsed &&
          sel.anchorOffset === 0 &&
          (sel.anchorNode === body || (sel.anchorNode && body.contains(sel.anchorNode)));
        if (!text && atStart) {
          event.preventDefault();
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
          return;
        }
      }
    }
    rememberSelection();
  };

  const handleEditorPointerDown = useCallback(
    (pageIdx: number, event: React.PointerEvent<HTMLDivElement>) => {
      if (!contentEditable || hasGhost) return;
      const el = bodyRefs.current[pageIdx];
      if (!el) return;
      const target = event.target as HTMLElement;
      const image = target.closest('img') as HTMLImageElement | null;
      if (image && el.contains(image) && getImageWrapMode(image) === 'behind') {
        const editorRect = el.getBoundingClientRect();
        const imageRect = image.getBoundingClientRect();
        const scale = editorRect.width / Math.max(el.offsetWidth, 1);
        dragSession.current = {
          target: image,
          startX: event.clientX,
          startY: event.clientY,
          startLeft: (imageRect.left - editorRect.left) / Math.max(scale, 0.01),
          startTop: (imageRect.top - editorRect.top) / Math.max(scale, 0.01),
        };
        setSelectedImage(image);
        event.preventDefault();
        event.stopPropagation();
        return;
      }
      const mathHost =
        (target.closest('.studio-math-inline, .studio-math-block') as HTMLElement | null) ||
        (target.closest('mjx-container')?.closest('.studio-math-inline, .studio-math-block') as HTMLElement | null);
      if (mathHost && el.contains(mathHost) && getMathWrapMode(mathHost) === 'behind') {
        const editorRect = el.getBoundingClientRect();
        const hostRect = mathHost.getBoundingClientRect();
        const scale = editorRect.width / Math.max(el.offsetWidth, 1);
        dragSession.current = {
          target: mathHost,
          startX: event.clientX,
          startY: event.clientY,
          startLeft: (hostRect.left - editorRect.left) / Math.max(scale, 0.01),
          startTop: (hostRect.top - editorRect.top) / Math.max(scale, 0.01),
        };
        setSelectedMath(mathHost);
        event.preventDefault();
        event.stopPropagation();
      }
    },
    [contentEditable, hasGhost],
  );

  useEffect(() => {
    const onPointerMove = (event: PointerEvent) => {
      const session = dragSession.current;
      if (!session) return;
      const editor = bodyContaining(session.target, bodyRefs.current);
      if (!editor) return;
      event.preventDefault();
      const editorRect = editor.getBoundingClientRect();
      const scale = editorRect.width / Math.max(editor.offsetWidth, 1);
      session.target.style.left = `${Math.max(0, session.startLeft + (event.clientX - session.startX) / Math.max(scale, 0.01))}px`;
      session.target.style.top = `${Math.max(0, session.startTop + (event.clientY - session.startY) / Math.max(scale, 0.01))}px`;
      if (session.target instanceof HTMLImageElement) updateImageTools();
      else updateMathTools();
    };
    const onPointerUp = () => {
      const session = dragSession.current;
      if (!session) return;
      dragSession.current = null;
      if (session.target instanceof HTMLImageElement) commitImageMutation();
      else commitMathMutation();
    };
    window.addEventListener('pointermove', onPointerMove, { passive: false });
    window.addEventListener('pointerup', onPointerUp);
    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
    };
  }, [commitImageMutation, updateImageTools, updateMathTools]);

  const handleDrop = (pageIdx: number, event: React.DragEvent<HTMLDivElement>) => {
    const file = Array.from(event.dataTransfer.files).find((item) => item.type.startsWith('image/'));
    if (!file) return;
    event.preventDefault();
    rememberSelection();
    void (async () => {
      const el = bodyRefs.current[pageIdx];
      if (!el || !allowImages || file.size > maxImageBytes) return;
      const src = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = () => reject(reader.error || new Error('Could not read image'));
        reader.readAsDataURL(file);
      });
      const image = insertImageAtSelection(
        el,
        src,
        file.name.replace(/\.[^.]+$/, '') || 'Dropped image',
        lastSelection.current,
      );
      applyImageWrapMode(image, 'break', el);
      setSelectedImage(image);
      scheduleRebalance(pageIdx);
      requestAnimationFrame(() => onInput());
    })().catch(() => {
      /* ignore invalid drop */
    });
  };

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    if (Array.from(event.dataTransfer.items).some((item) => item.type.startsWith('image/'))) {
      event.preventDefault();
      event.dataTransfer.dropEffect = 'copy';
    }
  };

  const handleEditorMouseUp = (event: React.MouseEvent<HTMLDivElement>) => {
    rememberSelection();
    onMouseUp(event);
  };

  const handleEditorMouseDown = (pageIdx: number, e: React.MouseEvent) => {
    if (!contentEditable || hasGhost) return;
    const el = bodyRefs.current[pageIdx];
    if (!el) return;
    setActivePage(pageIdx);
    const t = e.target as HTMLElement;
    const image = t.closest('img') as HTMLImageElement | null;
    if (image && el.contains(image)) {
      e.preventDefault();
      e.stopPropagation();
      image.setAttribute('data-studio-image', '1');
      setSelectedImage(image);
      setSelectedMath(null);
      setMathTools(null);
      return;
    }
    const mathHost =
      (t.closest('.studio-math-inline, .studio-math-block') as HTMLElement | null) ||
      (t.closest('mjx-container') as HTMLElement | null);
    if (mathHost && el.contains(mathHost)) {
      const normalized =
        (mathHost.closest('.studio-math-inline, .studio-math-block') as HTMLElement | null) || mathHost;
      e.preventDefault();
      e.stopPropagation();
      setSelectedImage(null);
      setSelectedTable(null);
      setSelectedMath(normalized);
      requestAnimationFrame(updateMathTools);
      return;
    }
    if (selectedImage) setSelectedImage(null);
    const table = t.closest('table') as HTMLTableElement | null;
    if (table && el.contains(table)) {
      setSelectedTable(table);
      setSelectedMath(null);
      setMathTools(null);
      requestAnimationFrame(updateTableTools);
    } else {
      setSelectedTable(null);
      setSelectedMath(null);
      setMathTools(null);
    }
  };

  /** Click empty sheet chrome → focus that page and place caret */
  const onPageShellClick = (pageIdx: number, e: React.MouseEvent) => {
    if (!contentEditable || hasGhost) return;
    const t = e.target as HTMLElement;
    if (t.closest(BLOCK_SEL) || t.closest('img') || t.closest('table')) return;
    const body = bodyRefs.current[pageIdx];
    if (!body) return;
    // A drag-select that ends on the sheet's padding/margin (very common when
    // dragging edge-to-edge across a full-width line) fires a native click
    // right after mouseup on this same chrome. Without this guard we would
    // collapse the just-made selection into a caret here, which is exactly
    // why long/edge-to-edge selections disappear while short ones survive.
    const activeSel = window.getSelection();
    if (activeSel && !activeSel.isCollapsed && activeSel.toString().trim()) {
      setActivePage(pageIdx);
      return;
    }
    if (t === body || !body.contains(t) || t === e.currentTarget || t.classList.contains('studio-page-sheet')) {
      e.preventDefault();
      setActivePage(pageIdx);
      // Native editing already places the caret correctly when the click lands
      // on text. For sheet chrome/padding, resolve the nearest caret from the
      // actual pointer coordinates instead of always jumping to the document
      // end (which made blank-page clicks feel broken).
      const doc = body.ownerDocument;
      const range = doc.caretRangeFromPoint?.(e.clientX, e.clientY) ?? (() => {
        const position = doc.caretPositionFromPoint?.(e.clientX, e.clientY);
        if (!position) return null;
        const next = doc.createRange();
        next.setStart(position.offsetNode, position.offset);
        next.collapse(true);
        return next;
      })();
      if (range && body.contains(range.startContainer)) {
        body.focus({ preventScroll: true });
        const selection = window.getSelection();
        selection?.removeAllRanges();
        selection?.addRange(range);
        lastSelection.current = range.cloneRange();
      } else {
        placeCaretAtEnd(body);
      }
    }
  };

  const displayPages = hasGhost && ghostPages ? ghostPages : pages;
  const stackHeight = displayPages.length * spec.heightPx + Math.max(0, displayPages.length - 1) * PAGE_GAP;

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
              marginBottom: Math.max(0, stackHeight * (zoom - 1)),
            }}
          >
            {/* Real sheets: gap is empty space BETWEEN pages — text cannot occupy it */}
            <div className="flex flex-col" style={{ gap: PAGE_GAP }}>
              {displayPages.map((html, i) => (
                <div
                  key={`page-${i}`}
                  className="studio-page-sheet relative overflow-hidden rounded-[2px] border border-neutral-200/90 bg-white shadow-[0_12px_40px_rgba(0,0,0,0.06)]"
                  style={{
                    width: spec.widthPx,
                    height: spec.heightPx,
                    flexShrink: 0,
                  }}
                  onMouseDown={() => setActivePage(i)}
                  onClick={(e) => onPageShellClick(i, e)}
                >
                  {hasGhost ? (
                    <div
                      data-ghost-page-body
                      className="studio-doc-editor studio-diff-layer pointer-events-none h-full max-w-none overflow-hidden text-neutral-900"
                      style={{
                        boxSizing: 'border-box',
                        padding: margin,
                        fontFamily,
                        fontSize,
                        lineHeight: 1.65,
                        height: spec.heightPx,
                      }}
                      aria-hidden
                      dangerouslySetInnerHTML={{ __html: sanitizeDocumentHtml(html) }}
                    />
                  ) : (
                    <div
                      ref={(el) => {
                        bodyRefs.current[i] = el;
                      }}
                      data-page-body
                      data-page-index={i}
                      data-studio-editor={i === 0 ? '1' : undefined}
                      contentEditable={contentEditable}
                      suppressContentEditableWarning
                      onInput={() => handlePageInput(i)}
                      onPaste={(e) => handlePaste(i, e)}
                      onKeyDown={(e) => handleKeyDown(i, e)}
                      onPointerDown={(e) => handleEditorPointerDown(i, e)}
                      onMouseDown={(e) => handleEditorMouseDown(i, e)}
                      onMouseUp={handleEditorMouseUp}
                      onDragOver={handleDragOver}
                      onDrop={(e) => handleDrop(i, e)}
                      onDoubleClick={onDoubleClick}
                      className={cn(
                        'studio-doc-editor relative z-10 h-full max-w-none overflow-hidden text-neutral-900 outline-none',
                        'prose prose-neutral prose-p:my-2.5 prose-headings:mb-3 prose-headings:mt-5 prose-headings:font-inherit',
                        'prose-table:my-3 prose-img:my-3',
                        isLoading && 'opacity-60',
                      )}
                      style={{
                        boxSizing: 'border-box',
                        padding: margin,
                        fontFamily,
                        fontSize,
                        lineHeight: 1.65,
                        height: spec.heightPx,
                        overflow: 'hidden',
                        caretColor: '#171717',
                      }}
                    />
                  )}
                  <div
                    className="pointer-events-none absolute bottom-4 left-0 right-0 z-20 text-center font-mono text-[10px] tracking-wide text-neutral-300"
                    aria-hidden
                  >
                    {i + 1}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {selectedImage && imageTools && !hasGhost && contentEditable && (
          <>
            <div
              className="pointer-events-none absolute z-40"
              style={{
                top: imageTools.top,
                left: imageTools.left,
                width: imageTools.width,
                height: imageTools.height,
              }}
              aria-hidden
            >
              <div className="absolute inset-0 rounded-[2px] border-2 border-studio-brown/80 shadow-[0_0_0_1px_rgba(255,255,255,0.9)]" />
              {(['nw', 'ne', 'sw', 'se'] as const).map((direction) => (
                <button
                  key={direction}
                  type="button"
                  aria-label={`Redimensionar imagen ${direction}`}
                  className={cn(
                    'pointer-events-auto absolute h-3 w-3 rounded-[3px] border border-white bg-studio-brown shadow-[0_1px_4px_rgba(0,0,0,0.25)]',
                    direction === 'nw' && '-left-1.5 -top-1.5 cursor-nwse-resize',
                    direction === 'ne' && '-right-1.5 -top-1.5 cursor-nesw-resize',
                    direction === 'sw' && '-bottom-1.5 -left-1.5 cursor-nesw-resize',
                    direction === 'se' && '-bottom-1.5 -right-1.5 cursor-nwse-resize',
                  )}
                  onPointerDown={(event) => handleResizePointerDown(event, direction)}
                  onMouseDown={(event) => event.preventDefault()}
                />
              ))}
            </div>

            <div
              className="absolute z-50 flex max-w-[calc(100%-16px)] items-center gap-1 rounded-xl border border-neutral-200 bg-white/95 p-1.5 text-neutral-700 shadow-[0_10px_30px_rgba(0,0,0,0.14)] backdrop-blur"
              style={{
                top: Math.max(8, imageTools.top - 52),
                left: Math.max(
                  8,
                  Math.min(imageTools.left, Math.max(8, (scrollRef.current?.clientWidth || 360) - 350)),
                ),
              }}
              onMouseDown={(event) => {
                const target = event.target as HTMLElement;
                if (!target.closest('button, input, select')) event.preventDefault();
              }}
              onPointerDown={(event) => event.stopPropagation()}
              data-image-tools
            >
              <span className="flex items-center gap-1 border-r border-neutral-200 pr-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-neutral-400">
                <Maximize2 className="h-3.5 w-3.5" strokeWidth={1.8} />
                <span className="sr-only">Tamaño</span>
              </span>
              <button
                type="button"
                className="flex h-7 w-7 items-center justify-center rounded-lg hover:bg-neutral-100"
                title="Reducir ancho"
                onClick={() => updateImageWidth(imageTools.width - 40)}
              >
                <Minus className="h-3.5 w-3.5" strokeWidth={1.8} />
              </button>
              <input
                aria-label="Ancho de imagen en píxeles"
                type="number"
                min={80}
                max={1600}
                value={Math.round(imageTools.width)}
                onChange={(event) => updateImageWidth(Number(event.target.value))}
                onBlur={commitImageMutation}
                className="h-7 w-14 rounded-md border border-neutral-200 bg-neutral-50 px-1 text-center text-[11px] tabular-nums outline-none focus:border-studio-brown"
              />
              <button
                type="button"
                className="flex h-7 w-7 items-center justify-center rounded-lg hover:bg-neutral-100"
                title="Aumentar ancho"
                onClick={() => updateImageWidth(imageTools.width + 40)}
              >
                <Plus className="h-3.5 w-3.5" strokeWidth={1.8} />
              </button>
              <span className="mr-1 text-[10px] text-neutral-400">px</span>
              <span className="h-5 w-px bg-neutral-200" />
              <button
                type="button"
                title="Alinear a la izquierda"
                aria-label="Alinear a la izquierda"
                className="flex h-7 w-7 items-center justify-center rounded-lg hover:bg-neutral-100"
                onClick={() => changeImageWrap('left')}
              >
                <AlignLeft className="h-3.5 w-3.5" strokeWidth={1.8} />
              </button>
              <button
                type="button"
                title="Centrar imagen"
                aria-label="Centrar imagen"
                className="flex h-7 w-7 items-center justify-center rounded-lg hover:bg-neutral-100"
                onClick={() => changeImageWrap('center')}
              >
                <AlignCenter className="h-3.5 w-3.5" strokeWidth={1.8} />
              </button>
              <button
                type="button"
                title="Alinear a la derecha"
                aria-label="Alinear a la derecha"
                className="flex h-7 w-7 items-center justify-center rounded-lg hover:bg-neutral-100"
                onClick={() => changeImageWrap('right')}
              >
                <AlignRight className="h-3.5 w-3.5" strokeWidth={1.8} />
              </button>
              <span className="h-5 w-px bg-neutral-200" />
              <label className="flex items-center gap-1.5">
                <WrapText className="h-3.5 w-3.5 text-neutral-400" strokeWidth={1.8} />
                <select
                  aria-label="Modo de ajuste de texto"
                  value={getImageWrapMode(selectedImage)}
                  onChange={(event) => changeImageWrap(event.target.value as ImageWrapMode)}
                  className="h-7 max-w-[136px] rounded-md border border-neutral-200 bg-neutral-50 px-1.5 text-[11px] outline-none focus:border-studio-brown"
                >
                  {IMAGE_WRAP_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                title="Eliminar imagen"
                aria-label="Eliminar imagen"
                className="ml-1 flex h-7 w-7 items-center justify-center rounded-lg text-red-600 hover:bg-red-50"
                onClick={removeSelectedImage}
              >
                <Trash2 className="h-3.5 w-3.5" strokeWidth={1.8} />
              </button>
            </div>
          </>
        )}

        {selectedTable && tableTools && !hasGhost && contentEditable && (
          <div
            className="absolute z-50 flex items-center gap-1 rounded-lg border border-neutral-200 bg-white/95 px-1.5 py-1 text-[10px] text-neutral-600 shadow-[0_8px_24px_rgba(0,0,0,0.12)]"
            style={{
              top: tableTools.top,
              left: tableTools.left,
              minWidth: Math.min(280, Math.max(180, tableTools.width)),
            }}
            data-selection-ui
          >
            <span className="px-1 font-semibold text-neutral-500">Tabla</span>
            <span className="h-4 w-px bg-neutral-200" />
            <button
              type="button"
              className="rounded px-1.5 py-1 hover:bg-neutral-100"
              onClick={() => mutateTable('add-row')}
              title="Agregar fila"
            >
              + fila
            </button>
            <button
              type="button"
              className="rounded px-1.5 py-1 hover:bg-neutral-100"
              onClick={() => mutateTable('remove-row')}
              title="Quitar fila"
            >
              − fila
            </button>
            <button
              type="button"
              className="rounded px-1.5 py-1 hover:bg-neutral-100"
              onClick={() => mutateTable('add-column')}
              title="Agregar columna"
            >
              + col.
            </button>
            <button
              type="button"
              className="rounded px-1.5 py-1 hover:bg-neutral-100"
              onClick={() => mutateTable('remove-column')}
              title="Quitar columna"
            >
              − col.
            </button>
            <button
              type="button"
              className="rounded px-1.5 py-1 hover:bg-neutral-100"
              onClick={() => mutateTable('toggle-header')}
              title="Alternar fila de encabezado"
            >
              Encabezado
            </button>
            <button
              type="button"
              className="rounded px-1.5 py-1 text-red-700 hover:bg-red-50"
              onClick={() => mutateTable('delete')}
              title="Eliminar tabla"
            >
              Eliminar
            </button>
          </div>
        )}

        {selectedMath && mathTools && !hasGhost && contentEditable && (
          <div
            className="absolute z-50 flex items-center gap-1 rounded-lg border border-neutral-200 bg-white/95 px-1.5 py-1 text-[10px] text-neutral-700 shadow-[0_8px_24px_rgba(0,0,0,0.12)]"
            style={{ top: mathTools.top, left: mathTools.left, minWidth: 150 }}
            data-selection-ui
            onPointerDown={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              title="Hacer más pequeña"
              aria-label="Hacer más pequeña"
              className="rounded px-2 py-1 text-base leading-none hover:bg-neutral-100"
              onClick={() => changeMathScale(-10)}
            >
              −
            </button>
            <span className="min-w-9 px-1 text-center font-mono text-[9px] text-neutral-400">
              {getMathScale(selectedMath)}%
            </span>
            <button
              type="button"
              title="Hacer más grande"
              aria-label="Hacer más grande"
              className="rounded px-2 py-1 text-base leading-none hover:bg-neutral-100"
              onClick={() => changeMathScale(10)}
            >
              +
            </button>
            <span className="h-4 w-px bg-neutral-200" />
            <button
              type="button"
              title="En línea con el texto"
              aria-pressed={getMathWrapMode(selectedMath) === 'inline'}
              className={cn(
                'rounded px-2 py-1 hover:bg-neutral-100',
                getMathWrapMode(selectedMath) === 'inline' && 'bg-neutral-100 font-semibold',
              )}
              onClick={() => changeMathWrap('inline')}
            >
              En línea
            </button>
            <button
              type="button"
              title="Bloque: ocupa toda la línea"
              aria-pressed={getMathWrapMode(selectedMath) === 'block'}
              className={cn(
                'rounded px-2 py-1 hover:bg-neutral-100',
                getMathWrapMode(selectedMath) === 'block' && 'bg-neutral-100 font-semibold',
              )}
              onClick={() => changeMathWrap('block')}
            >
              Bloque
            </button>
            <button
              type="button"
              title="Libre: mover arrastrando"
              aria-pressed={getMathWrapMode(selectedMath) === 'behind'}
              className={cn(
                'rounded px-2 py-1 hover:bg-neutral-100',
                getMathWrapMode(selectedMath) === 'behind' && 'bg-neutral-100 font-semibold',
              )}
              onClick={() => changeMathWrap('behind')}
            >
              Mover
            </button>
            <span className="h-4 w-px bg-neutral-200" />
            <button
              type="button"
              className="rounded px-2 py-1 font-medium hover:bg-neutral-100"
              onClick={() => onEditMath?.(selectedMath)}
            >
              Editar
            </button>
            <button
              type="button"
              className="rounded px-2 py-1 text-red-700 hover:bg-red-50"
              onClick={() => {
                selectedMath.remove();
                setSelectedMath(null);
                setMathTools(null);
                scheduleRebalance(activePage);
                onInput();
              }}
            >
              Eliminar
            </button>
          </div>
        )}
      </div>
    </div>
  );
});

export default PaperCanvas;

export function readCleanEditorHtml(el: HTMLElement | null): string {
  if (!el) return '';
  return serializeEditorHtml(el) || el.innerHTML || '';
}
