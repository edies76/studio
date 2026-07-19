'use client';

import { useEffect, useRef, useState } from 'react';
import {
  ArrowUp,
  Check,
  Loader2,
  MessageSquare,
  Square,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ToolLogItem } from '@/components/tool-log';
import type { ProposeEditPayload } from '@/lib/doc-tools';

export type FloatingReview = {
  id: string;
  edit: ProposeEditPayload;
  status: 'pending' | 'accepted' | 'rejected';
};

type Props = {
  open: boolean;
  onClose: () => void;
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  busy?: boolean;
  busyLabel?: string | null;
  elapsedSeconds?: number;
  onStop?: () => void;
  toolLogs?: ToolLogItem[];
  statusLine?: string | null;
  onOpenPanel?: () => void;
  hasSelection?: boolean;
  selectionPreview?: string;
  onClearSelection?: () => void;
  mode?: 'chat' | 'edit';
  reviews?: FloatingReview[];
  activeReviewId?: string | null;
  onSelectReview?: (id: string) => void;
  onAcceptReview?: (id: string) => void;
  onRejectReview?: (id: string) => void;
  onAcceptAll?: () => void;
  onRejectAll?: () => void;
  className?: string;
  /** Soft auto-focus after open animation (not instant select) */
  softFocus?: boolean;
  /** Pasted/attached image (data URL) shown as a chip; agent uses vision if the current model supports it, or explains it needs a vision-capable model otherwise. */
  attachedImage?: string | null;
  onAttachImage?: (dataUrl: string | null) => void;
};

/**
 * Ephemeral agent input.
 * Enter/exit: scale from center + opacity (not slide up/down).
 * Click outside closes only if input is empty (draft text is kept).
 */
export default function FloatingComposer({
  open,
  onClose,
  value,
  onChange,
  onSend,
  busy,
  busyLabel,
  elapsedSeconds = 0,
  onStop,
  toolLogs = [],
  statusLine,
  onOpenPanel,
  hasSelection,
  selectionPreview,
  onClearSelection,
  mode = 'chat',
  reviews = [],
  activeReviewId,
  onSelectReview,
  onAcceptReview,
  onRejectReview,
  onAcceptAll,
  onRejectAll,
  className,
  softFocus = true,
  attachedImage,
  onAttachImage,
}: Props) {
  const [phase, setPhase] = useState<'out' | 'in'>('out');
  const [mounted, setMounted] = useState(false);
  const [focused, setFocused] = useState(false);
  const [sentPulse, setSentPulse] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const pending = reviews.filter((r) => r.status === 'pending');
  const active = pending.find((p) => p.id === activeReviewId) || pending[0] || null;
  const hasDraft = Boolean(value.trim());

  // Mount / unmount with center scale animation
  useEffect(() => {
    if (open) {
      setMounted(true);
      // Start small, then expand to full (center scale)
      setPhase('out');
      const t1 = requestAnimationFrame(() => {
        requestAnimationFrame(() => setPhase('in'));
      });
      // Soft focus after animation settles — no harsh instant select
      let t2: number | undefined;
      if (softFocus) {
        t2 = window.setTimeout(() => {
          const el = inputRef.current;
          if (!el) return;
          el.focus({ preventScroll: true });
          // Place caret at end without selecting all
          const len = el.value.length;
          el.setSelectionRange(len, len);
        }, 220);
      }
      return () => {
        cancelAnimationFrame(t1);
        if (t2) clearTimeout(t2);
      };
    }
    // Exit: scale inward + fade, then unmount
    setPhase('out');
    const t = window.setTimeout(() => setMounted(false), 240);
    return () => clearTimeout(t);
  }, [open, softFocus]);

  // Click outside: close only if empty (keep open while drafting)
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (busy || pending.length > 0) return;
      if (hasDraft) return; // keep open while typing draft
      const t = e.target as Node;
      if (rootRef.current && !rootRef.current.contains(t)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', onDown, true);
    return () => document.removeEventListener('mousedown', onDown, true);
  }, [open, busy, pending.length, hasDraft, onClose]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy && !hasDraft) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, busy, hasDraft, onClose]);

  if (!mounted && !open) return null;

  const send = () => {
    if (!value.trim() || busy) return;
    setSentPulse(true);
    window.setTimeout(() => setSentPulse(false), 420);
    onSend();
  };

  const wide = focused || hasDraft || busy || pending.length > 0;
  const isEdit = mode === 'edit' || hasSelection;
  const shown = open && phase === 'in';

  return (
    <div
      className={cn(
        'pointer-events-none absolute inset-x-0 bottom-6 z-40 flex justify-center px-4',
        className,
      )}
    >
      <div
        ref={rootRef}
        className={cn(
          'pointer-events-auto flex flex-col items-center',
          'transition-all duration-200 ease-[cubic-bezier(0.22,1,0.36,1)]',
          // Center scale (not slide Y)
          shown ? 'scale-100 opacity-100' : 'scale-[0.88] opacity-0',
        )}
        style={{ transformOrigin: 'center center' }}
      >
        {active && (
          <div className={cn('mb-2 w-full', wide ? 'max-w-lg' : 'max-w-sm')}>
            <div className="rounded-2xl border border-neutral-200 bg-white px-3 py-2.5 shadow-[0_12px_40px_rgba(0,0,0,0.12)]">
              <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center justify-end gap-1.5">
                    {pending.length > 1 && (
                      <div className="mr-auto flex max-w-[40%] gap-0.5 overflow-x-auto">
                        {pending.map((p, i) => (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => onSelectReview?.(p.id)}
                            className={cn(
                              'shrink-0 rounded-full px-2 py-0.5 font-mono text-[10px]',
                              p.id === active.id
                                ? 'bg-neutral-100 text-neutral-800'
                                : 'text-neutral-400 hover:bg-neutral-50',
                            )}
                          >
                            {i + 1}
                          </button>
                        ))}
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => onRejectReview?.(active.id)}
                      className="rounded-full border border-neutral-200 px-2.5 py-1 text-[11px] font-medium text-neutral-600 hover:bg-neutral-50"
                    >
                      Rechazar
                    </button>
                    <button
                      type="button"
                      onClick={() => onAcceptReview?.(active.id)}
                      className="inline-flex items-center gap-1 rounded-full bg-neutral-900 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-neutral-800"
                    >
                      <Check className="h-3 w-3" strokeWidth={2.5} />
                      Aceptar
                    </button>
                  </div>
                  <p className="mt-1.5 text-[12px] leading-snug text-neutral-600">
                    <span className="font-semibold text-neutral-800">{active.edit.title}</span>
                    {active.edit.summary ? ` — ${active.edit.summary.slice(0, 120)}` : ''}
                  </p>
                  {pending.length > 1 && (
                    <div className="mt-1.5 flex gap-2">
                      <button type="button" onClick={onRejectAll} className="text-[10px] text-neutral-400 hover:text-neutral-600">
                        Rechazar todo
                      </button>
                      <button type="button" onClick={onAcceptAll} className="text-[10px] font-medium text-neutral-700 hover:underline">
                        Aceptar todo
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {busy && toolLogs.length > 0 && (
          <div className="mb-1.5 w-full max-w-md rounded-xl border border-neutral-200 bg-white/95 px-2.5 py-1.5 text-[10px] text-neutral-500 shadow-sm">
            {toolLogs.slice(-3).map((t) => (
              <div key={t.id} className="truncate">
                {t.state === 'running' ? '… ' : '✓ '}
                {t.doneLabel || t.label}
              </div>
            ))}
          </div>
        )}

        <div
          className={cn(
            'floating-composer-shell relative origin-center overflow-hidden rounded-full',
            'border border-neutral-200/95 bg-white',
            // Stronger professional shadow
            'shadow-[0_16px_48px_rgba(0,0,0,0.14),0_4px_12px_rgba(0,0,0,0.06)]',
            'transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]',
            wide ? 'w-[min(28rem,88vw)]' : 'w-[min(16rem,72vw)]',
            focused && 'border-neutral-300 shadow-[0_20px_56px_rgba(0,0,0,0.16),0_6px_16px_rgba(0,0,0,0.08)]',
            busy && 'ring-2 ring-studio-brown/15',
            sentPulse && 'floating-composer-sent',
          )}
        >
          <div className="flex items-center gap-1.5 px-2 py-1.5">
            <span
              className={cn(
                'flex h-8 w-8 shrink-0 items-center justify-center rounded-full',
                busy ? 'text-studio-brown' : 'text-neutral-400',
              )}
            >
              {busy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <span className="h-1.5 w-1.5 rounded-full bg-studio-brown/70" aria-hidden />
              )}
            </span>

            {busy ? (
              <div className="flex min-w-0 flex-1 items-center gap-2 py-2">
                <p className="min-w-0 flex-1 truncate text-[13px] font-medium text-neutral-700">
                  {busyLabel || 'Trabajando…'}
                </p>
                <span className="shrink-0 font-mono text-[10px] tabular-nums text-neutral-400">
                  {elapsedSeconds.toFixed(1)} s
                </span>
              </div>
            ) : (
              <div className="flex min-w-0 flex-1 flex-col justify-center">
                {isEdit && (
                  <div className="mb-0.5 flex items-center gap-1 px-0.5">
                    <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-neutral-600">
                      Edición
                    </span>
                    {selectionPreview && (
                      <span className="truncate text-[10px] text-neutral-400">
                        {selectionPreview.slice(0, 36)}
                        {selectionPreview.length > 36 ? '…' : ''}
                      </span>
                    )}
                    {onClearSelection && (
                      <button
                        type="button"
                        onClick={onClearSelection}
                        className="rounded p-0.5 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"
                        title="Quitar selección"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                )}
                {attachedImage && (
                  <div className="mb-1 flex items-center gap-1.5">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={attachedImage}
                      alt="Imagen adjunta"
                      className="h-8 w-8 rounded-md border border-neutral-200 object-cover"
                    />
                    <span className="text-[10px] text-neutral-400">Imagen adjunta</span>
                    <button
                      type="button"
                      onClick={() => onAttachImage?.(null)}
                      className="rounded p-0.5 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"
                      title="Quitar imagen"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                )}
                <textarea
                  ref={inputRef}
                  value={value}
                  onChange={(e) => onChange(e.target.value)}
                  onFocus={() => setFocused(true)}
                  onBlur={() => setFocused(false)}
                  onPaste={(e) => {
                    if (!onAttachImage) return;
                    const item = Array.from(e.clipboardData?.items || []).find((it) => it.type.startsWith('image/'));
                    if (!item) return;
                    const file = item.getAsFile();
                    if (!file) return;
                    e.preventDefault();
                    const reader = new FileReader();
                    reader.onload = () => onAttachImage(String(reader.result || ''));
                    reader.readAsDataURL(file);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      send();
                    }
                  }}
                  rows={1}
                  disabled={busy}
                  placeholder={
                    isEdit ? 'What should we do with the selection…' : 'Message the agent… (Ctrl+V pega una imagen)'
                  }
                  className="max-h-16 min-h-[32px] w-full resize-none bg-transparent py-1.5 text-[13px] font-medium text-neutral-900 outline-none placeholder:text-neutral-400"
                />
              </div>
            )}

            {onOpenPanel && !busy && (
              <button
                type="button"
                title="Abrir panel de chat"
                onClick={onOpenPanel}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-neutral-500 transition hover:bg-neutral-100 hover:text-neutral-800"
              >
                <MessageSquare className="h-3.5 w-3.5" strokeWidth={1.75} />
              </button>
            )}

            {busy && onStop ? (
              <button
                type="button"
                onClick={onStop}
                title="Detener"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-studio-brown text-white shadow-md hover:bg-studio-brown-hover"
              >
                <Square className="h-3 w-3 fill-current" />
              </button>
            ) : (
              <button
                type="button"
                onClick={send}
                disabled={busy || !value.trim()}
                className={cn(
                  'flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-all',
                  'bg-neutral-900 text-white shadow-md hover:bg-neutral-800',
                  'disabled:opacity-30',
                  sentPulse && 'scale-90',
                )}
                title="Enviar"
              >
                <ArrowUp className="h-3.5 w-3.5" strokeWidth={2.25} />
              </button>
            )}
          </div>
        </div>

        {statusLine && !busy && !pending.length && (
          <p className="mt-1.5 max-w-[16rem] truncate text-center text-[10px] text-neutral-400">
            {statusLine}
          </p>
        )}
      </div>
    </div>
  );
}
