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
import { insertImageAtSelection, sanitizeDocumentHtml, typesetEditor } from '@/lib/math-html';
import { buildCanvasDiffHtml } from '@/lib/canvas-diff';
import { placeCaretAtEnd } from '@/lib/page-layout';
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
  image: HTMLImageElement;
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

export type PaperCanvasHandle = {
  getHtml: () => string;
  setHtml: (html: string, opts?: { reveal?: boolean }) => void;
  getPageCount: () => number;
  focusEnd: () => void;
  getBodies: () => HTMLElement[];
  insertImage: (file: File) => Promise<boolean>;
};

type Props = {
  paperSize: PaperSize;
  onPaperSizeChange: (s: PaperSize) => void;
  fontFamily: string;
  fontSize: string;
  contentEditable: boolean;
  isLoading?: boolean;
  onInput: () => void;
  onUndo?: () => void;
  onRedo?: () => void;
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
    onUndo,
    onRedo,
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
  const lastSelection = useRef<Range | null>(null);
  const pageNotify = useRef(1);

  const rememberSelection = useCallback(() => {
    const el = editorRef.current;
    const sel = window.getSelection();
    if (!el || !sel || !sel.rangeCount || !sel.anchorNode || !el.contains(sel.anchorNode)) return;
    lastSelection.current = sel.getRangeAt(0).cloneRange();
  }, []);

  const [pageCount, setPageCount] = useState(1);
  const paperHeight = Math.max(spec.heightPx, pageCount * spec.heightPx);
  const [selectedImage, setSelectedImage] = useState<HTMLImageElement | null>(null);
  const [imageTools, setImageTools] = useState<ImageToolsRect | null>(null);
  const [selectedTable, setSelectedTable] = useState<HTMLTableElement | null>(null);
  const [tableTools, setTableTools] = useState<TableToolsRect | null>(null);
  const resizeSession = useRef<ResizeSession | null>(null);
  const dragSession = useRef<DragSession | null>(null);

  const updateTableTools = useCallback(() => {
    const table = selectedTable;
    const scroll = scrollRef.current;
    if (!table || !scroll || !editorRef.current?.contains(table)) {
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
  }, [selectedTable]);

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

  const mutateTable = useCallback(
    (action: 'add-row' | 'remove-row' | 'add-column' | 'remove-column') => {
      const table = selectedTable;
      if (!table) return;
      const body = table.tBodies[0] || table.createTBody();
      const rows = Array.from(table.rows);
      const columnCount = rows[0]?.cells.length || 1;
      if (action === 'add-row') {
        const row = body.insertRow(-1);
        for (let i = 0; i < columnCount; i++) {
          const cell = row.insertCell(-1);
          cell.className = 'studio-td';
          cell.innerHTML = '<br>';
        }
      } else if (action === 'remove-row' && rows.length > 2) {
        rows[rows.length - 1].remove();
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
      onInput();
    },
    [onInput, selectedTable, updateTableTools],
  );

  const hasGhost = Boolean(ghostHtml && ghostHtml.trim());

  /**
   * Filler paragraphs are editor chrome, not document content. Keep them out
   * of the serialized HTML and make them disposable so a page can disappear
   * after its content is deleted.
   */
  const padEditorToPage = useCallback(
    (el: HTMLElement, targetH: number) => {
      if (skipInput.current || hasGhost) return;
      el.querySelectorAll('[data-studio-pad="1"]').forEach((n) => n.remove());
      let guard = 0;
      while (el.scrollHeight < targetH - 8 && guard < 160) {
        const p = document.createElement('p');
        p.setAttribute('data-studio-pad', '1');
        p.innerHTML = '<br>';
        el.appendChild(p);
        guard++;
      }
    },
    [hasGhost],
  );

  const countContentPages = useCallback(
    (el: HTMLElement) => {
      const editorRect = el.getBoundingClientRect();
      const realChildren = Array.from(el.children).filter(
        (child) => (child as HTMLElement).getAttribute('data-studio-pad') !== '1',
      ) as HTMLElement[];
      const contentBottom = realChildren.reduce(
        (bottom, child) => Math.max(bottom, child.getBoundingClientRect().bottom),
        editorRect.top + margin + 40,
      );
      // Absolutely positioned images do not contribute to their paragraph's
      // flow height, but they still occupy a page in the visual document.
      const floatingImageBottom = Array.from(
        el.querySelectorAll<HTMLImageElement>('img[data-studio-wrap="behind"]'),
      ).reduce((bottom, image) => Math.max(bottom, image.getBoundingClientRect().bottom), contentBottom);
      const contentHeight = Math.max(1, floatingImageBottom - editorRect.top + 8);
      return Math.max(1, Math.ceil(contentHeight / spec.heightPx));
    },
    [margin, spec.heightPx],
  );

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
    const n = hasGhost
      ? Math.max(1, Math.ceil(Math.max(el.scrollHeight, el.offsetHeight, 1) / spec.heightPx))
      : countContentPages(el);
    setPageCount((prev) => (prev === n ? prev : n));
  }, [countContentPages, hasGhost, spec.heightPx]);

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
    // Clone and strip trailing empty pad paragraphs (Word blank-page filler)
    const clone = el.cloneNode(true) as HTMLElement;
    const kids = Array.from(clone.children);
    for (let i = kids.length - 1; i >= 0; i--) {
      const k = kids[i] as HTMLElement;
      if (k.getAttribute('data-studio-pad') === '1') {
        k.remove();
        continue;
      }
      // A real empty paragraph is user content and must survive so intentional
      // blank lines remain exportable.
      break;
    }
    if (!clone.children.length) return '<p><br></p>';
    return clone.innerHTML?.trim() || '<p><br></p>';
  }, []);

  const setHtml = useCallback(
    (html: string, opts?: { reveal?: boolean }) => {
      const clean = sanitizeDocumentHtml(html) || '<p><br></p>';
      lastExternalHtml.current = clean;
      setSelectedImage(null);
      setImageTools(null);
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

  const updateImageTools = useCallback(() => {
    const editor = editorRef.current;
    const scroll = scrollRef.current;
    const image = selectedImage;
    if (!editor || !scroll || !image || !editor.contains(image) || hasGhost) {
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
  }, [hasGhost, selectedImage]);

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
    const editor = editorRef.current;
    if (!editor) return;
    editor.querySelectorAll('[data-studio-image-selected="1"]').forEach((node) => {
      node.removeAttribute('data-studio-image-selected');
    });
    if (selectedImage && editor.contains(selectedImage)) {
      selectedImage.setAttribute('data-studio-image-selected', '1');
    }
  }, [selectedImage]);

  useEffect(() => {
    if (hasGhost || !contentEditable) setSelectedImage(null);
  }, [contentEditable, hasGhost]);

  const promoteRealContentBlocks = useCallback((el: HTMLElement) => {
    el.querySelectorAll('[data-studio-pad="1"]').forEach((node) => {
      const block = node as HTMLElement;
      const hasText = (block.textContent || '').replace(/\u00a0/g, ' ').trim();
      const hasEmbeddedContent = block.querySelector('img, table, svg, mjx-container, hr, video');
      if (hasText || hasEmbeddedContent) block.removeAttribute('data-studio-pad');
    });
  }, []);

  const syncPageGeometry = useCallback(
    (el: HTMLElement) => {
      if (skipInput.current || hasGhost) return;
      promoteRealContentBlocks(el);
      const pages = countContentPages(el);
      setPageCount((prev) => (prev === pages ? prev : pages));
      padEditorToPage(el, pages * spec.heightPx);
    },
    [countContentPages, hasGhost, padEditorToPage, promoteRealContentBlocks, spec.heightPx],
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
      insertImage: async (file: File) => {
        if (!file.type.startsWith('image/') || file.size > 12 * 1024 * 1024) return false;
        const el = editorRef.current;
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
        promoteRealContentBlocks(el);
        requestAnimationFrame(() => {
          promoteRealContentBlocks(el);
          measurePages();
          onInput();
        });
        return true;
      },
    }),
    [getHtml, setHtml, pageCount, measurePages, onInput, promoteRealContentBlocks],
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

  // Seed empty doc + pad blank page so click-below-content works (Word-like)
  useEffect(() => {
    const el = editorRef.current;
    if (!el) return;
    if (!el.innerHTML.trim()) {
      el.innerHTML = '<p><br></p>';
    }
    padEditorToPage(el, paperHeight);
  }, [paperHeight]);

  const commitImageMutation = useCallback(() => {
    const editor = editorRef.current;
    if (!editor) return;
    promoteRealContentBlocks(editor);
    const pages = countContentPages(editor);
    setPageCount((prev) => (prev === pages ? prev : pages));
    padEditorToPage(editor, pages * spec.heightPx);
    measurePages();
    requestAnimationFrame(() => updateImageTools());
    onInput();
  }, [countContentPages, measurePages, onInput, padEditorToPage, promoteRealContentBlocks, spec.heightPx, updateImageTools]);

  const updateImageWidth = useCallback(
    (nextWidth: number) => {
      const image = selectedImage;
      if (!image) return;
      const parentWidth = image.parentElement?.clientWidth || editorRef.current?.clientWidth || 1200;
      const maxWidth = Math.max(120, parentWidth);
      const width = Math.min(Math.max(Math.round(nextWidth || 0), 80), maxWidth);
      image.style.width = `${width}px`;
      image.style.height = 'auto';
      image.style.maxWidth = '100%';
      updateImageTools();
    },
    [selectedImage, updateImageTools],
  );

  const handleResizePointerDown = useCallback(
    (event: React.PointerEvent<HTMLButtonElement>, direction: ResizeSession['direction']) => {
      const image = selectedImage;
      if (!image) return;
      event.preventDefault();
      event.stopPropagation();
      const rect = image.getBoundingClientRect();
      const ratio = image.naturalWidth && image.naturalHeight
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
      const parentWidth = session.image.parentElement?.clientWidth || editorRef.current?.clientWidth || 1200;
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
  }, [commitImageMutation, updateImageTools]);

  const changeImageWrap = useCallback(
    (mode: ImageWrapMode) => {
      if (!selectedImage) return;
      applyImageWrapMode(selectedImage, mode, editorRef.current);
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

  const handleInput = () => {
    if (skipInput.current) return;
    const el = editorRef.current;
    if (el) {
      rememberSelection();
      if (selectedImage && !el.contains(selectedImage)) setSelectedImage(null);
      // User typed into a pad paragraph → promote to real content
      syncPageGeometry(el);
    }
    measurePages();
    onInput();
  };

  const handlePaste = (event: React.ClipboardEvent<HTMLDivElement>) => {
    const imageItem = Array.from(event.clipboardData.items).find((item) => item.type.startsWith('image/'));
    if (imageItem) {
      const file = imageItem.getAsFile();
      if (file) {
        event.preventDefault();
        void (async () => {
          const el = editorRef.current;
          if (!el) return;
          rememberSelection();
          if (file.size > 12 * 1024 * 1024) return;
          const src = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result || ''));
            reader.onerror = () => reject(reader.error || new Error('Could not read image'));
            reader.readAsDataURL(file);
          });
          const image = insertImageAtSelection(el, src, 'Pasted image', lastSelection.current);
          applyImageWrapMode(image, 'break', el);
          setSelectedImage(image);
          syncPageGeometry(el);
          requestAnimationFrame(() => {
            syncPageGeometry(el);
            measurePages();
            onInput();
          });
        })().catch(() => {
          /* Keep native paste available when an image cannot be decoded. */
        });
        return;
      }
    }

    requestAnimationFrame(() => {
      const el = editorRef.current;
      if (el) {
        rememberSelection();
        syncPageGeometry(el);
        measurePages();
      }
      onInput();
    });
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
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
    if (event.key === 'Enter') {
      const sel = window.getSelection();
      const anchor = sel?.anchorNode instanceof Element ? sel.anchorNode : sel?.anchorNode?.parentElement;
      const pad = anchor?.closest('[data-studio-pad="1"]');
      // A filler paragraph becomes real content as soon as the user creates a line
      // inside it. This is what preserves intentional blank lines.
      if (pad) pad.removeAttribute('data-studio-pad');
    }
    rememberSelection();
  };

  const handleEditorPointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!contentEditable || hasGhost) return;
      const el = editorRef.current;
      const target = event.target as HTMLElement;
      const image = target.closest('img') as HTMLImageElement | null;
      if (!el || !image || !el.contains(image) || getImageWrapMode(image) !== 'behind') return;

      const editorRect = el.getBoundingClientRect();
      const imageRect = image.getBoundingClientRect();
      const scale = editorRect.width / Math.max(el.offsetWidth, 1);
      dragSession.current = {
        image,
        startX: event.clientX,
        startY: event.clientY,
        startLeft: (imageRect.left - editorRect.left) / Math.max(scale, 0.01),
        startTop: (imageRect.top - editorRect.top) / Math.max(scale, 0.01),
      };
      setSelectedImage(image);
      event.preventDefault();
      event.stopPropagation();
    },
    [contentEditable, hasGhost],
  );

  useEffect(() => {
    const onPointerMove = (event: PointerEvent) => {
      const session = dragSession.current;
      if (!session) return;
      const editor = editorRef.current;
      if (!editor) return;
      event.preventDefault();
      const editorRect = editor.getBoundingClientRect();
      const scale = editorRect.width / Math.max(editor.offsetWidth, 1);
      session.image.style.left = `${Math.max(0, session.startLeft + (event.clientX - session.startX) / Math.max(scale, 0.01))}px`;
      session.image.style.top = `${Math.max(0, session.startTop + (event.clientY - session.startY) / Math.max(scale, 0.01))}px`;
      updateImageTools();
    };
    const onPointerUp = () => {
      if (!dragSession.current) return;
      dragSession.current = null;
      commitImageMutation();
    };
    window.addEventListener('pointermove', onPointerMove, { passive: false });
    window.addEventListener('pointerup', onPointerUp);
    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
    };
  }, [commitImageMutation, updateImageTools]);

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    const file = Array.from(event.dataTransfer.files).find((item) => item.type.startsWith('image/'));
    if (!file) return;
    event.preventDefault();
    rememberSelection();
    void (async () => {
      const el = editorRef.current;
      if (!el || file.size > 12 * 1024 * 1024) return;
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
      syncPageGeometry(el);
      requestAnimationFrame(() => {
        syncPageGeometry(el);
        measurePages();
        onInput();
      });
    })().catch(() => {
      /* Ignore an invalid dropped file without breaking the editor. */
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

  /**
   * Word-like: click empty area of the page places caret there without flicker.
   * Uses caretRangeFromPoint; if click is below content, pad then place.
   */
  const handleEditorMouseDown = (e: React.MouseEvent) => {
    if (!contentEditable || hasGhost) return;
    const el = editorRef.current;
    if (!el) return;
    const t = e.target as HTMLElement;
    const image = t.closest('img') as HTMLImageElement | null;
    if (image && el.contains(image)) {
      e.preventDefault();
      e.stopPropagation();
      image.setAttribute('data-studio-image', '1');
      setSelectedImage(image);
      return;
    }
    if (selectedImage) setSelectedImage(null);
    const table = t.closest('table') as HTMLTableElement | null;
    if (table && el.contains(table)) {
      setSelectedTable(table);
      requestAnimationFrame(updateTableTools);
    } else {
      setSelectedTable(null);
    }
    // Native placement inside real text blocks is fine
    if (t.closest(BLOCK_SEL) && t.closest(BLOCK_SEL) !== el) {
      const block = t.closest(BLOCK_SEL) as HTMLElement;
      if (block.getAttribute('data-studio-pad') !== '1') return;
    }

    const y = e.clientY;
    const x = e.clientX;

    // Convert the click to document coordinates. This lets a click in the
    // lower half of a sheet create a caret at that line instead of snapping
    // to the last real paragraph.
    const editorRect = el.getBoundingClientRect();
    const scale = editorRect.width / Math.max(el.offsetWidth, 1);
    const localY = Math.max(0, (y - editorRect.top) / Math.max(scale, 0.01));
    const requestedPages = Math.max(1, Math.ceil((localY + margin + 32) / spec.heightPx));
    const targetPages = Math.max(pageCount, requestedPages);
    setPageCount((prev) => Math.max(prev, targetPages));
    padEditorToPage(el, targetPages * spec.heightPx);
    const last = el.lastElementChild as HTMLElement | null;
    if (last) {
      const lr = last.getBoundingClientRect();
      if (y > lr.bottom - 4) {
        // Still short of click — add a few more pads
        for (let i = 0; i < 6; i++) {
          const p = document.createElement('p');
          p.setAttribute('data-studio-pad', '1');
          p.innerHTML = '<br>';
          el.appendChild(p);
          if (p.getBoundingClientRect().bottom >= y) break;
        }
      }
    }

    // Place caret at click point (no jump-to-top)
    try {
      const doc = document as Document & {
        caretRangeFromPoint?: (x: number, y: number) => Range | null;
        caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null;
      };
      let range: Range | null = null;
      if (doc.caretRangeFromPoint) {
        range = doc.caretRangeFromPoint(x, y);
      } else if (doc.caretPositionFromPoint) {
        const pos = doc.caretPositionFromPoint(x, y);
        if (pos) {
          range = document.createRange();
          range.setStart(pos.offsetNode, pos.offset);
          range.collapse(true);
        }
      }
      if (range && el.contains(range.startContainer)) {
        e.preventDefault();
        el.focus({ preventScroll: true });
        const sel = window.getSelection();
        sel?.removeAllRanges();
        sel?.addRange(range);
      }
    } catch {
      /* native fallback */
    }
  };

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
                onKeyDown={handleKeyDown}
                onPointerDown={handleEditorPointerDown}
                onMouseDown={handleEditorMouseDown}
                onMouseUp={handleEditorMouseUp}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                onDoubleClick={onDoubleClick}
                className={cn(
                  'studio-doc-editor relative z-10 max-w-none text-neutral-900 outline-none',
                  'prose prose-neutral prose-p:my-2.5 prose-headings:mb-3 prose-headings:mt-5 prose-headings:font-inherit',
                  'prose-table:my-3 prose-img:my-3',
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
                  // caret doesn't jump weirdly in empty zones
                  caretColor: '#171717',
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
                left: Math.max(8, Math.min(imageTools.left, Math.max(8, scrollRef.current?.clientWidth || 360) - 350)),
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
            style={{ top: tableTools.top, left: tableTools.left, minWidth: Math.min(280, Math.max(180, tableTools.width)) }}
            data-selection-ui
          >
            <span className="px-1 font-semibold text-neutral-500">Tabla</span>
            <span className="h-4 w-px bg-neutral-200" />
            <button type="button" className="rounded px-1.5 py-1 hover:bg-neutral-100" onClick={() => mutateTable('add-row')} title="Agregar fila">
              + fila
            </button>
            <button type="button" className="rounded px-1.5 py-1 hover:bg-neutral-100" onClick={() => mutateTable('remove-row')} title="Quitar fila">
              − fila
            </button>
            <button type="button" className="rounded px-1.5 py-1 hover:bg-neutral-100" onClick={() => mutateTable('add-column')} title="Agregar columna">
              + col.
            </button>
            <button type="button" className="rounded px-1.5 py-1 hover:bg-neutral-100" onClick={() => mutateTable('remove-column')} title="Quitar columna">
              − col.
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
  return el.innerHTML || '';
}
