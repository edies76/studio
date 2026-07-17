'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  ArrowUp,
  Check,
  Loader2,
  MessageSquare,
  Sparkles,
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
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  busy?: boolean;
  /** Live activity label while agent works */
  busyLabel?: string | null;
  onStop?: () => void;
  toolLogs?: ToolLogItem[];
  /** Short free-text status when idle after a reply */
  statusLine?: string | null;
  onOpenPanel?: () => void;
  /** Selection context — no quotes, just a chip */
  hasSelection?: boolean;
  selectionPreview?: string;
  onClearSelection?: () => void;
  /** Pending AI edits — review UI lives here (not a separate bar) */
  reviews?: FloatingReview[];
  activeReviewId?: string | null;
  onSelectReview?: (id: string) => void;
  onAcceptReview?: (id: string) => void;
  onRejectReview?: (id: string) => void;
  onAcceptAll?: () => void;
  onRejectAll?: () => void;
  /** Zoom slider under the pill */
  zoom?: number;
  onZoom?: (z: number) => void;
  /** Slot for tools dock (left of pill) */
  toolsSlot?: ReactNode;
  className?: string;
  /** Increment to force-expand (e.g. after text selection) */
  forceExpandKey?: number;
  onExpandedChange?: (expanded: boolean) => void;
};

/**
 * Center floating agent control:
 * - Collapsed: small elongated pill (hover → expand)
 * - Expanded: narrow pill; focus → wider (springy)
 * - Click outside → shrink to pill from center
 * - Busy: HyperWrite-style status + stop
 * - Review: compact accept/reject card above
 */
export default function FloatingComposer({
  value,
  onChange,
  onSend,
  busy,
  busyLabel,
  onStop,
  toolLogs = [],
  statusLine,
  onOpenPanel,
  hasSelection,
  selectionPreview,
  onClearSelection,
  reviews = [],
  activeReviewId,
  onSelectReview,
  onAcceptReview,
  onRejectReview,
  onAcceptAll,
  onRejectAll,
  zoom = 1,
  onZoom,
  toolsSlot,
  className,
  forceExpandKey = 0,
  onExpandedChange,
}: Props) {
  const [expanded, setExpanded] = useState(true);
  const [focused, setFocused] = useState(false);
  const [sentPulse, setSentPulse] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(true);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const pending = reviews.filter((r) => r.status === 'pending');
  const active = pending.find((p) => p.id === activeReviewId) || pending[0] || null;

  useEffect(() => {
    if (!forceExpandKey) return;
    setExpanded(true);
    onExpandedChange?.(true);
    requestAnimationFrame(() => inputRef.current?.focus({ preventScroll: true }));
  }, [forceExpandKey, onExpandedChange]);

  // Keep open while busy or reviewing
  useEffect(() => {
    if (busy || pending.length > 0) {
      setExpanded(true);
    }
  }, [busy, pending.length]);

  // Click outside → collapse (unless busy / focused typing)
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!rootRef.current?.contains(t)) {
        if (busy || pending.length > 0) return;
        if (document.activeElement === inputRef.current && value.trim()) return;
        setExpanded(false);
        setFocused(false);
        onExpandedChange?.(false);
      }
    };
    document.addEventListener('mousedown', onDown, true);
    return () => document.removeEventListener('mousedown', onDown, true);
  }, [busy, pending.length, value, onExpandedChange]);

  const expand = () => {
    setExpanded(true);
    onExpandedChange?.(true);
    requestAnimationFrame(() => inputRef.current?.focus({ preventScroll: true }));
  };

  const send = () => {
    if (!value.trim() || busy) return;
    setSentPulse(true);
    window.setTimeout(() => setSentPulse(false), 420);
    onSend();
  };

  const wide = focused || value.trim().length > 0 || busy || pending.length > 0;

  const pct = Math.round(zoom * 100);

  return (
    <div
      className={cn(
        'pointer-events-none absolute inset-x-0 bottom-5 z-40 flex justify-center px-4',
        className,
      )}
    >
      <div
        ref={rootRef}
        className="pointer-events-auto flex flex-col items-center"
        onMouseEnter={() => {
          if (hoverTimer.current) clearTimeout(hoverTimer.current);
          if (!expanded) {
            hoverTimer.current = setTimeout(() => expand(), 80);
          }
        }}
        onMouseLeave={() => {
          if (hoverTimer.current) clearTimeout(hoverTimer.current);
        }}
      >
        {/* —— Review card (HyperWrite-like) —— */}
        <div
          className={cn(
            'mb-2 w-full overflow-hidden transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]',
            expanded && pending.length > 0 && reviewOpen
              ? 'max-h-48 translate-y-0 opacity-100'
              : 'max-h-0 -translate-y-2 opacity-0 pointer-events-none',
            wide ? 'max-w-lg' : 'max-w-sm',
          )}
        >
          {active && (
            <div className="rounded-2xl border border-[#d4e3f7] bg-white/95 px-3 py-2.5 shadow-lg shadow-blue-500/5 backdrop-blur-md">
              <div className="flex items-start gap-2">
                <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-blue-500" strokeWidth={1.75} />
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
                                ? 'bg-blue-50 text-blue-700'
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
                      className="inline-flex items-center gap-1 rounded-full bg-blue-500 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-blue-600"
                    >
                      <Check className="h-3 w-3" strokeWidth={2.5} />
                      Aceptar
                    </button>
                  </div>
                  <p className="mt-1.5 text-[12px] leading-snug text-neutral-600">
                    <span className="font-semibold text-neutral-800">{active.edit.title}</span>
                    {active.edit.summary ? ` — ${active.edit.summary.slice(0, 120)}` : ''}
                    {(active.edit.summary?.length || 0) > 120 && (
                      <button
                        type="button"
                        className="ml-1 font-medium text-blue-600 hover:underline"
                        onClick={() => setReviewOpen((v) => v)}
                      >
                        Mostrar más
                      </button>
                    )}
                  </p>
                  {pending.length > 1 && (
                    <div className="mt-1.5 flex gap-2">
                      <button
                        type="button"
                        onClick={onRejectAll}
                        className="text-[10px] text-neutral-400 hover:text-neutral-600"
                      >
                        Rechazar todo
                      </button>
                      <button
                        type="button"
                        onClick={onAcceptAll}
                        className="text-[10px] font-medium text-blue-600 hover:underline"
                      >
                        Aceptar todo
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* —— Compact tool log while busy —— */}
        <div
          className={cn(
            'mb-1.5 w-full overflow-hidden transition-all duration-300',
            expanded && busy && toolLogs.length
              ? 'max-h-20 opacity-100'
              : 'max-h-0 opacity-0',
            wide ? 'max-w-md' : 'max-w-xs',
          )}
        >
          {busy && toolLogs.length > 0 && (
            <div className="rounded-xl border border-neutral-200/80 bg-white/90 px-2.5 py-1.5 text-[10px] text-neutral-500 shadow-sm backdrop-blur">
              {toolLogs.slice(-3).map((t) => (
                <div key={t.id} className="truncate">
                  {t.state === 'running' ? '… ' : '✓ '}
                  {t.doneLabel || t.label}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* —— Tools + composer row —— */}
        <div className="flex items-end gap-2">
          {/* Tools dock to the LEFT */}
          <div
            className={cn(
              'transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]',
              expanded ? 'translate-x-0 scale-100 opacity-100' : 'pointer-events-none w-0 scale-75 opacity-0',
            )}
          >
            {toolsSlot}
          </div>

          <div className="flex flex-col items-center">
            {/* Main pill — grows/shrinks from center */}
            <div
              className={cn(
                'floating-composer-shell relative origin-center overflow-hidden',
                'border border-[#c9bfb2]/90 bg-[linear-gradient(180deg,#faf8f5_0%,#f4f0ea_100%)]',
                'shadow-[0_8px_32px_rgba(61,50,41,0.12)]',
                'transition-all duration-350 ease-[cubic-bezier(0.22,1,0.36,1)]',
                expanded
                  ? cn(
                      'rounded-full',
                      wide ? 'w-[min(28rem,88vw)]' : 'w-[min(20rem,78vw)]',
                      'scale-100 opacity-100',
                    )
                  : 'h-3 w-16 cursor-pointer rounded-full opacity-90 hover:w-20 hover:opacity-100',
                focused && expanded && 'border-[#3d3229]/30 shadow-[0_12px_40px_rgba(61,50,41,0.16)]',
                sentPulse && 'floating-composer-sent',
                busy && expanded && 'ring-2 ring-blue-400/25',
              )}
              onClick={() => {
                if (!expanded) expand();
              }}
              role={expanded ? undefined : 'button'}
              title={expanded ? undefined : 'Abrir agente'}
            >
              {expanded && (
                <div className="flex items-center gap-1.5 px-2 py-1.5">
                  {/* Soft sparkle / busy indicator */}
                  <span
                    className={cn(
                      'flex h-8 w-8 shrink-0 items-center justify-center rounded-full',
                      busy ? 'text-blue-500' : 'text-[#8a7e72]',
                    )}
                  >
                    {busy ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Sparkles className="h-3.5 w-3.5" strokeWidth={1.75} />
                    )}
                  </span>

                  {busy ? (
                    <p className="min-w-0 flex-1 truncate py-2 text-[13px] font-medium text-neutral-700">
                      {busyLabel || 'Trabajando…'}
                    </p>
                  ) : (
                    <div className="flex min-w-0 flex-1 flex-col justify-center">
                      {hasSelection && (
                        <div className="mb-0.5 flex items-center gap-1 px-0.5">
                          <span className="rounded-full bg-[#3d3229]/8 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-[#3d3229]">
                            Selección
                          </span>
                          {selectionPreview && (
                            <span className="truncate text-[10px] text-neutral-400">
                              {selectionPreview.slice(0, 40)}
                              {selectionPreview.length > 40 ? '…' : ''}
                            </span>
                          )}
                          {onClearSelection && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onClearSelection();
                              }}
                              className="rounded p-0.5 text-neutral-400 hover:text-neutral-700"
                              title="Quitar selección"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          )}
                        </div>
                      )}
                      <textarea
                        ref={inputRef}
                        value={value}
                        onChange={(e) => onChange(e.target.value)}
                        onFocus={() => setFocused(true)}
                        onBlur={() => setFocused(false)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            send();
                          }
                          if (e.key === 'Escape') {
                            setExpanded(false);
                            onExpandedChange?.(false);
                            (e.target as HTMLTextAreaElement).blur();
                          }
                        }}
                        rows={1}
                        disabled={busy}
                        placeholder={
                          hasSelection
                            ? 'Qué querés hacer con la selección…'
                            : 'Escribí al agente…'
                        }
                        className="max-h-16 min-h-[32px] w-full resize-none bg-transparent py-1.5 text-[13px] font-medium text-[#2a221c] outline-none placeholder:text-[#9a9086]"
                      />
                    </div>
                  )}

                  {/* Minimal chat panel opener — inside the pill */}
                  {onOpenPanel && !busy && (
                    <button
                      type="button"
                      title="Abrir panel de chat"
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenPanel();
                      }}
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[#6b6258] transition hover:bg-[#3d3229]/8 hover:text-[#3d3229]"
                    >
                      <MessageSquare className="h-3.5 w-3.5" strokeWidth={1.75} />
                    </button>
                  )}

                  {busy && onStop ? (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onStop();
                      }}
                      title="Detener"
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-500 text-white shadow-md hover:bg-blue-600"
                    >
                      <Square className="h-3 w-3 fill-current" />
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        send();
                      }}
                      disabled={busy || !value.trim()}
                      className={cn(
                        'flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-all',
                        'bg-[#3d3229] text-[#f3f1ec] shadow-md hover:bg-[#2a221c]',
                        'disabled:opacity-30',
                        sentPulse && 'scale-90',
                      )}
                      title="Enviar"
                    >
                      <ArrowUp className="h-3.5 w-3.5" strokeWidth={2.25} />
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Idle status under pill (short) */}
            {expanded && !busy && statusLine && !pending.length && (
              <p className="mt-1.5 max-w-[16rem] truncate text-center text-[10px] text-neutral-400">
                {statusLine}
              </p>
            )}

            {/* Zoom as a thin slidable line under the composer */}
            {expanded && onZoom && (
              <div
                data-selection-ui
                className="mt-2 flex w-full max-w-[14rem] items-center gap-2 px-1 opacity-70 transition hover:opacity-100"
              >
                <span className="font-mono text-[9px] text-neutral-400">−</span>
                <input
                  type="range"
                  min={50}
                  max={200}
                  step={5}
                  value={pct}
                  onChange={(e) => onZoom(Number(e.target.value) / 100)}
                  className="studio-zoom-range h-1 w-full cursor-pointer appearance-none rounded-full bg-neutral-300 accent-[#3d3229]"
                  title={`Zoom ${pct}%`}
                />
                <span className="min-w-[2rem] text-right font-mono text-[9px] tabular-nums text-neutral-400">
                  {pct}%
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
