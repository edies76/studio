'use client';

import { useEffect, useRef } from 'react';
import type { ProposeEditPayload } from '@/lib/doc-tools';
import ThinkingShine from '@/components/thinking-shine';
import DraftStreamCard from '@/components/draft-stream-card';
import BrandMark from '@/components/brand-mark';
import { ArrowUp, History, Loader2 } from 'lucide-react';

export type ChatMessage = {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  streaming?: boolean;
  draftHtml?: string;
  draftStatus?: string;
  isDraftStream?: boolean;
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
  isBusy: boolean;
  onQuickAction?: (prompt: string) => void;
  exportSlot?: React.ReactNode;
  historyCount?: number;
  onOpenHistory?: () => void;
};

const QUICK = [
  { label: 'Revolución industrial', prompt: 'Escribí un documento completo sobre la Revolución Industrial.' },
  { label: 'Ensayo APA', prompt: 'Redactá un ensayo académico corto con estructura APA.' },
  { label: 'Informe corto', prompt: 'Generá un informe académico corto y bien estructurado.' },
];

export default function StudioChat({
  messages,
  activity,
  pendingEdits: _pending,
  input,
  onInputChange,
  onSend,
  isBusy,
  onQuickAction,
  exportSlot,
  historyCount = 0,
  onOpenHistory,
}: Props) {
  const listRef = useRef<HTMLDivElement>(null);
  const activeStep = activity.find((a) => a.state === 'active');

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages, activity, isBusy]);

  return (
    <aside className="relative flex h-full min-h-0 w-full min-w-0 max-w-[400px] flex-col overflow-hidden border-l border-neutral-200 bg-white font-['Segoe_UI',Tahoma,Geneva,Verdana,sans-serif]">
      {exportSlot && (
        <div className="pointer-events-none absolute right-3 top-3 z-20">
          <div className="pointer-events-auto">{exportSlot}</div>
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
                <div className="max-w-[92%] rounded-2xl rounded-br-md bg-[#2c2a26] px-3.5 py-2.5 text-[13px] font-medium leading-relaxed text-[#f3f1ec]">
                  {m.content}
                </div>
              </div>
            );
          }
          if (m.role === 'system') {
            return null; // history lives in drawer
          }
          if (m.streaming && !m.content.trim()) {
            return <ThinkingShine key={m.id} label={activeStep?.label || 'Pensando…'} />;
          }
          return (
            <div
              key={m.id}
              className="max-w-[95%] text-[13.5px] font-medium leading-relaxed text-neutral-800"
            >
              <div className="whitespace-pre-wrap">{m.content}</div>
              {m.streaming && (
                <span className="ml-0.5 inline-block h-3 w-1 animate-pulse bg-neutral-400 align-middle" />
              )}
            </div>
          );
        })}

        {isBusy && messages.every((m) => !m.streaming) && (
          <ThinkingShine label={activeStep?.label || 'Pensando…'} />
        )}
      </div>

      <div className="shrink-0 bg-white px-3 pb-3 pt-1">
        <div className="flex items-end gap-1.5 rounded-2xl border border-neutral-200 bg-neutral-50 px-2.5 py-2">
          {onOpenHistory && (
            <button
              type="button"
              title="Historial de cambios"
              onClick={onOpenHistory}
              className="relative mb-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-neutral-500 hover:bg-neutral-200/80 hover:text-neutral-900"
            >
              <History className="h-4 w-4" strokeWidth={1.75} />
              {historyCount > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-neutral-900 px-0.5 text-[9px] font-bold text-white">
                  {historyCount > 9 ? '9+' : historyCount}
                </span>
              )}
            </button>
          )}
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
            className="mb-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#2c2a26] text-[#f3f1ec] disabled:opacity-30"
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
