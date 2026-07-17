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
import PaperCanvas from '@/components/paper-canvas';
import StudioChat, {
  type ActivityStep,
  type ChatMessage,
  type PendingEdit,
} from '@/components/studio-chat';
import SelectionPrompt from '@/components/selection-prompt';
import ToolsDock, { type OrbitAction } from '@/components/tools-dock';
import type { ChatEvent } from '@/components/chat-event-card';
import { useToast } from '@/hooks/use-toast';
import { Download, FileText, History, MessageSquareText, PanelRightClose } from 'lucide-react';
import FloatingComposer from '@/components/floating-composer';
import { cn } from '@/lib/utils';
import { DEFAULT_STUDIO_MODEL } from '@/lib/studio-models';
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
import { applyHtmlWithCascade, applyFirstDraftReveal } from '@/lib/cascade';
import { serializeEditorHtml, stripBreaks } from '@/lib/page-layout';
import CanvasReviewBar from '@/components/canvas-review-bar';
import StudioSettings, { DEFAULT_PREFS, type StudioPrefs } from '@/components/studio-settings';
import HistoryDrawer, { type HistoryItem } from '@/components/history-drawer';
import ZoomControl from '@/components/zoom-control';
import jsPDF from 'jspdf';

const DEFAULT_FONT = 'Inter, Segoe UI, system-ui, sans-serif';

function uid() {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function isDocEmpty(html: string) {
  const t = html.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim();
  return t.length < 8;
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

export default function DocsStudioClient({ topic }: { topic: string }) {
  const { toast } = useToast();

  const [documentTitle, setDocumentTitle] = useState('Untitled');
  const [documentContent, setDocumentContent] = useState('');
  const [isClient, setIsClient] = useState(false);
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

  const [history, setHistory] = useState<string[]>(['']);
  const [historyIndex, setHistoryIndex] = useState(0);

  const [selOpen, setSelOpen] = useState(false);
  const [selPos, setSelPos] = useState({ top: 0, left: 0 });
  const [hasSelection, setHasSelection] = useState(false);
  const selectionRef = useRef<Range | null>(null);
  const selectedTextRef = useRef('');

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [activity, setActivity] = useState<ActivityStep[]>([]);
  const [pendingEdits, setPendingEdits] = useState<PendingEdit[]>([]);
  const [activeEditId, setActiveEditId] = useState<string | null>(null);
  const [chatWidth, setChatWidth] = useState(360);
  /** Default: panel collapsed — floating composer on canvas */
  const [chatCollapsed, setChatCollapsed] = useState(true);
  const resizingChat = useRef(false);

  const editorRef = useRef<HTMLDivElement>(null);
  const paperHostRef = useRef<HTMLDivElement>(null);
  const didAuto = useRef(false);
  const skipHistory = useRef(false);
  const localEditTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastLocalNotify = useRef(0);

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
    // Only load brief if explicitly marked active (pre-summary with guide)
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
      } else if (zoomOut) {
        e.preventDefault();
        e.stopPropagation();
        setZoom((z) => Math.max(0.5, Math.round((z - 0.1) * 20) / 20));
      } else if (zoomReset) {
        e.preventDefault();
        e.stopPropagation();
        setZoom(1);
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, []);

  const pushHistory = useCallback((html: string) => {
    setHistory((prev) => {
      const next = prev.slice(0, historyIndex + 1);
      next.push(html);
      if (next.length > 40) next.shift();
      return next;
    });
    setHistoryIndex((i) => Math.min(i + 1, 39));
  }, [historyIndex]);

  const applyHtml = useCallback(
    (
      html: string,
      recordHistory = true,
      mode: false | 'cascade' | 'firstReveal' = false,
    ) => {
      const clean = sanitizeDocumentHtml(html);
      // Never store page-break spacers in history / state
      const withoutBreaks = clean.replace(
        /<div[^>]*data-studio-break="1"[^>]*>[\s\S]*?<\/div>/gi,
        '',
      );
      setDocumentContent(withoutBreaks);
      if (editorRef.current) {
        skipHistory.current = true;
        stripBreaks(editorRef.current);
        if (mode === 'firstReveal') {
          applyFirstDraftReveal(editorRef.current, withoutBreaks, () => {
            typesetEditor(editorRef.current);
            skipHistory.current = false;
          });
        } else if (mode === 'cascade') {
          applyHtmlWithCascade(editorRef.current, withoutBreaks, () => {
            typesetEditor(editorRef.current);
            skipHistory.current = false;
          });
        } else {
          editorRef.current.innerHTML = withoutBreaks;
          requestAnimationFrame(() => typesetEditor(editorRef.current));
          skipHistory.current = false;
        }
      }
      if (recordHistory) pushHistory(withoutBreaks);
    },
    [pushHistory],
  );

  /** Always strip page-break spacers before AI / history / export */
  const readEditorHtml = () =>
    serializeEditorHtml(editorRef.current) || documentContent;

  const undo = () => {
    if (historyIndex <= 0) return;
    const i = historyIndex - 1;
    setHistoryIndex(i);
    applyHtml(history[i] || '', false);
    pushEvent({
      type: 'local_edit',
      title: 'Deshiciste un cambio',
      summary: 'Se restauró una versión anterior del documento.',
    });
  };

  const redo = () => {
    if (historyIndex >= history.length - 1) return;
    const i = historyIndex + 1;
    setHistoryIndex(i);
    applyHtml(history[i] || '', false);
  };

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
        const res = await fetch('/api/draft', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
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

      const empty = isDocEmpty(readEditorHtml());
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
      setActivity([{ id: uid(), label: 'Pensando…', state: 'active' }]);

      const assistantId = uid();
      setMessages((m) => [...nextMessages, { id: assistantId, role: 'assistant', content: '', streaming: true }]);

      try {
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
          body: JSON.stringify({
            messages: nextMessages.map(({ role, content }) => ({
              role,
              content: role === 'user' && content === text ? content + intensityNote : content,
            })),
            documentHtml: readEditorHtml(),
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
              if (!edit.beforeHtml && edit.mode === 'replace_document') {
                edit.beforeHtml = readEditorHtml();
              }
              if (!edit.beforeHtml && edit.mode === 'replace_selection') {
                edit.beforeHtml = selectedTextRef.current
                  ? `<p>${selectedTextRef.current}</p>`
                  : '';
              }
              if (
                !edit.beforeHtml &&
                edit.mode === 'replace_block' &&
                typeof edit.blockIndex === 'number' &&
                editorRef.current
              ) {
                const blocks = editorRef.current.querySelectorAll(
                  'p, h1, h2, h3, h4, h5, h6, li, blockquote, pre, table, ul, ol',
                );
                const el = blocks[edit.blockIndex] as HTMLElement | undefined;
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
        toast({ variant: 'destructive', title: 'Chat failed', description: e?.message });
        setMessages((ms) =>
          ms.map((m) =>
            m.id === assistantId
              ? { ...m, content: 'No pude completar eso. Probá de nuevo.', streaming: false }
              : m,
          ),
        );
      } finally {
        setIsBusy(false);
        setActivity([]);
      }
    },
    [messages, documentTitle, paperSize, model, toast, runFastDraft, pushEvent],
  );

  useEffect(() => {
    if (!topic || didAuto.current || !isClient) return;
    didAuto.current = true;
    setDocumentTitle(topic.slice(0, 48) + (topic.length > 48 ? '…' : ''));
    void runFastDraft(topic);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topic, isClient]);

  const onEditorInput = () => {
    if (!editorRef.current || skipHistory.current) return;
    // Lightweight: don't serialize full clone every key if possible — still needed for history
    const html = serializeEditorHtml(editorRef.current);
    setDocumentContent(html);
    // Debounce history + typeset so typing stays snappy
    if (localEditTimer.current) clearTimeout(localEditTimer.current);
    localEditTimer.current = setTimeout(() => {
      pushHistory(html);
      if (editorRef.current) typesetEditor(editorRef.current);
    }, 400);
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('[data-selection-ui]')) return;
    if ((e.target as HTMLElement).closest('[data-block-edit]')) return;
    requestAnimationFrame(() => {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed || !sel.rangeCount || !editorRef.current) {
        setSelOpen(false);
        setHasSelection(false);
        selectedTextRef.current = '';
        return;
      }
      if (!editorRef.current.contains(sel.anchorNode)) {
        setSelOpen(false);
        setHasSelection(false);
        return;
      }
      const range = sel.getRangeAt(0);
      selectionRef.current = range.cloneRange();
      selectedTextRef.current = sel.toString();
      if (!selectedTextRef.current.trim()) {
        setSelOpen(false);
        setHasSelection(false);
        return;
      }
      const rect = range.getBoundingClientRect();
      const host = paperHostRef.current;
      if (!host) return;
      const hostRect = host.getBoundingClientRect();
      setSelPos({
        top: Math.min(Math.max(56, rect.bottom - hostRect.top + 10), hostRect.height - 140),
        left: Math.min(
          Math.max(160, rect.left - hostRect.left + rect.width / 2),
          hostRect.width - 160,
        ),
      });
      setHasSelection(true);
      setSelOpen(true);
    });
  };

  const handleSelectionPrompt = (prompt: string) => {
    const selected = selectedTextRef.current;
    if (!selected) return;
    setSelOpen(false);
    void runChat(
      `${prompt}\n\n"""${selected}"""\n\nPropose the edit with propose_edit (replace_selection).`,
      { selectedText: selected },
    );
  };

  const handleToolsAction = (action: OrbitAction, intensity: number) => {
    const selected = selectedTextRef.current.trim();
    const labels: Record<OrbitAction, string> = {
      improve: 'Improve',
      shorter: 'Make shorter',
      expand: 'Expand',
      grammar: 'Fix grammar',
      academic: 'More academic',
    };
    if (selected) {
      void runChat(
        `${labels[action]} this selection at intensity ${intensity}%.\n\n"""${selected}"""\n\nPropose the edit with propose_edit (replace_selection).`,
        { selectedText: selected, intensity },
      );
    } else {
      void runChat(
        `${labels[action]} the entire document at intensity ${intensity}%. Propose with propose_edit (replace_document).`,
        { intensity },
      );
    }
  };

  const acceptEdit = (id: string) => {
    const item = pendingEdits.find((p) => p.id === id);
    if (!item) return;
    const { edit } = item;

    if (edit.mode === 'replace_document') {
      applyHtml(edit.afterHtml, true, 'cascade');
    } else if (edit.mode === 'replace_block' && editorRef.current && typeof edit.blockIndex === 'number') {
      const blocks = editorRef.current.querySelectorAll(
        'p, h1, h2, h3, h4, h5, h6, li, blockquote, pre, table, ul, ol',
      );
      const target = blocks[edit.blockIndex] as HTMLElement | undefined;
      if (target) {
        const wrap = document.createElement('div');
        wrap.innerHTML = sanitizeDocumentHtml(edit.afterHtml);
        const next = wrap.firstElementChild;
        if (next) target.replaceWith(next);
        else target.outerHTML = sanitizeDocumentHtml(edit.afterHtml);
        const html = serializeEditorHtml(editorRef.current);
        setDocumentContent(html);
        pushHistory(html);
        requestAnimationFrame(() => typesetEditor(editorRef.current));
      } else {
        toast({
          variant: 'destructive',
          title: 'No se encontró el bloque',
          description: `Índice ${edit.blockIndex}`,
        });
      }
    } else if (edit.mode === 'replace_selection' && selectionRef.current && editorRef.current) {
      try {
        const range = selectionRef.current;
        range.deleteContents();
        const temp = document.createElement('div');
        temp.innerHTML = sanitizeDocumentHtml(edit.afterHtml);
        const frag = document.createDocumentFragment();
        while (temp.firstChild) frag.appendChild(temp.firstChild);
        range.insertNode(frag);
        const html = serializeEditorHtml(editorRef.current);
        setDocumentContent(html);
        pushHistory(html);
        requestAnimationFrame(() => typesetEditor(editorRef.current));
      } catch {
        applyHtml(edit.afterHtml, true, 'cascade');
      }
    } else if (edit.mode === 'insert_html' && editorRef.current) {
      editorRef.current.insertAdjacentHTML(
        'beforeend',
        sanitizeDocumentHtml(edit.afterHtml),
      );
      const html = serializeEditorHtml(editorRef.current);
      setDocumentContent(html);
      pushHistory(html);
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
    requestAnimationFrame(() => typesetEditor(editorRef.current));
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

  const acceptAllEdits = () => {
    const ids = pendingEdits.filter((e) => e.status === 'pending').map((e) => e.id);
    ids.forEach((id) => acceptEdit(id));
  };

  const rejectAllEdits = () => {
    const ids = pendingEdits.filter((e) => e.status === 'pending').map((e) => e.id);
    ids.forEach((id) => rejectEdit(id));
  };

  const handleExportPdf = async () => {
    if (!editorRef.current) return;
    setIsBusy(true);
    try {
      typesetEditor(editorRef.current);
      await new Promise((r) => setTimeout(r, 200));
      const pdf = new jsPDF({
        orientation: 'p',
        unit: 'pt',
        format: paperSize === 'legal' ? [612, 1008] : 'letter',
      });
      const clone = editorRef.current.cloneNode(true) as HTMLElement;
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
    if (!editorRef.current) return;
    try {
      typesetEditor(editorRef.current);
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
      const docHtml = htmlForWordExport(editorRef.current, title);
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

  const countWords = () => {
    const plain = (editorRef.current?.innerText || documentContent || '')
      .replace(/\s+/g, ' ')
      .trim();
    if (!plain) return 0;
    return plain.split(/\s+/).filter(Boolean).length;
  };

  const handleInsertMath = () => {
    if (!editorRef.current) return;
    const tex = window.prompt('LaTeX (inline). Ej: x = \\frac{-b \\pm \\sqrt{b^2-4ac}}{2a}', 'E = mc^2');
    if (tex == null || !tex.trim()) return;
    const display = window.confirm('¿Fórmula en bloque (centrada)?\nOK = bloque · Cancelar = inline');
    skipHistory.current = true;
    insertMathAtSelection(editorRef.current, tex.trim(), display);
    skipHistory.current = false;
    const html = editorRef.current.innerHTML;
    setDocumentContent(html);
    pushHistory(html);
    pushEvent({
      type: 'local_edit',
      title: 'Fórmula insertada',
      summary: display ? `Bloque: ${tex.slice(0, 60)}` : `Inline: ${tex.slice(0, 60)}`,
    });
  };

  const handleInsertTable = () => {
    if (!editorRef.current) return;
    skipHistory.current = true;
    insertTableAtSelection(editorRef.current, 3, 3);
    skipHistory.current = false;
    const html = editorRef.current.innerHTML;
    setDocumentContent(html);
    pushHistory(html);
    pushEvent({
      type: 'local_edit',
      title: 'Tabla insertada',
      summary: 'Tabla 3×3 editable en el lienzo.',
    });
  };

  /** Double-click math to edit TeX source */
  const handleEditorDblClick = (e: React.MouseEvent) => {
    const t = e.target as HTMLElement;
    const math =
      (t.closest('mjx-container') as HTMLElement | null) ||
      (t.closest('.studio-math-inline, .studio-math-block') as HTMLElement | null);
    if (!math || !editorRef.current) return;
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
      replaceMathNode(editorRef.current, math, next.trim(), display);
      skipHistory.current = false;
    }
    const html = editorRef.current.innerHTML;
    setDocumentContent(html);
    pushHistory(html);
    pushEvent({
      type: 'local_edit',
      title: 'Fórmula actualizada',
      summary: next.trim().slice(0, 80) || 'Fórmula eliminada',
    });
  };

  const handleEditBlock = (_html: string, plain: string) => {
    selectedTextRef.current = plain;
    setHasSelection(Boolean(plain.trim()));
    const host = paperHostRef.current;
    if (host) {
      const r = host.getBoundingClientRect();
      setSelPos({ top: Math.min(r.height * 0.35, 220), left: r.width / 2 });
    }
    setSelOpen(true);
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
        title="Cerrar panel"
        onClick={() => setChatCollapsed(true)}
        className="flex h-8 w-8 items-center justify-center rounded-md border border-neutral-300 bg-white text-neutral-600 shadow-sm hover:bg-neutral-50"
      >
        <PanelRightClose className="h-3.5 w-3.5" strokeWidth={1.75} />
      </button>
      <button
        type="button"
        title="Historial de cambios"
        onClick={() => setHistoryOpen(true)}
        className="flex h-8 w-8 items-center justify-center rounded-md border border-neutral-300 bg-white text-neutral-700 shadow-sm hover:bg-neutral-50"
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
          <DropdownMenuItem onClick={handleExportPdf}>
            <FileText className="mr-2 h-4 w-4" /> PDF
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => void handleExportWord()}>
            <FileText className="mr-2 h-4 w-4" /> Word (.docx)
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
            <PaperCanvas
              ref={editorRef}
              paperSize={paperSize}
              onPaperSizeChange={setPaperSize}
              fontFamily={fontFamily}
              fontSize={fontSize}
              contentEditable={!isBusy}
              isLoading={isBusy}
              onInput={onEditorInput}
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

            {/* Floating format toolbar */}
            <div className="pointer-events-none absolute inset-x-0 top-3 z-30 flex justify-center px-3">
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
                  onOpenSettings={() => setSettingsOpen(true)}
                />
              </div>
            </div>

            {selOpen && (
              <SelectionPrompt
                top={selPos.top}
                left={selPos.left}
                busy={isBusy}
                snippet={selectedTextRef.current}
                onSubmit={handleSelectionPrompt}
                onClose={() => setSelOpen(false)}
              />
            )}

            <ToolsDock
              busy={isBusy}
              hasSelection={hasSelection}
              onAction={handleToolsAction}
            />

            {/* Zoom — also Ctrl+ / Ctrl- / Ctrl0 (capture phase) */}
            <div
              className={cn(
                'pointer-events-none absolute z-40',
                chatCollapsed ? 'bottom-28 right-6' : 'bottom-4 right-24',
              )}
            >
              <ZoomControl zoom={zoom} onZoom={setZoom} />
            </div>

            {/* Floating composer when panel collapsed */}
            {chatCollapsed && (
              <FloatingComposer
                value={chatInput}
                onChange={setChatInput}
                onSend={() => void runChat(chatInput)}
                busy={isBusy}
                toolLogs={floatingLogs}
                statusLine={floatingStatus}
                onOpenPanel={() => {
                  setChatCollapsed(false);
                  setChatWidth((w) => Math.max(w, 360));
                }}
              />
            )}

            {/* Open panel (icon only) when collapsed — top right */}
            {chatCollapsed && (
              <button
                type="button"
                onClick={() => {
                  setChatCollapsed(false);
                  setChatWidth((w) => Math.max(w, 360));
                }}
                className="absolute right-3 top-3 z-40 flex h-10 w-10 items-center justify-center rounded-full border border-[#c9bfb2] bg-white text-[#3d3229] shadow-md transition hover:bg-[#f3efe8] hover:scale-105"
                title="Abrir panel de chat"
              >
                <MessageSquareText className="h-4.5 w-4.5" strokeWidth={1.75} />
              </button>
            )}

            {pendingList.length > 0 && (
              <CanvasReviewBar
                items={pendingList}
                activeId={pending?.id}
                onSelect={setActiveEditId}
                onAccept={acceptEdit}
                onReject={rejectEdit}
                onAcceptAll={acceptAllEdits}
                onRejectAll={rejectAllEdits}
              />
            )}
          </div>
        </div>

        {/* Drag handle to resize / collapse chat */}
        {!chatCollapsed && (
          <div
            role="separator"
            aria-orientation="vertical"
            title="Arrastrá para redimensionar · más a la derecha colapsa"
            onMouseDown={() => {
              resizingChat.current = true;
              document.body.style.cursor = 'col-resize';
              document.body.style.userSelect = 'none';
            }}
            className="group relative z-30 w-1.5 shrink-0 cursor-col-resize bg-neutral-100 hover:bg-[#c9bfb2]"
          >
            <div className="absolute inset-y-0 -left-1 -right-1" />
          </div>
        )}

        {!chatCollapsed && (
          <div
            className="studio-chat-panel flex h-full min-h-0 shrink-0 flex-col overflow-hidden border-l border-neutral-200"
            style={{ width: chatWidth, maxWidth: 'min(560px, 48vw)' }}
          >
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
          </div>
        )}
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
