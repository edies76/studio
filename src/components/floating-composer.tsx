'use client';

import { useEffect, useRef, useState } from 'react';
import { ArrowUp, Loader2, MessageSquareText } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ToolLogItem } from '@/components/tool-log';
import ToolLog from '@/components/tool-log';

type Props = {
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  busy?: boolean;
  /** Compact tool log from latest assistant turn */
  toolLogs?: ToolLogItem[];
  /** Short status line e.g. "Listo, propuse 2 cambios" */
  statusLine?: string | null;
  onOpenPanel?: () => void;
  className?: string;
};

/**
 * Pill composer centered on canvas when chat panel is collapsed.
 * Brown SignalField-inspired styling; keeps only logs + short status above.
 */
export default function FloatingComposer({
  value,
  onChange,
  onSend,
  busy,
  toolLogs = [],
  statusLine,
  onOpenPanel,
  className,
}: Props) {
  const [focused, setFocused] = useState(false);
  const [sentPulse, setSentPulse] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!busy) inputRef.current?.focus({ preventScroll: true });
  }, [busy]);

  const send = () => {
    if (!value.trim() || busy) return;
    setSentPulse(true);
    window.setTimeout(() => setSentPulse(false), 420);
    onSend();
  };

  const hasMeta = toolLogs.length > 0 || Boolean(statusLine);

  return (
    <div
      className={cn(
        'pointer-events-none absolute inset-x-0 bottom-6 z-40 flex justify-center px-4',
        className,
      )}
    >
      <div className="pointer-events-auto flex w-full max-w-md flex-col items-center gap-2">
        {/* Compact logs + short line — not tall */}
        {hasMeta && (
          <div className="w-full max-h-28 overflow-y-auto rounded-2xl border border-[#d9d0c4]/80 bg-white/90 px-3 py-2 shadow-lg shadow-[#3d3229]/10 backdrop-blur-md">
            {toolLogs.length > 0 && <ToolLog items={toolLogs.slice(-6)} />}
            {statusLine && (
              <p className="mt-1 truncate text-[11px] font-medium text-[#5c4f42]">
                {statusLine}
              </p>
            )}
          </div>
        )}

        <div
          className={cn(
            'floating-composer-shell relative flex w-full items-end gap-2 rounded-full border px-2 py-1.5 shadow-xl transition-all duration-300',
            'border-[#c9bfb2] bg-[linear-gradient(180deg,#faf7f2_0%,#f3efe8_100%)]',
            focused && 'border-[#3d3229]/35 shadow-[0_12px_40px_rgba(61,50,41,0.14)] scale-[1.01]',
            sentPulse && 'floating-composer-sent',
            busy && 'opacity-90',
          )}
        >
          {/* soft brown glow ring */}
          <span
            className="pointer-events-none absolute -inset-px rounded-full opacity-40"
            style={{
              background:
                'radial-gradient(120% 80% at 50% 120%, rgba(61,50,41,0.12), transparent 55%)',
            }}
            aria-hidden
          />

          {onOpenPanel && (
            <button
              type="button"
              title="Abrir panel de chat"
              onClick={onOpenPanel}
              className="relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-studio-brown text-[#f3f1ec] shadow-md transition hover:bg-studio-brown-hover"
            >
              <MessageSquareText className="h-4 w-4" strokeWidth={1.75} />
            </button>
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
            }}
            rows={1}
            disabled={busy}
            placeholder="Escribí al agente…"
            className="relative z-10 max-h-20 min-h-[40px] w-full resize-none bg-transparent py-2.5 pr-1 text-[13px] font-medium text-[#2a221c] outline-none placeholder:text-[#9a9086]"
          />

          <button
            type="button"
            onClick={send}
            disabled={busy || !value.trim()}
            className={cn(
              'relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-all duration-200',
              'bg-studio-brown text-[#f3f1ec] shadow-md hover:bg-studio-brown-hover',
              'disabled:opacity-35',
              sentPulse && 'scale-90',
            )}
            title="Enviar"
          >
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ArrowUp className="h-4 w-4" strokeWidth={2.25} />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
