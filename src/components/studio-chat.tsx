'use client';

import { useEffect, useRef } from 'react';
import type { ProposeEditPayload } from '@/lib/doc-tools';
import ThinkingShine from '@/components/thinking-shine';
import DraftStreamCard from '@/components/draft-stream-card';
import ToolLog, { type ToolLogItem } from '@/components/tool-log';
import EditDiffCard from '@/components/edit-diff-card';
import BrandMark from '@/components/brand-mark';
import { ArrowUp, FileText, Loader2, X } from 'lucide-react';
import { typesetEditor } from '@/lib/math-html';

export type ChatMessage = {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  streaming?: boolean;
  draftHtml?: string;
  draftStatus?: string;
  isDraftStream?: boolean;
  toolLogs?: ToolLogItem[];
  elapsedMs?: number;
  attachments?: Array<{ id: string; name: string }>;
};

export type PendingEdit = {
  id: string;
  edit: ProposeEditPayload;
  status: 'pending' | 'accepted' | 'rejected';
};

export type ActivityStep = {
  id: string;
  label: string;
  state: 'active' | 'done' | 'idle';
};

export type AgentIntent = 'normal' | 'brief' | 'review';

type Props = {
  messages: ChatMessage[];
  activity: ActivityStep[];
  pendingEdits: PendingEdit[];
  input: string;
  onInputChange: (v: string) => void;
  onSend: () => void;
  onAcceptEdit: (id: string) => void;
  onRejectEdit: (id: string) => void;
  onAcceptEditPart?: (id: string, hunkIndex: number) => void;
  onRejectEditPart?: (id: string, hunkIndex: number) => void;
  isBusy: boolean;
  onQuickAction?: (prompt: string) => void;
  topBar?: React.ReactNode;
  elapsedSeconds?: number;
  intent?: AgentIntent;
  onIntentChange?: (intent: AgentIntent) => void;
  references?: Array<{ id: string; name: string; loading?: boolean; progress?: number; cached?: boolean }>;
  onAttachReferences?: (files: File[]) => void;
  onRemoveReference?: (id: string) => void;
};

const QUICK = [
  { label: 'Revolución industrial', prompt: 'Escribí un documento completo sobre la Revolución Industrial.' },
  { label: 'Ensayo APA', prompt: 'Redactá un ensayo académico corto con estructura APA.' },
  { label: 'Informe corto', prompt: 'Generá un informe académico corto y bien estructurado.' },
];

export default function StudioChat({
  messages,
  activity,
  pendingEdits,
  input,
  onInputChange,
  onSend,
  onAcceptEdit,
  onRejectEdit,
  isBusy,
  onQuickAction,
  topBar,
  elapsedSeconds = 0,
  intent = 'normal',
  onIntentChange,
  references = [],
  onAttachReferences,
  onRemoveReference,
  onAcceptEditPart,
  onRejectEditPart,
}: Props) {
  const listRef = useRef<HTMLDivElement>(null);
  const referenceInputRef = useRef<HTMLInputElement>(null);
  // Only show shine while actively working — never when Done/idle
  const activeStep = activity.find((a) => a.state === 'active');
  const showThinking = isBusy && Boolean(activeStep);

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages, activity, isBusy]);

  return (
    <aside className="relative flex h-full min-h-0 w-full min-w-0 flex-col overflow-hidden bg-white font-['Segoe_UI',Tahoma,Geneva,Verdana,sans-serif]">
      {topBar && (
        <div className="pointer-events-none absolute right-3 top-3 z-20 flex items-center gap-1.5">
          <div className="pointer-events-auto flex items-center gap-1.5">{topBar}</div>
        </div>
      )}

      <div
        ref={listRef}
        className="min-h-0 flex-1 space-y-3 overflow-y-auto overflow-x-hidden px-3 pb-2 pt-12"
      >
        {messages.length === 0 && !isBusy && (
          <div className="px-2 pt-10 text-center">
            <div className="mb-3 flex justify-center opacity-90">
              <BrandMark size={40} />
            </div>
            <p className="text-lg font-semibold tracking-tight text-neutral-900">
              ¿Qué escribimos?
            </p>
            <p className="mx-auto mt-1 max-w-[220px] text-[12px] font-medium text-neutral-400">
              Pedí un documento o un cambio.
            </p>
            <div className="mt-4 flex flex-wrap justify-center gap-1.5">
              {QUICK.map((q) => (
                <button
                  key={q.label}
                  type="button"
                  onClick={() => onQuickAction?.(q.prompt)}
                  className="rounded-full border border-neutral-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-neutral-600 hover:border-neutral-400"
                >
                  {q.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, index) => {
          // Keys must stay unique even if a bad persistence race stored the
          // same turn id twice (older builds did that on concurrent PATCH).
          const rowKey = `${m.id || 'msg'}_${index}`;
          if (m.isDraftStream) {
            return (
              <DraftStreamCard
                key={rowKey}
                html={m.draftHtml || ''}
                status={m.draftStatus || m.content}
                done={!m.streaming}
              />
            );
          }
          if (m.role === 'user') {
            return (
              <div key={rowKey} className="flex justify-end">
                <div className="max-w-[92%]">
                  {m.attachments?.length ? (
                    <div className="mb-1 flex justify-end gap-1">
                      {m.attachments.map((attachment, attachmentIndex) => (
                        <span
                          key={`${attachment.id || attachment.name}_${attachmentIndex}`}
                          className="inline-flex max-w-[180px] items-center gap-1 rounded border border-neutral-200 bg-white px-1.5 py-1 text-[10px] font-medium text-neutral-600 shadow-sm"
                        >
                          <FileText className="h-3 w-3 shrink-0" />
                          <span className="truncate">{attachment.name}</span>
                        </span>
                      ))}
                    </div>
                  ) : null}
                  <div className="rounded-2xl rounded-br-md bg-studio-brown px-3.5 py-2.5 text-[13px] font-medium leading-relaxed text-[#f3f1ec] whitespace-pre-wrap">
                    {m.content}
                  </div>
                </div>
              </div>
            );
          }
          if (m.role === 'system') return null;

          const tools = m.toolLogs || [];
          const hasBody = Boolean(m.content?.trim());
          const onlyTools = !hasBody && tools.length > 0;

          return (
            <div
              key={rowKey}
              className="max-w-[95%] space-y-1.5 text-[13.5px] font-medium leading-relaxed text-neutral-800"
            >
              {/* Live thinking only while this message is streaming AND busy */}
              {m.streaming && showThinking && !tools.some((t) => t.state === 'running') && (
                <ThinkingShine label={activeStep?.label || 'Pensando…'} />
              )}

              <ToolLog items={tools} />

              {hasBody && <ChatRichText content={m.content} />}
              {!m.streaming && m.elapsedMs != null && (
                <div className="pt-0.5 font-mono text-[10px] font-medium text-neutral-400">
                  respuesta en {(m.elapsedMs / 1000).toFixed(1)} s
                </div>
              )}

              {m.streaming && onlyTools && showThinking && (
                <ThinkingShine label={activeStep?.label || 'Trabajando…'} />
              )}
            </div>
          );
        })}

        {pendingEdits
          .filter((item) => item.status === 'pending')
          .map((item) => (
            <EditDiffCard
              key={item.id}
              id={item.id}
              edit={item.edit}
              onAccept={onAcceptEdit}
              onReject={onRejectEdit}
              onAcceptPart={onAcceptEditPart}
              onRejectPart={onRejectEditPart}
            />
          ))}

        {showThinking &&
          messages.every((m) => !m.streaming) && (
            <ThinkingShine label={activeStep?.label || 'Pensando…'} />
          )}
      </div>

      <div className="shrink-0 bg-white px-3 pb-3 pt-1">
        {isBusy && (
          <div className="mb-1 px-1 font-mono text-[10px] font-medium tabular-nums text-neutral-400">
            respuesta en {elapsedSeconds.toFixed(1)} s
          </div>
        )}
        <div className="rounded-2xl border border-neutral-200 bg-neutral-50 px-2.5 py-2">
          <div className="mb-1.5 flex items-center gap-1 border-b border-neutral-200/70 pb-1.5">
            <label className="relative">
              <span className="sr-only">Agent mode</span>
              <select value={intent} onChange={(event) => onIntentChange?.(event.target.value as AgentIntent)} disabled={isBusy} className="appearance-none rounded-md border border-neutral-200 bg-white py-1 pl-2 pr-6 font-mono text-[10px] font-semibold uppercase tracking-[.08em] text-neutral-600 outline-none hover:border-neutral-400">
                <option value="normal">Normal</option><option value="brief">Brief</option><option value="review">Review</option>
              </select>
              <span className="pointer-events-none absolute right-2 top-1.5 text-[9px] text-neutral-400">⌄</span>
            </label>
            <span className="truncate text-[10px] text-neutral-400">{intent === 'normal' ? 'Edit and explore the document' : intent === 'brief' ? 'Build and verify against the guide' : 'Check delivery coverage'}</span>
            {onAttachReferences && <><input ref={referenceInputRef} type="file" multiple accept=".docx,.txt,.md,text/plain" className="sr-only" onChange={(event) => { const files = Array.from(event.target.files || []); if (files.length) onAttachReferences(files); event.currentTarget.value = ''; }} /><button type="button" onClick={() => referenceInputRef.current?.click()} className="ml-auto flex h-6 w-6 items-center justify-center rounded border border-neutral-200 bg-white text-neutral-500 hover:border-neutral-400" title="Adjuntar archivo"><FileText className="h-3 w-3" /></button></>}
          </div>
          {references.length > 0 && <div className="mb-1.5 flex flex-wrap gap-1.5">{references.map((reference) => { const progress = Math.max(0, Math.min(100, reference.progress ?? (reference.loading ? 35 : 100))); return <span key={reference.id} title={reference.loading ? `Leyendo ${reference.name}…` : reference.cached ? `${reference.name} leído y en caché` : `${reference.name} leído`} className="inline-flex max-w-full items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-1.5 py-1 text-[9px] font-medium text-neutral-600 shadow-sm"><span className="relative flex h-4 w-4 shrink-0 items-center justify-center rounded-full" style={{ background: `conic-gradient(#5a4a3d ${progress}%, #e5e1db 0)` }}><span className="flex h-2.5 w-2.5 items-center justify-center rounded-full bg-white">{reference.loading ? <Loader2 className="h-2 w-2 animate-spin text-studio-brown" /> : <span className="h-1.5 w-1.5 rounded-full bg-studio-brown" />}</span></span><span className="max-w-[140px] truncate">{reference.name}</span>{reference.loading ? <span className="text-neutral-400">leyendo…</span> : <span className="text-neutral-400">leído</span>}<button type="button" aria-label={`Quitar ${reference.name}`} onClick={() => onRemoveReference?.(reference.id)} className="text-neutral-400 hover:text-neutral-800"><X className="h-3 w-3" /></button></span>; })}</div>}
          <div className="flex items-end gap-1.5">
          <textarea
            value={input}
            onChange={(e) => onInputChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                onSend();
              }
            }}
            rows={2}
            placeholder="Pedí un documento o un cambio…"
            disabled={isBusy}
            className="max-h-16 min-h-[40px] w-full resize-none overflow-y-auto bg-transparent py-1 text-[13px] font-medium outline-none placeholder:text-neutral-400"
          />
          <button
            type="button"
            onClick={onSend}
            disabled={isBusy || (!input.trim() && references.length === 0)}
            className="mb-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-studio-brown text-[#f3f1ec] disabled:opacity-30"
          >
            {isBusy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ArrowUp className="h-4 w-4" strokeWidth={2} />
            )}
          </button>
          </div>
        </div>
      </div>
    </aside>
  );
}

function ChatRichText({ content }: { content: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const html = chatContentToHtml(content);

  useEffect(() => {
    const timer = window.setTimeout(() => typesetEditor(ref.current), 90);
    return () => window.clearTimeout(timer);
  }, [html]);

  return (
    <div
      ref={ref}
      className="studio-chat-richtext leading-relaxed"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

/** Detect stored assistant content that is already an HTML fragment. */
function looksLikeStoredHtml(value: string): boolean {
  const s = String(value || '').trim();
  if (!s.startsWith('<')) return false;
  return /<\/?(?:p|h[1-6]|ul|ol|li|div|span|table|blockquote|pre|strong|em|br)\b/i.test(s);
}

/**
 * Soft-sanitize HTML that was already stored as a chat fragment so reload
 * keeps the bubble layout instead of showing raw tags like `<p>…`.
 */
function sanitizeStoredChatHtml(value: string): string {
  let html = String(value || '');
  // Drop script/style completely.
  html = html.replace(/<script\b[\s\S]*?<\/script>/gi, '');
  html = html.replace(/<style\b[\s\S]*?<\/style>/gi, '');
  html = html.replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '');
  html = html.replace(/\sstyle\s*=\s*("[^"]*"|'[^']*')/gi, '');
  // Keep a narrow allowlist; unwrap everything else.
  const allowed = new Set([
    'p', 'br', 'strong', 'b', 'em', 'i', 'u', 'code', 'pre', 'ul', 'ol', 'li',
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'a', 'span', 'div',
    'table', 'thead', 'tbody', 'tr', 'th', 'td', 'sup', 'sub',
  ]);
  html = html.replace(/<\/?([a-z][\w-]*)\b[^>]*>/gi, (match, rawTag: string) => {
    const tag = rawTag.toLowerCase();
    if (!allowed.has(tag)) return '';
    if (tag === 'a') {
      const href = match.match(/\bhref\s*=\s*("([^"]*)"|'([^']*)')/i);
      const url = (href?.[2] || href?.[3] || '').trim();
      if (match.startsWith('</')) return '</a>';
      if (/^https?:\/\//i.test(url)) {
        return `<a href="${escapeHtml(url)}" target="_blank" rel="noreferrer">`;
      }
      return '<span>';
    }
    if (match.startsWith('</')) return `</${tag}>`;
    if (tag === 'br') return '<br />';
    if (tag === 'span' || tag === 'div') {
      if (/studio-math|studio-chat-math|data-tex/i.test(match)) {
        // Preserve math host markup; strip other attrs below.
        const tex = match.match(/\bdata-tex\s*=\s*("([^"]*)"|'([^']*)')/i);
        const display = /data-display\s*=\s*["']?1/i.test(match) || /studio-math-block/i.test(match);
        if (tex) {
          const t = escapeHtml(tex[2] || tex[3] || '');
          return display
            ? `<div class="studio-chat-math studio-math-block" data-tex="${t}" data-display="1">`
            : `<span class="studio-chat-math studio-math-inline" data-tex="${t}" data-display="0">`;
        }
      }
      return tag === 'div' ? '<div>' : '<span>';
    }
    return `<${tag}>`;
  });
  // If sanitizing emptied everything, fall back to escaped plain text.
  if (!html.replace(/<[^>]+>/g, '').trim()) {
    return `<p>${escapeHtml(String(value || ''))}</p>`;
  }
  return html;
}

function chatContentToHtml(value: string): string {
  const raw = String(value || '').replace(/\r/g, '');
  // After reload, some older turns were saved as HTML fragments. Render them
  // as HTML so the bubble keeps structure instead of showing literal <p> tags.
  if (looksLikeStoredHtml(raw)) {
    return sanitizeStoredChatHtml(raw);
  }

  const lines = raw.split('\n');
  const out: string[] = [];
  let inCode = false;
  let codeLanguage = '';
  let codeLines: string[] = [];
  let list: 'ul' | 'ol' | null = null;
  let paragraph: string[] = [];

  const closeList = () => {
    if (list) {
      out.push(`</${list}>`);
      list = null;
    }
  };
  const flushParagraph = () => {
    if (!paragraph.length) return;
    out.push(`<p>${paragraph.map(renderInlineMarkdown).join('<br />')}</p>`);
    paragraph = [];
  };

  for (const rawLine of lines) {
    const fence = rawLine.match(/^\s*```\s*([\w-]*)\s*$/);
    if (fence) {
      if (inCode) {
        out.push(`<pre><code${codeLanguage ? ` data-language="${escapeHtml(codeLanguage)}"` : ''}>${codeLines.join('\n')}</code></pre>`);
        inCode = false;
        codeLanguage = '';
        codeLines = [];
      } else {
        flushParagraph();
        closeList();
        inCode = true;
        codeLanguage = fence[1] || '';
      }
      continue;
    }
    if (inCode) {
      codeLines.push(escapeHtml(rawLine));
      continue;
    }

    const heading = rawLine.match(/^\s*(#{1,6})\s+(.+?)\s*#*\s*$/);
    if (heading) {
      flushParagraph();
      closeList();
      const level = heading[1].length;
      out.push(`<h${level}>${renderInlineMarkdown(escapeHtml(heading[2]))}</h${level}>`);
      continue;
    }

    const unordered = rawLine.match(/^\s*[-*+]\s+(.+)$/);
    const ordered = rawLine.match(/^\s*\d+[.)]\s+(.+)$/);
    if (unordered || ordered) {
      flushParagraph();
      const nextList = ordered ? 'ol' : 'ul';
      if (list !== nextList) {
        closeList();
        list = nextList;
        out.push(`<${list}>`);
      }
      out.push(`<li>${renderInlineMarkdown(escapeHtml((ordered || unordered)![1]))}</li>`);
      continue;
    }

    const quote = rawLine.match(/^\s*>\s?(.*)$/);
    if (quote) {
      flushParagraph();
      closeList();
      out.push(`<blockquote>${renderInlineMarkdown(escapeHtml(quote[1]))}</blockquote>`);
      continue;
    }

    if (!rawLine.trim()) {
      flushParagraph();
      closeList();
      continue;
    }
    closeList();
    paragraph.push(escapeHtml(rawLine));
  }

  if (inCode) out.push(`<pre><code>${codeLines.join('\n')}</code></pre>`);
  flushParagraph();
  closeList();
  return out.join('');
}

function renderInlineMarkdown(value: string): string {
  let html = value;
  html = html.replace(/`([^`\n]+)`/g, '<code>$1</code>');
  html = html.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer">$1</a>');
  html = html.replace(/\*\*([^\n]+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/__([^\n]+?)__/g, '<strong>$1</strong>');
  html = html.replace(/(?<!\*)\*([^\n*]+?)\*(?!\*)/g, '<em>$1</em>');
  html = html.replace(/(?<!_)_([^\n_]+?)_(?!_)/g, '<em>$1</em>');
  html = html.replace(/\\\[([\s\S]*?)\\\]/g, '<div class="studio-chat-math studio-math-block">\\[$1\\]</div>');
  html = html.replace(/\\\(([^\n]+?)\\\)/g, '<span class="studio-chat-math studio-math-inline">\\($1\\)</span>');
  return html;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
