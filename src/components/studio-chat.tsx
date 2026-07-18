'use client';

import { useEffect, useRef } from 'react';
import type { ProposeEditPayload } from '@/lib/doc-tools';
import ThinkingShine from '@/components/thinking-shine';
import DraftStreamCard from '@/components/draft-stream-card';
import ToolLog, { type ToolLogItem } from '@/components/tool-log';
import EditDiffCard from '@/components/edit-diff-card';
import BrandMark from '@/components/brand-mark';
import { ArrowUp, Loader2 } from 'lucide-react';
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
  onAcceptEditPart,
  onRejectEditPart,
}: Props) {
  const listRef = useRef<HTMLDivElement>(null);
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

        {messages.map((m) => {
          if (m.isDraftStream) {
            return (
              <DraftStreamCard
                key={m.id}
                html={m.draftHtml || ''}
                status={m.draftStatus || m.content}
                done={!m.streaming}
              />
            );
          }
          if (m.role === 'user') {
            return (
              <div key={m.id} className="flex justify-end">
                <div className="max-w-[92%] rounded-2xl rounded-br-md bg-studio-brown px-3.5 py-2.5 text-[13px] font-medium leading-relaxed text-[#f3f1ec]">
                  {m.content}
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
              key={m.id}
              className="max-w-[95%] space-y-1.5 text-[13.5px] font-medium leading-relaxed text-neutral-800"
            >
              {/* Live thinking only while this message is streaming AND busy */}
              {m.streaming && showThinking && !tools.some((t) => t.state === 'running') && (
                <ThinkingShine label={activeStep?.label || 'Pensando…'} />
              )}

              <ToolLog items={tools} />

              {hasBody && <ChatRichText content={m.content} />}

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
        <div className="flex items-end gap-1.5 rounded-2xl border border-neutral-200 bg-neutral-50 px-2.5 py-2">
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
            disabled={isBusy || !input.trim()}
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

function chatContentToHtml(value: string): string {
  let html = escapeHtml(value || '');
  html = html.replace(/```(?:html|latex|tex)?\s*([\s\S]*?)```/gi, '<pre><code>$1</code></pre>');
  html = html.replace(/\\\[([\s\S]*?)\\\]/g, '<div class="studio-chat-math studio-math-block">\\[$1\\]</div>');
  html = html.replace(/\\\(([^\n]+?)\\\)/g, '<span class="studio-chat-math studio-math-inline">\\($1\\)</span>');
  html = html.replace(/\*\*([^\n]+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/(?<!\*)\*([^\n*]+?)\*(?!\*)/g, '<em>$1</em>');
  return html.replace(/\n/g, '<br />');
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
