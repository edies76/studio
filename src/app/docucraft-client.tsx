'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import DocumentEditorToolbar from '@/components/document-editor-toolbar';
import PaperCanvas, { type PaperCanvasHandle } from '@/components/paper-canvas';
import StudioChat, {
  type ActivityStep,
  type ChatMessage,
  type PendingEdit,
} from '@/components/studio-chat';
import ToolsDock, { type OrbitAction } from '@/components/tools-dock';
import type { ChatEvent } from '@/components/chat-event-card';
import { useToast } from '@/hooks/use-toast';
import { Download, FileText, History } from 'lucide-react';
import FloatingComposer from '@/components/floating-composer';
import SelectionFormatBar from '@/components/selection-format-bar';
import ZoomControl from '@/components/zoom-control';
import { cn } from '@/lib/utils';
import { DEFAULT_STUDIO_MODEL } from '@/lib/studio-models';
import { extractHtmlBlocks } from '@/lib/doc-tools';
import type { PaperSize, ProposeEditPayload } from '@/lib/doc-tools';
import {
  sanitizeDocumentHtml,
  typesetEditor,
  insertMathAtSelection,
  insertTableAtSelection,
  replaceMathNode,
  getMathSource,
  htmlForWordExport,
} from '@/lib/math-html';
import { importDocxToHtml } from '@/lib/import-docx';
import { normsAgentPrompt } from '@/lib/style-norms';
import StudioSettings, { DEFAULT_PREFS, type StudioPrefs } from '@/components/studio-settings';
import HistoryDrawer, { type HistoryItem } from '@/components/history-drawer';
import jsPDF from 'jspdf';

const BLOCK_QUERY = 'p, h1, h2, h3, h4, h5, h6, li, blockquote, pre, table, ul, ol';

const DEFAULT_FONT = 'Inter, Segoe UI, system-ui, sans-serif';
const EMPTY_DOCUMENT_HTML = '<p><br></p>';

function uid() {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function isDocEmpty(html: string) {
  const t = html.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim();
  return t.length < 8;
}

function plainTextFromHtml(html: string): string {
  if (!html) return '';
  const node = document.createElement('div');
  node.innerHTML = html;
  return (node.textContent || '').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
}

/** Only draft a full document when the user clearly asks for one — not "hola". */
function wantsFullDocument(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  if (/^(hola|hello|hi|hey|buenas|buen[oa]s|qué tal|que tal|gracias|ok|vale|hey+)[\s!?.]*$/i.test(t)) {
    return false;
  }
  if (t.length < 10) return false;
  return /doc(umento)?|ensayo|informe|redact|escrib[ií]|gener[ae]|crea(r|me)?|paper|taller|revoluci|sobre\s+\w{4,}|estructura|apa|capítulo|articulo|artículo/i.test(
    t,
  ) || t.length > 48;
}

export default function DocsStudioClient({
  topic,
  documentId: initialDocumentId = null,
}: {
  topic: string;
  documentId?: string | null;
}) {
  const { toast } = useToast();

  const [documentTitle, setDocumentTitle] = useState('Untitled');
  const [documentContent, setDocumentContent] = useState('');
  const [docId, setDocId] = useState<string | null>(initialDocumentId);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [isClient, setIsClient] = useState(false);
  const serverLoaded = useRef(false);
  const lastSavedHtml = useRef('');
  const lastSavedTitle = useRef('');
  const lastSavedChatLen = useRef(0);
  const [isBusy, setIsBusy] = useState(false);
  const [paperSize, setPaperSize] = useState<PaperSize>('letter');
  const [fontFamily, setFontFamily] = useState(DEFAULT_FONT);
  const [fontSize, setFontSize] = useState('12px');
  const [pageCount, setPageCount] = useState(1);
  const [zoom, setZoom] = useState(1);
  const [model] = useState(DEFAULT_STUDIO_MODEL);
  const [prefs, setPrefs] = useState<StudioPrefs>(DEFAULT_PREFS);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [changeLog, setChangeLog] = useState<HistoryItem[]>([]);

  const [history, setHistory] = useState<string[]>([EMPTY_DOCUMENT_HTML]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const historyRef = useRef<string[]>([EMPTY_DOCUMENT_HTML]);
  const historyIndexRef = useRef(0);
  const [draftReady, setDraftReady] = useState(false);
  const restoredDraft = useRef(false);

  const [hasSelection, setHasSelection] = useState(false);
  const [selBar, setSelBar] = useState<{ top: number; left: number } | null>(null);
  /** Ephemeral agent input — not always on canvas */
  const [agentOpen, setAgentOpen] = useState(false);
  const [agentMode, setAgentMode] = useState<'chat' | 'edit'>('chat');
  const selectionRef = useRef<Range | null>(null);
  const selectedTextRef = useRef('');
  const abortRef = useRef<AbortController | null>(null);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [activity, setActivity] = useState<ActivityStep[]>([]);
  const [pendingEdits, setPendingEdits] = useState<PendingEdit[]>([]);
  const [activeEditId, setActiveEditId] = useState<string | null>(null);
  const [chatWidth, setChatWidth] = useState(360);
  /** Default: panel collapsed — floating composer on canvas */
  const [chatCollapsed, setChatCollapsed] = useState(true);
  const resizingChat = useRef(false);
  const canvasRef = useRef<PaperCanvasHandle>(null);
  const paperHostRef = useRef<HTMLDivElement>(null);
  const importInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const didAuto = useRef(false);
  const skipHistory = useRef(false);
  const localEditTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastLocalNotify = useRef(0);

  /** Active page body under caret / selection, else last page */
  const getActiveBody = useCallback((): HTMLElement | null => {
    const bodies = canvasRef.current?.getBodies() || [];
    if (!bodies.length) return null;
    const ae = document.activeElement as HTMLElement | null;
    if (ae) {
      for (const b of bodies) {
        if (b === ae || b.contains(ae)) return b;
      }
    }
    const sel = window.getSelection();
    if (sel?.anchorNode) {
      for (const b of bodies) {
        if (b.contains(sel.anchorNode)) return b;
      }
    }
    return bodies[bodies.length - 1] || null;
  }, []);

  const typesetAll = useCallback(() => {
    const bodies = canvasRef.current?.getBodies() || [];
    if (!bodies.length) return;
    bodies.forEach((b) => typesetEditor(b));
  }, []);

  const queryAllBlocks = useCallback((): HTMLElement[] => {
    const out: HTMLElement[] = [];
    for (const b of canvasRef.current?.getBodies() || []) {
      b.querySelectorAll(BLOCK_QUERY).forEach((el) => out.push(el as HTMLElement));
    }
    return out;
  }, []);

  const selectionInCanvas = useCallback((node: Node | null) => {
    if (!node) return false;
    return (canvasRef.current?.getBodies() || []).some((b) => b === node || b.contains(node));
  }, []);

  useEffect(() => setIsClient(true), []);

  // Resize chat panel (drag) — collapse below threshold
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!resizingChat.current) return;
      const w = window.innerWidth - e.clientX;
      if (w < 220) {
        setChatCollapsed(true);
        setChatWidth(360);
        return;
      }
      setChatCollapsed(false);
      setChatWidth(Math.min(560, Math.max(280, w)));
    };
    const onUp = () => {
      resizingChat.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, []);

  useEffect(() => {
    // Only load brief if explicitly marked active (landing `/` with guide)
    try {
      if (sessionStorage.getItem('studioBriefActive') !== '1') {
        sessionStorage.removeItem('studioAssignment');
        sessionStorage.removeItem('studioBriefRaw');
        return;
      }
      const raw = sessionStorage.getItem('studioAssignment');
      if (raw) {
        const a = JSON.parse(raw);
        if (a?.title) setDocumentTitle(a.title);
      }
    } catch {
      /* ignore */
    }
  }, []);

  /** Only crucial events go to history drawer — not spam in chat */
  const pushEvent = useCallback((event: ChatEvent, crucial = false) => {
    if (!crucial && (event.type === 'local_edit' || event.type === 'ai_change')) {
      // drop noisy local keystrokes entirely; only AI apply/draft/reject matter
      if (event.type === 'local_edit' && !/export|fórmula|tabla|aplicado|rechaz/i.test(event.title)) {
        return;
      }
    }
    const item: HistoryItem = { id: uid(), at: Date.now(), event };
    setChangeLog((prev) => [...prev.slice(-80), item]);
  }, []);

  const openAgent = useCallback((mode: 'chat' | 'edit' = 'chat') => {
    if (prefs.agentVisibility === 'hidden') {
      setChatCollapsed(false);
      setChatWidth((w) => Math.max(w, 360));
      return;
    }
    setAgentMode(mode);
    setAgentOpen(true);
  }, [prefs.agentVisibility]);

  const closeAgent = useCallback(() => {
    if (prefs.agentVisibility === 'always') return;
    if (isBusy) return;
    if (pendingEdits.some((e) => e.status === 'pending')) return;
    setAgentOpen(false);
    setAgentMode('chat');
  }, [prefs.agentVisibility, isBusy, pendingEdits]);

  // agentVisibility: always → keep open
  useEffect(() => {
    if (prefs.agentVisibility === 'always') setAgentOpen(true);
    if (prefs.agentVisibility === 'hidden') setAgentOpen(false);
  }, [prefs.agentVisibility]);

  // Keep agent open while busy or reviewing
  useEffect(() => {
    if (isBusy || pendingEdits.some((e) => e.status === 'pending')) {
      if (prefs.agentVisibility !== 'hidden') setAgentOpen(true);
    }
  }, [isBusy, pendingEdits, prefs.agentVisibility]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      // Capture phase so contentEditable / browser zoom don't steal Ctrl+ / Ctrl-
      const zoomIn =
        e.key === '+' ||
        e.key === '=' ||
        e.code === 'Equal' ||
        e.code === 'NumpadAdd';
      const zoomOut = e.key === '-' || e.key === '_' || e.code === 'Minus' || e.code === 'NumpadSubtract';
      const zoomReset = e.key === '0' || e.code === 'Digit0' || e.code === 'Numpad0';
      if (zoomIn) {
        e.preventDefault();
        e.stopPropagation();
        setZoom((z) => Math.min(2, Math.round((z + 0.1) * 20) / 20));
        return;
      }
      if (zoomOut) {
        e.preventDefault();
        e.stopPropagation();
        setZoom((z) => Math.max(0.5, Math.round((z - 0.1) * 20) / 20));
        return;
      }
      if (zoomReset) {
        e.preventDefault();
        e.stopPropagation();
        setZoom(1);
        return;
      }

      const key = e.key.toLowerCase();
      const openKey = (prefs.shortcutOpenAgent || 'i').toLowerCase();
      const editKey = (prefs.shortcutEditSelection || 'e').toLowerCase();

      if (key === openKey) {
        e.preventDefault();
        e.stopPropagation();
        openAgent(hasSelection ? 'edit' : 'chat');
        return;
      }
      if (key === editKey) {
        e.preventDefault();
        e.stopPropagation();
        // Prefer selection-edit when there is a selection
        if (selectedTextRef.current.trim() || hasSelection) {
          openAgent('edit');
        } else {
          openAgent('chat');
        }
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [prefs.shortcutOpenAgent, prefs.shortcutEditSelection, openAgent, hasSelection]);

  const pushHistory = useCallback((html: string) => {
    const normalized = sanitizeDocumentHtml(html) || EMPTY_DOCUMENT_HTML;
    const current = historyRef.current[historyIndexRef.current] ?? EMPTY_DOCUMENT_HTML;
    if (current === normalized) return;
    const next = historyRef.current.slice(0, historyIndexRef.current + 1);
    next.push(normalized);
    if (next.length > 80) next.shift();
    historyRef.current = next;
    historyIndexRef.current = next.length - 1;
    setHistory(next);
    setHistoryIndex(historyIndexRef.current);
  }, []);

  const applyHtml = useCallback(
    (
      html: string,
      recordHistory = true,
      mode: false | 'cascade' | 'firstReveal' = false,
    ) => {
      const clean = sanitizeDocumentHtml(html) || EMPTY_DOCUMENT_HTML;
      const withoutBreaks = clean.replace(
        /<div[^>]*data-studio-break="1"[^>]*>[\s\S]*?<\/div>/gi,
        '',
      );
      setDocumentContent(withoutBreaks);
      skipHistory.current = true;
      canvasRef.current?.setHtml(withoutBreaks, { reveal: mode === 'firstReveal' });
      requestAnimationFrame(() => {
        if (mode === 'cascade') {
          const first = canvasRef.current?.getBodies()?.[0];
          if (first) {
            Array.from(first.children).forEach((child, i) => {
              const el = child as HTMLElement;
              el.classList.add('studio-cascade-item');
              el.style.animationDelay = `${Math.min(i * 48, 900)}ms`;
              window.setTimeout(() => {
                el.classList.remove('studio-cascade-item');
                el.style.animationDelay = '';
              }, Math.min(i * 48, 900) + 420);
            });
          }
        }
        typesetAll();
        skipHistory.current = false;
      });
      if (recordHistory) pushHistory(withoutBreaks);
    },
    [pushHistory, typesetAll],
  );

  /** Full document HTML from canvas, or plain text from Word engine for AI context */
  const readEditorHtml = useCallback(() => {
    return canvasRef.current?.getHtml() || documentContent;
  }, [documentContent]);

  const draftKey = `docs-studio:draft:${(topic.trim() || 'blank')
    .toLowerCase()
    .replace(/[^a-z0-9áéíóúüñ]+/gi, '-')
    .slice(0, 120)}`;

  useEffect(() => {
    if (!isClient || draftReady) return;
    try {
      const raw = localStorage.getItem(draftKey);
      if (raw) {
        const saved = JSON.parse(raw) as {
          html?: string;
          title?: string;
          paperSize?: PaperSize;
          fontFamily?: string;
          fontSize?: string;
        };
        if (saved.html && !isDocEmpty(saved.html)) {
          restoredDraft.current = true;
          if (saved.title) setDocumentTitle(saved.title);
          if (saved.paperSize === 'letter' || saved.paperSize === 'legal') setPaperSize(saved.paperSize);
          if (saved.fontFamily) setFontFamily(saved.fontFamily);
          if (saved.fontSize) setFontSize(saved.fontSize);
          historyRef.current = [sanitizeDocumentHtml(saved.html) || EMPTY_DOCUMENT_HTML];
          historyIndexRef.current = 0;
          setHistory(historyRef.current);
          setHistoryIndex(0);
          applyHtml(saved.html, false);
        }
      }
    } catch {
      /* A corrupt local draft should never prevent opening the editor. */
    } finally {
      setDraftReady(true);
    }
  }, [applyHtml, draftKey, draftReady, isClient]);

  useEffect(() => {
    if (!draftReady) return;
    const timer = window.setTimeout(() => {
      try {
        localStorage.setItem(
          draftKey,
          JSON.stringify({
            version: 1,
            html: documentContent || readEditorHtml(),
            title: documentTitle,
            paperSize,
            fontFamily,
            fontSize,
            docId,
            savedAt: new Date().toISOString(),
          }),
        );
      } catch {
        /* Storage can be unavailable in private browsing; editing still works. */
      }
    }, 350);
    return () => window.clearTimeout(timer);
  }, [draftKey, draftReady, documentContent, documentTitle, fontFamily, fontSize, paperSize, readEditorHtml, docId]);

  // Load cloud/local server document when ?doc=id
  useEffect(() => {
    if (!isClient || !initialDocumentId || serverLoaded.current) return;
    serverLoaded.current = true;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/docs/${initialDocumentId}`);
        if (res.status === 401) return;
        if (!res.ok) {
          toast({ variant: 'destructive', title: 'Documento no encontrado' });
          return;
        }
        const data = await res.json();
        if (cancelled || !data.doc) return;
        setDocId(data.doc.id);
        setDocumentTitle(data.doc.title || 'Untitled');
        setDocumentContent(data.doc.html || EMPTY_DOCUMENT_HTML);
        lastSavedHtml.current = data.doc.html || '';
        lastSavedTitle.current = data.doc.title || '';
        applyHtml(data.doc.html || EMPTY_DOCUMENT_HTML, false);
        if (Array.isArray(data.doc.chat) && data.doc.chat.length) {
          setMessages(
            data.doc.chat.map((t: { id: string; role: string; content: string }) => ({
              id: t.id,
              role: t.role as 'user' | 'assistant',
              content: t.content,
              streaming: false,
            })),
          );
          lastSavedChatLen.current = data.doc.chat.length;
        }
        restoredDraft.current = true;
        setDraftReady(true);
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [applyHtml, initialDocumentId, isClient, toast]);

  // Ensure we have a server document id (create if opening blank / topic)
  useEffect(() => {
    if (!isClient || !draftReady) return;
    if (initialDocumentId) return; // load path owns this
    if (docId) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/docs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: documentTitle || 'Untitled',
            html: documentContent || EMPTY_DOCUMENT_HTML,
          }),
        });
        if (!res.ok || cancelled) return;
        const data = await res.json();
        if (data.doc?.id) {
          setDocId(data.doc.id);
          lastSavedHtml.current = data.doc.html || documentContent || '';
          lastSavedTitle.current = data.doc.title || documentTitle || '';
          const url = new URL(window.location.href);
          url.searchParams.set('doc', data.doc.id);
          window.history.replaceState({}, '', url.toString());
        }
      } catch {
        /* local guest still works */
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isClient, draftReady, initialDocumentId, docId]);

  // Server autosave every ~4s when dirty
  useEffect(() => {
    if (!docId || !draftReady) return;
    const tick = async () => {
      const html = documentContent || readEditorHtml();
      const title = documentTitle || 'Untitled';
      if (html === lastSavedHtml.current && title === lastSavedTitle.current) return;
      setSaveState('saving');
      try {
        const res = await fetch(`/api/docs/${docId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ html, title }),
        });
        if (!res.ok) throw new Error('save failed');
        lastSavedHtml.current = html;
        lastSavedTitle.current = title;
        setSaveState('saved');
      } catch {
        setSaveState('error');
      }
    };
    const id = window.setInterval(() => void tick(), 4000);
    return () => clearInterval(id);
  }, [docId, draftReady, documentContent, documentTitle, readEditorHtml]);

  // Persist new chat turns to server
  useEffect(() => {
    if (!docId || messages.length <= lastSavedChatLen.current) return;
    const fresh = messages.slice(lastSavedChatLen.current).filter((m) => !m.streaming);
    if (!fresh.length) return;
    const turns = fresh.map((m) => ({
      id: m.id,
      role: m.role,
      content: m.content,
      at: Date.now(),
    }));
    void fetch(`/api/docs/${docId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chatTurns: turns }),
    }).then((res) => {
      if (res.ok) lastSavedChatLen.current = messages.filter((m) => !m.streaming).length;
    });
  }, [docId, messages]);

  const flushPendingHistory = useCallback(() => {
    if (localEditTimer.current) {
      clearTimeout(localEditTimer.current);
      localEditTimer.current = null;
    }
    const current = readEditorHtml();
    if (current !== (historyRef.current[historyIndexRef.current] ?? EMPTY_DOCUMENT_HTML)) pushHistory(current);
  }, [pushHistory, readEditorHtml]);

  const undo = useCallback(() => {
    flushPendingHistory();
    const currentIndex = historyIndexRef.current;
    if (currentIndex <= 0) return;
    const nextIndex = currentIndex - 1;
    historyIndexRef.current = nextIndex;
    setHistoryIndex(nextIndex);
    applyHtml(historyRef.current[nextIndex] || '', false);
    canvasRef.current?.focusEnd();
    pushEvent({
      type: 'local_edit',
      title: 'Deshiciste un cambio',
      summary: 'Se restauró una versión anterior del documento.',
    });
  }, [applyHtml, flushPendingHistory, pushEvent]);

  const redo = useCallback(() => {
    flushPendingHistory();
    const currentIndex = historyIndexRef.current;
    if (currentIndex >= historyRef.current.length - 1) return;
    const nextIndex = currentIndex + 1;
    historyIndexRef.current = nextIndex;
    setHistoryIndex(nextIndex);
    applyHtml(historyRef.current[nextIndex] || '', false);
    canvasRef.current?.focusEnd();
  }, [applyHtml, flushPendingHistory]);

  const setActivityLabel = (label: string, state: ActivityStep['state'] = 'active') => {
    if (state === 'done' || /^done$/i.test(label.trim())) {
      // Hide thinking animation — clear active steps
      setActivity((prev) => prev.map((s) => ({ ...s, state: 'done' as const })));
      return;
    }
    setActivity((prev) => {
      const done = prev.map((s) => (s.state === 'active' ? { ...s, state: 'done' as const } : s));
      return [...done.slice(-12), { id: uid(), label, state }];
    });
  };

  const pushToolLog = (
    assistantId: string,
    item: { id: string; label: string; state: 'running' | 'done' | 'error'; doneLabel?: string },
  ) => {
    setMessages((ms) =>
      ms.map((m) => {
        if (m.id !== assistantId) return m;
        const logs = [...(m.toolLogs || [])];
        const idx = logs.findIndex((l) => l.id === item.id);
        if (idx >= 0) logs[idx] = { ...logs[idx], ...item };
        else logs.push(item);
        return { ...m, toolLogs: logs };
      }),
    );
  };

  /** Fast first draft — no diff, auto-apply + live stream preview */
  const runFastDraft = useCallback(
    async (prompt: string) => {
      const p = prompt.trim();
      if (!p) return;
      setIsBusy(true);
      setChatInput('');
      setPendingEdits([]);
      setActivity([{ id: uid(), label: 'Escribiendo…', state: 'active' }]);
      if (!documentTitle || documentTitle === 'Untitled') {
        setDocumentTitle(p.slice(0, 48) + (p.length > 48 ? '…' : ''));
      }
      const assistantId = uid();
      setMessages((m) => [
        ...m,
        { id: uid(), role: 'user', content: p },
        {
          id: assistantId,
          role: 'assistant',
          content: 'Escribiendo…',
          streaming: true,
          isDraftStream: true,
          draftHtml: '',
          draftStatus: 'Escribiendo…',
        },
      ]);

      try {
        abortRef.current?.abort();
        const ac = new AbortController();
        abortRef.current = ac;
        const res = await fetch('/api/draft', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: ac.signal,
          body: JSON.stringify({ prompt: p, model }),
        });
        if (!res.ok || !res.body) throw new Error('Draft failed');

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let htmlAcc = '';
        let lastChatPaint = 0;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const parts = buffer.split('\n\n');
          buffer = parts.pop() || '';
          for (const chunk of parts) {
            const line = chunk.trim();
            if (!line.startsWith('data:')) continue;
            let ev: any;
            try {
              ev = JSON.parse(line.slice(5).trim());
            } catch {
              continue;
            }
            if (ev.type === 'status') {
              // Ignore fake Done; only real writing labels
              const lab = ev.label || 'Escribiendo…';
              if (/^done$/i.test(String(lab).trim())) continue;
              setActivityLabel(lab, 'active');
              setMessages((ms) =>
                ms.map((m) =>
                  m.id === assistantId
                    ? { ...m, draftStatus: lab, streaming: true }
                    : m,
                ),
              );
            }
            if (ev.type === 'html_delta') {
              // Real Gemini tokens — preview only in chat; canvas waits for full doc (first-time reveal)
              htmlAcc += ev.delta || '';
              const now = Date.now();
              if (now - lastChatPaint > 100) {
                lastChatPaint = now;
                const clean = sanitizeDocumentHtml(htmlAcc);
                setMessages((ms) =>
                  ms.map((m) =>
                    m.id === assistantId
                      ? {
                          ...m,
                          draftHtml: clean,
                          draftStatus: 'Escribiendo…',
                          streaming: true,
                          isDraftStream: true,
                        }
                      : m,
                  ),
                );
              }
            }
            if (ev.type === 'html_ready') {
              const finalHtml = sanitizeDocumentHtml(ev.html || htmlAcc);
              // First document: full HTML already ready → vertical shine reveal (not fake streaming on canvas)
              applyHtml(finalHtml, true, 'firstReveal');
              setMessages((ms) =>
                ms.map((m) =>
                  m.id === assistantId
                    ? {
                        ...m,
                        content: 'Listo — el documento está en el lienzo.',
                        draftHtml: finalHtml,
                        draftStatus: 'Listo',
                        streaming: false,
                        isDraftStream: true,
                      }
                    : m,
                ),
              );
              pushEvent(
                {
                  type: 'ai_draft',
                  title: 'Documento creado',
                  summary: 'aplicado al lienzo',
                },
                true,
              );
              setActivityLabel('Done', 'done');
            }
            if (ev.type === 'error') {
              toast({ variant: 'destructive', title: 'Draft error', description: ev.message });
              setMessages((ms) =>
                ms.map((m) =>
                  m.id === assistantId
                    ? { ...m, content: ev.message || 'Error', streaming: false, isDraftStream: false }
                    : m,
                ),
              );
            }
          }
        }
      } catch (e: any) {
        toast({ variant: 'destructive', title: 'Draft failed', description: e?.message });
      } finally {
        setIsBusy(false);
      }
    },
    [model, applyHtml, toast, documentTitle, pushEvent],
  );

  /** Edits / rewrites — propose + ghost / accept */
  const runChat = useCallback(
    async (userText: string, opts?: { selectedText?: string; intensity?: number }) => {
      const text = userText.trim();
      if (!text) return;

      const liveDocumentHtml = readEditorHtml();
      const empty = isDocEmpty(liveDocumentHtml);
      // Only full-draft on clear document requests — never on "hola"
      if (empty && wantsFullDocument(text)) {
        await runFastDraft(text);
        return;
      }

      const userMsg: ChatMessage = { id: uid(), role: 'user', content: text };
      const nextMessages = [...messages, userMsg];
      setMessages(nextMessages);
      setChatInput('');
      setIsBusy(true);
      setActivity([{ id: uid(), label: 'Recogiendo información…', state: 'active' }]);

      const assistantId = uid();
      setMessages((m) => [...nextMessages, { id: assistantId, role: 'assistant', content: '', streaming: true }]);

      try {
        abortRef.current?.abort();
        const ac = new AbortController();
        abortRef.current = ac;

        let assignmentContext = '';
        // Never inject old Gauss/taller brief unless user explicitly loaded a guide
        try {
          if (sessionStorage.getItem('studioBriefActive') === '1') {
            const raw = sessionStorage.getItem('studioAssignment');
            const briefRaw = sessionStorage.getItem('studioBriefRaw');
            if (raw) {
              const a = JSON.parse(raw);
              assignmentContext = [
                a.title && `Title: ${a.title}`,
                a.tasks?.length && `Tasks: ${a.tasks.map((t: any) => t.title).join('; ')}`,
              ]
                .filter(Boolean)
                .join('\n');
            }
            if (briefRaw) assignmentContext += `\n${briefRaw.slice(0, 4000)}`;
          }
        } catch {
          /* ignore */
        }

        const intensityNote =
          opts?.intensity != null
            ? `\nApply intensity ${opts.intensity}% (10=subtle, 100=strong).`
            : '';

        const res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: ac.signal,
          body: JSON.stringify({
            messages: nextMessages.map(({ role, content }) => ({
              role,
              content: role === 'user' && content === text ? content + intensityNote : content,
            })),
            documentHtml: liveDocumentHtml,
            documentTitle,
            paperSize,
            selectedText: opts?.selectedText || selectedTextRef.current || '',
            model,
            autoStart: false,
            assignmentContext,
          }),
        });

        if (!res.ok || !res.body) throw new Error('Chat failed');

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let acc = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const chunks = buffer.split('\n\n');
          buffer = chunks.pop() || '';
          for (const chunk of chunks) {
            const line = chunk.trim();
            if (!line.startsWith('data:')) continue;
            let ev: any;
            try {
              ev = JSON.parse(line.slice(5).trim());
            } catch {
              continue;
            }
            if (ev.type === 'thinking' || ev.type === 'status') {
              const lab = ev.label || 'Trabajando…';
              if (/^done$/i.test(String(lab).trim())) {
                setActivityLabel(lab, 'done');
              } else {
                setActivityLabel(lab, 'active');
              }
            }
            if (ev.type === 'tool_start') {
              const id = ev.id || `tool_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
              const label = ev.label || ev.name || 'Tool…';
              setActivityLabel(label, 'active');
              pushToolLog(assistantId, { id, label, state: 'running' });
              // stash id for matching end if server reuses
              (ev as any).__tid = id;
            }
            if (ev.type === 'tool_end') {
              const id = ev.id || '';
              setActivity((prev) =>
                prev.map((s) => (s.state === 'active' ? { ...s, state: 'done' as const } : s)),
              );
              if (id) {
                pushToolLog(assistantId, {
                  id,
                  label: ev.label || ev.name || 'Listo',
                  doneLabel: ev.label || undefined,
                  state: ev.ok === false ? 'error' : 'done',
                });
              } else {
                // mark last running as done
                setMessages((ms) =>
                  ms.map((m) => {
                    if (m.id !== assistantId || !m.toolLogs?.length) return m;
                    const logs = [...m.toolLogs];
                    for (let i = logs.length - 1; i >= 0; i--) {
                      if (logs[i].state === 'running') {
                        logs[i] = {
                          ...logs[i],
                          state: ev.ok === false ? 'error' : 'done',
                          doneLabel: ev.label || logs[i].label,
                        };
                        break;
                      }
                    }
                    return { ...m, toolLogs: logs };
                  }),
                );
              }
            }
            if (ev.type === 'text') {
              acc += ev.delta || '';
              setMessages((ms) =>
                ms.map((m) => (m.id === assistantId ? { ...m, content: acc, streaming: true } : m)),
              );
            }
            if (ev.type === 'propose_edit') {
              const edit = ev.edit as ProposeEditPayload;
              // Always anchor "before" to the live document so structural diffs
              // keep real HTML (headings, LaTeX, tables) instead of model guesses.
              if (edit.mode === 'replace_document') {
                edit.beforeHtml = liveDocumentHtml;
              } else if (edit.mode === 'replace_selection') {
                if (!edit.beforeHtml) {
                  edit.beforeHtml = selectedTextRef.current
                    ? `<p>${selectedTextRef.current}</p>`
                    : '';
                }
              } else if (
                edit.mode === 'replace_block' &&
                typeof edit.blockIndex === 'number'
              ) {
                const el = queryAllBlocks()[edit.blockIndex];
                if (el) edit.beforeHtml = el.outerHTML;
              }
              setPendingEdits((p) => [...p, { id: ev.id, edit, status: 'pending' }]);
              setActiveEditId((cur) => cur || ev.id);
              pushEvent(
                {
                  type: 'ai_change',
                  title: edit.title || 'Cambio propuesto',
                  summary: edit.summary || 'revisá diff en el lienzo',
                },
                true,
              );
            }
            if (ev.type === 'error') {
              toast({ variant: 'destructive', title: 'Chat error', description: ev.message });
            }
            if (ev.type === 'done') {
              setMessages((ms) =>
                ms.map((m) =>
                  m.id === assistantId
                    ? {
                        ...m,
                        content: acc || ev.finalText || m.content,
                        streaming: false,
                        toolLogs: (m.toolLogs || []).map((t) =>
                          t.state === 'running'
                            ? { ...t, state: 'done' as const, doneLabel: t.doneLabel || t.label }
                            : t,
                        ),
                      }
                    : m,
                ),
              );
              setActivity([]); // hide Done shine completely
            }
          }
        }
      } catch (e: any) {
        if (e?.name === 'AbortError') {
          setMessages((ms) =>
            ms.map((m) =>
              m.id === assistantId
                ? { ...m, content: m.content || 'Detenido.', streaming: false }
                : m,
            ),
          );
        } else {
          toast({ variant: 'destructive', title: 'Chat failed', description: e?.message });
          setMessages((ms) =>
            ms.map((m) =>
              m.id === assistantId
                ? { ...m, content: 'No pude completar eso. Probá de nuevo.', streaming: false }
                : m,
            ),
          );
        }
      } finally {
        setIsBusy(false);
        setActivity([]);
        abortRef.current = null;
      }
    },
    [messages, documentTitle, paperSize, model, toast, runFastDraft, pushEvent, queryAllBlocks, readEditorHtml],
  );

  useEffect(() => {
    if (!topic || didAuto.current || !isClient || !draftReady) return;
    if (restoredDraft.current) {
      didAuto.current = true;
      return;
    }
    didAuto.current = true;
    setDocumentTitle(topic.slice(0, 48) + (topic.length > 48 ? '…' : ''));
    void runFastDraft(topic);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topic, isClient, draftReady]);

  const onEditorInput = () => {
    if (!canvasRef.current || skipHistory.current) return;
    setDocumentContent(readEditorHtml());
    // Debounce history + typeset so typing stays snappy
    if (localEditTimer.current) clearTimeout(localEditTimer.current);
    localEditTimer.current = setTimeout(() => {
      localEditTimer.current = null;
      pushHistory(readEditorHtml());
      typesetAll();
    }, 400);
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('[data-selection-ui]')) return;
    if ((e.target as HTMLElement).closest('[data-block-edit]')) return;
    if ((e.target as HTMLElement).closest('.floating-composer-shell')) return;
    requestAnimationFrame(() => {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed || !sel.rangeCount || !canvasRef.current) {
        setHasSelection(false);
        setSelBar(null);
        return;
      }
      if (!selectionInCanvas(sel.anchorNode)) {
        setHasSelection(false);
        setSelBar(null);
        return;
      }
      const range = sel.getRangeAt(0);
      selectionRef.current = range.cloneRange();
      selectedTextRef.current = sel.toString();
      if (!selectedTextRef.current.trim()) {
        setHasSelection(false);
        setSelBar(null);
        return;
      }
      setHasSelection(true);
      // Word-like format bar near selection (does NOT auto-open agent)
      if (prefs.showSelectionToolbar) {
        const rect = range.getBoundingClientRect();
        const host = paperHostRef.current;
        if (host) {
          const hostRect = host.getBoundingClientRect();
          setSelBar({
            top: Math.max(48, rect.top - hostRect.top - 44),
            left: Math.min(
              Math.max(120, rect.left - hostRect.left + rect.width / 2),
              hostRect.width - 120,
            ),
          });
        }
      }
    });
  };

  const clearSelectionContext = () => {
    setHasSelection(false);
    setSelBar(null);
    selectedTextRef.current = '';
    selectionRef.current = null;
    const sel = window.getSelection();
    sel?.removeAllRanges();
  };

  const openAgentForSelection = () => {
    if (!selectedTextRef.current.trim()) return;
    setSelBar(null);
    openAgent('edit');
  };

  const handleToolsAction = (action: OrbitAction, intensity: number) => {
    const selected = selectedTextRef.current.trim();
    if (action === 'norms') {
      // Full level brief (APA→minimal) so the agent applies real norms, not a one-liner
      void runChat(normsAgentPrompt(intensity, Boolean(selected)), {
        selectedText: selected || undefined,
        intensity,
      });
      return;
    }
    const labels: Record<Exclude<OrbitAction, 'norms'>, string> = {
      improve: 'Improve',
      shorter: 'Make shorter',
      expand: 'Expand',
      grammar: 'Fix grammar',
      academic: 'More academic',
    };
    const label = labels[action as Exclude<OrbitAction, 'norms'>] || action;
    if (selected) {
      void runChat(
        `${label} the selected text at intensity ${intensity}%. Prefer edit_paragraph or propose_edit (replace_selection). If selection is a formula, use list_equations + edit_equation (MATH-SAFE).`,
        { selectedText: selected, intensity },
      );
    } else {
      void runChat(
        `${label} the entire document at intensity ${intensity}%. Prefer targeted edit_paragraph; full replace_document only if necessary. MATH-SAFE: list_equations before touching formulas.`,
        { intensity },
      );
    }
  };

  const handleComposerSend = () => {
    const text = chatInput.trim();
    if (!text) return;
    const selected = selectedTextRef.current.trim();
    if (selected) {
      void runChat(text, { selectedText: selected });
    } else {
      void runChat(text);
    }
  };

  const handleStopAgent = () => {
    abortRef.current?.abort();
    abortRef.current = null;
    setIsBusy(false);
    setActivity([]);
  };

  const acceptEdit = async (id: string) => {
    const item = pendingEdits.find((p) => p.id === id);
    if (!item) return;
    const { edit } = item;

    // AI proposals are anchored to a specific document state. Never apply a
    // stale range or block to a newer document, otherwise an edit can silently
    // land in the wrong paragraph after the user keeps typing.
    if (edit.mode === 'replace_document' && edit.beforeHtml) {
      const current = readEditorHtml();
      if (current !== edit.beforeHtml) {
        toast({
          variant: 'destructive',
          title: 'El documento cambió',
          description: 'La propuesta quedó desactualizada. Pedile al agente que la genere de nuevo.',
        });
        return;
      }
    }

    if (edit.mode === 'replace_block' && typeof edit.blockIndex === 'number') {
      const target = queryAllBlocks()[edit.blockIndex];
      if (!target) {
        toast({
          variant: 'destructive',
          title: 'No se encontró el bloque',
          description: `Índice ${edit.blockIndex}`,
        });
        return;
      }
      if (edit.beforeHtml && target.outerHTML !== edit.beforeHtml) {
        toast({
          variant: 'destructive',
          title: 'El bloque cambió',
          description: 'La propuesta quedó desactualizada. Volvé a pedir ese cambio.',
        });
        return;
      }
    }

    if (edit.mode === 'replace_selection') {
      const range = selectionRef.current;
      const attached = !!range && selectionInCanvas(range.commonAncestorContainer);
      if (!attached || !range?.toString().trim()) {
        toast({
          variant: 'destructive',
          title: 'La selección ya no está disponible',
          description: 'Seleccioná el texto nuevamente y pedile al agente que lo edite.',
        });
        return;
      }
    }

    if (edit.mode === 'replace_document') {
      applyHtml(edit.afterHtml, true, 'cascade');
    } else if (edit.mode === 'replace_block' && typeof edit.blockIndex === 'number') {
      const target = queryAllBlocks()[edit.blockIndex];
      if (target) {
        const wrap = document.createElement('div');
        wrap.innerHTML = sanitizeDocumentHtml(edit.afterHtml);
        const next = wrap.firstElementChild;
        if (next) target.replaceWith(next);
        else target.outerHTML = sanitizeDocumentHtml(edit.afterHtml);
        // Re-pack pages after DOM mutation
        const html = readEditorHtml();
        applyHtml(html, true);
      } else {
        toast({
          variant: 'destructive',
          title: 'No se encontró el bloque',
          description: `Índice ${edit.blockIndex}`,
        });
      }
    } else if (edit.mode === 'replace_selection' && selectionRef.current) {
      try {
        const range = selectionRef.current;
        range.deleteContents();
        const temp = document.createElement('div');
        temp.innerHTML = sanitizeDocumentHtml(edit.afterHtml);
        const frag = document.createDocumentFragment();
        while (temp.firstChild) frag.appendChild(temp.firstChild);
        range.insertNode(frag);
        const html = readEditorHtml();
        applyHtml(html, true);
      } catch {
        toast({
          variant: 'destructive',
          title: 'No se pudo aplicar la selección',
          description: 'La propuesta no modificó el documento. Volvé a seleccionar el texto y pedile al agente que lo intente de nuevo.',
        });
        return;
      }
    } else if (edit.mode === 'insert_html') {
      const body = getActiveBody();
      if (body) {
        const range = selectionRef.current && body.contains(selectionRef.current.commonAncestorContainer)
          ? selectionRef.current.cloneRange()
          : null;
        if (range) {
          range.deleteContents();
          const temp = document.createElement('div');
          temp.innerHTML = sanitizeDocumentHtml(edit.afterHtml);
          const frag = document.createDocumentFragment();
          while (temp.firstChild) frag.appendChild(temp.firstChild);
          range.insertNode(frag);
        } else {
          body.insertAdjacentHTML('beforeend', sanitizeDocumentHtml(edit.afterHtml));
        }
        applyHtml(readEditorHtml(), true);
      } else {
        toast({
          variant: 'destructive',
          title: 'No hay un punto de inserción',
          description: 'Poné el cursor en el documento y aceptá la propuesta otra vez.',
        });
        return;
      }
    } else {
      applyHtml(edit.afterHtml, true, 'cascade');
    }

    setPendingEdits((p) => p.map((e) => (e.id === id ? { ...e, status: 'accepted' } : e)));
    setActiveEditId((cur) => {
      if (cur !== id) return cur;
      const next = pendingEdits.find((e) => e.id !== id && e.status === 'pending');
      return next?.id ?? null;
    });
    pushEvent(
      {
        type: 'ai_applied',
        title: `Aplicado: ${edit.title}`,
        summary: edit.summary?.slice(0, 48),
      },
      true,
    );
    requestAnimationFrame(() => typesetAll());
  };

  const rejectEdit = (id: string) => {
    const item = pendingEdits.find((p) => p.id === id);
    setPendingEdits((p) => p.map((e) => (e.id === id ? { ...e, status: 'rejected' } : e)));
    setActiveEditId((cur) => {
      if (cur !== id) return cur;
      const next = pendingEdits.find((e) => e.id !== id && e.status === 'pending');
      return next?.id ?? null;
    });
    pushEvent(
      {
        type: 'local_edit',
        title: 'Rechazado',
        summary: item?.edit.title,
      },
      true,
    );
  };

  const acceptAllEdits = async () => {
    const pending = pendingEdits.filter((e) => e.status === 'pending');
    if (pending.length <= 1) {
      for (const item of pending) await acceptEdit(item.id);
      return;
    }

    // Block edits can be applied safely from the bottom upwards. Selection,
    // document and insertion edits depend on a live anchor, so applying them
    // in a synchronous loop could move or overwrite the next target.
    const blockEdits = pending.every(
      (item) => item.edit.mode === 'replace_block' && typeof item.edit.blockIndex === 'number',
    );
    if (!blockEdits) {
      toast({
        title: 'Aplicá las propuestas una por una',
        description: 'Las propuestas de selección o documento necesitan conservar su anclaje actual.',
      });
      return;
    }

    for (const item of pending
      .slice()
      .sort((a, b) => (b.edit.blockIndex ?? 0) - (a.edit.blockIndex ?? 0))) {
      await acceptEdit(item.id);
    }
  };

  const rejectAllEdits = () => {
    const ids = pendingEdits.filter((e) => e.status === 'pending').map((e) => e.id);
    ids.forEach((id) => rejectEdit(id));
  };

  const handleExportPdf = async () => {
    if (!canvasRef.current) return;
    setIsBusy(true);
    try {
      typesetAll();
      await new Promise((r) => setTimeout(r, 200));
      const pdf = new jsPDF({
        orientation: 'p',
        unit: 'pt',
        format: paperSize === 'legal' ? [612, 1008] : 'letter',
      });
      const clone = document.createElement('div');
      clone.innerHTML = sanitizeDocumentHtml(readEditorHtml());
      document.body.appendChild(clone);
      clone.style.background = 'white';
      clone.style.color = 'black';
      clone.style.padding = '48px';
      clone.style.width = '516pt';
      await pdf.html(clone, {
        callback: (doc) => {
          doc.save(`${documentTitle || 'docs-studio'}.pdf`);
          document.body.removeChild(clone);
          toast({ title: 'PDF exported' });
        },
        width: 516,
        windowWidth: clone.scrollWidth,
        autoPaging: 'text',
      });
    } catch {
      toast({ variant: 'destructive', title: 'PDF export failed' });
    } finally {
      setIsBusy(false);
    }
  };

  const handleExportWord = async () => {
    if (!canvasRef.current) return;
    try {
      typesetAll();
      await new Promise((r) => setTimeout(r, 120));
      const html = readEditorHtml();
      const title = documentTitle || 'Docs Studio';

      // Server-side .docx (docx package stays off the client — avoids "super" SyntaxError)
      const res = await fetch('/api/export-docx', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ html, title }),
      });

      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${title.replace(/[^\w\- ]+/g, '').trim() || 'docs-studio'}.docx`;
        a.click();
        URL.revokeObjectURL(url);
        toast({ title: 'Word (.docx) exportado' });
        pushEvent({ type: 'local_edit', title: 'Export .docx', summary: 'listo' });
        return;
      }

      // Fallback: Word-compatible HTML .doc
      const tmp = document.createElement('div');
      tmp.innerHTML = sanitizeDocumentHtml(html);
      const docHtml = htmlForWordExport(tmp, title);
      const blob = new Blob(['\ufeff', docHtml], { type: 'application/msword' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${title.replace(/[^\w\- ]+/g, '').trim() || 'docs-studio'}.doc`;
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: 'Word (.doc) exportado', description: 'Fallback HTML' });
      pushEvent({ type: 'local_edit', title: 'Export .doc', summary: 'fallback' });
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Export falló', description: e?.message });
    }
  };

  const handleImportWord = async (file: File) => {
    if (!file) return;
    const name = file.name || '';
    if (!/\.docx$/i.test(name) && file.type !== 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      toast({
        variant: 'destructive',
        title: 'Formato no soportado',
        description: 'Importá un archivo .docx (Word).',
      });
      return;
    }
    setIsBusy(true);
    try {
      const buf = await file.arrayBuffer();
      const { html, titleHint, warnings, userSummary } = await importDocxToHtml(buf, name);
      setDocumentTitle(titleHint.slice(0, 80));
      applyHtml(html, true, 'cascade');
      toast({ title: 'Word importado al lienzo', description: userSummary.slice(0, 240) });
      pushEvent({ type: 'local_edit', title: 'Import .docx', summary: userSummary.slice(0, 160) }, true);
      setMessages((ms) => [
        ...ms,
        {
          id: uid(),
          role: 'assistant',
          content:
            warnings.length === 0
              ? `Importé **${titleHint}** al lienzo (hojas, tablas y fórmulas editables).`
              : `Importé **${titleHint}**.\n\n${warnings.map((w) => `• ${w}`).join('\n')}`,
          streaming: false,
        },
      ]);
    } catch (e: any) {
      toast({
        variant: 'destructive',
        title: 'No se pudo importar',
        description: e?.message || 'Error leyendo el .docx',
      });
    } finally {
      setIsBusy(false);
      if (importInputRef.current) importInputRef.current.value = '';
    }
  };

  const countWords = () => {
    const plain = (canvasRef.current?.getBodies() || [])
      .map((b) => b.innerText || '')
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim() || (documentContent || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    if (!plain) return 0;
    return plain.split(/\s+/).filter(Boolean).length;
  };

  const handleInsertMath = () => {
    const body = getActiveBody();
    if (!body) return;
    const tex = window.prompt('LaTeX (inline). Ej: x = \\frac{-b \\pm \\sqrt{b^2-4ac}}{2a}', 'E = mc^2');
    if (tex == null || !tex.trim()) return;
    const display = window.confirm('¿Fórmula en bloque (centrada)?\nOK = bloque · Cancelar = inline');
    skipHistory.current = true;
    insertMathAtSelection(body, tex.trim(), display);
    skipHistory.current = false;
    applyHtml(readEditorHtml(), true);
    pushEvent({
      type: 'local_edit',
      title: 'Fórmula insertada',
      summary: display ? `Bloque: ${tex.slice(0, 60)}` : `Inline: ${tex.slice(0, 60)}`,
    });
  };

  const handleInsertTable = () => {
    const body = getActiveBody();
    if (!body) return;
    skipHistory.current = true;
    insertTableAtSelection(body, 3, 3);
    skipHistory.current = false;
    applyHtml(readEditorHtml(), true);
    pushEvent({
      type: 'local_edit',
      title: 'Tabla insertada',
      summary: 'Tabla 3×3 editable en el lienzo.',
    });
  };

  const handleInsertImage = () => {
    imageInputRef.current?.click();
  };

  /** Double-click math to edit TeX source */
  const handleEditorDblClick = (e: React.MouseEvent) => {
    const t = e.target as HTMLElement;
    const math =
      (t.closest('mjx-container') as HTMLElement | null) ||
      (t.closest('.studio-math-inline, .studio-math-block') as HTMLElement | null);
    const body = getActiveBody();
    if (!math || !body) return;
    e.preventDefault();
    const src = getMathSource(math) || '';
    const display =
      math.getAttribute('data-display') === '1' ||
      math.classList.contains('studio-math-block') ||
      math.getAttribute('display') === 'true';
    const next = window.prompt('Editar LaTeX', src);
    if (next == null) return;
    if (!next.trim()) {
      math.remove();
    } else {
      skipHistory.current = true;
      replaceMathNode(body, math, next.trim(), display);
      skipHistory.current = false;
    }
    applyHtml(readEditorHtml(), true);
    pushEvent({
      type: 'local_edit',
      title: 'Fórmula actualizada',
      summary: next.trim().slice(0, 80) || 'Fórmula eliminada',
    });
  };

  const handleEditBlock = (_html: string, plain: string) => {
    selectedTextRef.current = plain;
    setHasSelection(Boolean(plain.trim()));
    openAgent('edit');
  };

  if (!isClient) {
    // Soft load without brand mark (page.tsx Suspense also uses loading.tsx)
    return (
      <div className="studio-load-screen flex h-[100dvh] w-full flex-col items-center justify-center bg-white">
        <div className="studio-load-orb" aria-hidden />
        <div className="relative z-10 flex flex-col items-center gap-5">
          <div className="studio-load-lines" aria-hidden>
            <span />
            <span />
            <span />
            <span />
            <span />
          </div>
          <p className="studio-shine-text text-[13px] font-medium tracking-wide">
            Preparando el lienzo…
          </p>
        </div>
      </div>
    );
  }

  const chatTopBar = (
    <>
      <button
        type="button"
        title="Historial de cambios"
        onClick={() => setHistoryOpen(true)}
        className="flex h-8 w-8 items-center justify-center rounded-md border border-neutral-200 bg-white text-neutral-700 shadow-sm transition hover:bg-neutral-50"
      >
        <History className="h-3.5 w-3.5" strokeWidth={1.75} />
      </button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            size="sm"
            variant="outline"
            className="h-8 rounded-md border border-neutral-300 bg-white px-3 text-xs font-semibold text-neutral-900 shadow-sm hover:bg-neutral-50"
          >
            Export
            <Download className="ml-1.5 h-3.5 w-3.5" strokeWidth={1.5} />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => importInputRef.current?.click()}>
            <FileText className="mr-2 h-4 w-4" /> Importar Word (.docx)
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleExportPdf}>
            <FileText className="mr-2 h-4 w-4" /> PDF
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => void handleExportWord()}>
            <FileText className="mr-2 h-4 w-4" /> Exportar Word (.docx)
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );

  const pendingList = pendingEdits.filter((e) => e.status === 'pending');
  const pending =
    pendingList.find((e) => e.id === activeEditId) || pendingList[0] || null;

  // Compact status for floating composer (latest assistant text, short)
  const lastAssistant = [...messages].reverse().find((m) => m.role === 'assistant' && !m.isDraftStream);
  const floatingLogs = lastAssistant?.toolLogs || [];
  const floatingStatus =
    !isBusy && lastAssistant?.content
      ? lastAssistant.content.replace(/\s+/g, ' ').trim().slice(0, 90) +
        (lastAssistant.content.length > 90 ? '…' : '')
      : isBusy
        ? activity.find((a) => a.state === 'active')?.label || 'Trabajando…'
        : null;

  return (
    <div className="flex h-[100dvh] max-h-[100dvh] max-w-[100vw] overflow-hidden bg-white text-neutral-900">
      <div className="flex h-full min-h-0 min-w-0 flex-1 overflow-hidden">
        <div
          className="relative flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden"
          ref={paperHostRef}
        >
          <div className="relative min-h-0 flex-1 overflow-hidden">
            {/* Handmade paper canvas: full pages + math + tables */}
            <PaperCanvas
              ref={canvasRef}
              paperSize={paperSize}
              onPaperSizeChange={setPaperSize}
              fontFamily={fontFamily}
              fontSize={fontSize}
              contentEditable={!isBusy}
              isLoading={isBusy}
              onInput={onEditorInput}
              onUndo={undo}
              onRedo={redo}
              onMouseUp={handleMouseUp}
              onDoubleClick={handleEditorDblClick}
              onEditBlock={handleEditBlock}
              onPageCountChange={setPageCount}
              ghostHtml={pending?.edit.afterHtml ?? null}
              ghostBeforeHtml={pending?.edit.beforeHtml ?? null}
              ghostTitle={pending?.edit.title ?? null}
              zoom={zoom}
              marginPreset={prefs.marginPreset}
              showEditButton={prefs.showEditButton}
            />
            <input
              ref={importInputRef}
              type="file"
              accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void handleImportWord(f);
              }}
            />
            <input
              ref={imageInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  void canvasRef.current?.insertImage(file).then((inserted) => {
                    if (!inserted) {
                      toast({
                        variant: 'destructive',
                        title: 'No se pudo insertar la imagen',
                        description: 'Usá una imagen de menos de 12 MB.',
                      });
                    }
                  });
                }
                e.currentTarget.value = '';
              }}
            />

            <div
              data-studio-toolbar
              className="pointer-events-none absolute inset-x-0 top-3 z-30 flex justify-center px-3"
            >
              <div className="pointer-events-auto flex max-w-[min(980px,100%)] items-center gap-2">
              <a
                href="/home"
                className="pointer-events-auto flex h-9 shrink-0 items-center rounded-full border border-neutral-200 bg-white/95 px-3 text-[11px] font-semibold text-neutral-600 shadow-sm backdrop-blur-md hover:bg-white hover:text-neutral-900"
              >
                Biblioteca
              </a>
              {docId && (
                <span className="pointer-events-none hidden rounded-full border border-neutral-200 bg-white/90 px-2.5 py-1 font-mono text-[10px] text-neutral-400 sm:inline">
                  {saveState === 'saving'
                    ? 'Guardando…'
                    : saveState === 'error'
                      ? 'Error al guardar'
                      : saveState === 'saved'
                        ? 'Guardado'
                        : '·'}
                </span>
              )}
              <div className="pointer-events-auto max-w-[min(980px,100%)] overflow-x-auto rounded-2xl border border-neutral-200/90 bg-white/95 shadow-[0_8px_30px_rgba(0,0,0,0.08)] backdrop-blur-md">
                <DocumentEditorToolbar
                  onRequestLink={() => {
                    const url = window.prompt('URL');
                    if (url) document.execCommand('createLink', false, url);
                  }}
                  onUndo={undo}
                  onRedo={redo}
                  canUndo={historyIndex > 0}
                  canRedo={historyIndex < history.length - 1}
                  fontFamily={fontFamily}
                  onFontFamily={setFontFamily}
                  fontSize={fontSize}
                  onFontSize={setFontSize}
                  pageCount={pageCount}
                  wordCount={countWords()}
                  onInsertMath={handleInsertMath}
                  onInsertTable={handleInsertTable}
                  onInsertImage={handleInsertImage}
                  onImportWord={() => importInputRef.current?.click()}
                  onOpenSettings={() => setSettingsOpen(true)}
                />
              </div>
            </div>
            </div>

            {hasSelection && selBar && prefs.showSelectionToolbar && (
              <SelectionFormatBar
                top={selBar.top}
                left={selBar.left}
                visible
                showAiPencil={prefs.showSelectionAi && prefs.agentVisibility !== 'hidden'}
                onEditWithAi={openAgentForSelection}
                aiShortcutLabel={`Ctrl+${(prefs.shortcutEditSelection || 'e').toUpperCase()}`}
              />
            )}

            <ToolsDock
              busy={isBusy}
              hasSelection={hasSelection}
              onAction={handleToolsAction}
              showAgentOption={prefs.showAgentInTools && prefs.agentVisibility !== 'hidden'}
              onOpenAgent={() => openAgent(hasSelection ? 'edit' : 'chat')}
            />

            <div className="pointer-events-none absolute bottom-6 left-5 z-40">
              <ZoomControl zoom={zoom} onZoom={setZoom} />
            </div>

            {/* Ephemeral agent input — only when opened (or always mode) */}
            {prefs.agentVisibility !== 'hidden' && (
              <FloatingComposer
                open={agentOpen || prefs.agentVisibility === 'always'}
                onClose={closeAgent}
                value={chatInput}
                onChange={setChatInput}
                onSend={handleComposerSend}
                busy={isBusy}
                busyLabel={
                  activity.find((a) => a.state === 'active')?.label ||
                  (isBusy ? 'Recogiendo información…' : null)
                }
                onStop={handleStopAgent}
                toolLogs={floatingLogs}
                statusLine={floatingStatus}
                mode={agentMode}
                hasSelection={agentMode === 'edit' && hasSelection}
                selectionPreview={selectedTextRef.current}
                onClearSelection={clearSelectionContext}
                reviews={pendingList}
                activeReviewId={pending?.id}
                onSelectReview={setActiveEditId}
                onAcceptReview={acceptEdit}
                onRejectReview={rejectEdit}
                onAcceptAll={acceptAllEdits}
                onRejectAll={rejectAllEdits}
                softFocus
                onOpenPanel={() => {
                  // Opening full chat closes ephemeral input
                  setAgentOpen(false);
                  setChatCollapsed(false);
                  setChatWidth((w) => Math.max(w, 360));
                }}
              />
            )}
          </div>
        </div>

        {/* Drag handle to resize / collapse chat */}
        <div
          role="separator"
          aria-orientation="vertical"
          title="Arrastrá para redimensionar · más a la derecha colapsa"
          onMouseDown={() => {
            if (chatCollapsed) {
              setAgentOpen(false);
              setChatCollapsed(false);
              return;
            }
            resizingChat.current = true;
            document.body.style.cursor = 'col-resize';
            document.body.style.userSelect = 'none';
          }}
          className={cn(
            'group relative z-30 shrink-0 cursor-col-resize bg-neutral-100 transition-all duration-300 hover:bg-neutral-300',
            chatCollapsed ? 'w-0 opacity-0' : 'w-1.5 opacity-100',
          )}
        >
          <div className="absolute inset-y-0 -left-1 -right-1" />
        </div>

        {/* Chat panel — slide + fade open/close */}
        <div
          className={cn(
            'studio-chat-panel flex h-full min-h-0 shrink-0 flex-col overflow-hidden border-l border-neutral-200 bg-white',
            'transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]',
            chatCollapsed
              ? 'w-0 max-w-0 border-l-0 opacity-0'
              : 'opacity-100',
          )}
          style={
            chatCollapsed
              ? { width: 0, maxWidth: 0 }
              : { width: chatWidth, maxWidth: 'min(560px, 48vw)' }
          }
        >
          {!chatCollapsed && (
            <StudioChat
              messages={messages}
              activity={activity}
              pendingEdits={pendingEdits}
              input={chatInput}
              onInputChange={setChatInput}
              onSend={() => runChat(chatInput)}
              onAcceptEdit={acceptEdit}
              onRejectEdit={rejectEdit}
              isBusy={isBusy}
              onQuickAction={(p) => void runChat(p)}
              topBar={chatTopBar}
            />
          )}
        </div>
      </div>

      <StudioSettings
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        paperSize={paperSize}
        onPaperSizeChange={setPaperSize}
        prefs={prefs}
        onPrefsChange={setPrefs}
      />
      <HistoryDrawer
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        items={changeLog}
      />
    </div>
  );
}
