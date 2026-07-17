'use client';

import { useEffect, useState } from 'react';
import { ArrowUp, Loader2, X } from 'lucide-react';
import { cn } from '@/lib/utils';

type Props = {
  top: number;
  left: number;
  busy?: boolean;
  snippet: string;
  onSubmit: (prompt: string) => void;
  onClose: () => void;
};

/**
 * Selection bubble: freeform prompt about the selected text (not the tools dock).
 */
export default function SelectionPrompt({ top, left, busy, snippet, onSubmit, onClose }: Props) {
  const [prompt, setPrompt] = useState('');

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const send = () => {
    const t = prompt.trim();
    if (!t || busy) return;
    onSubmit(t);
    setPrompt('');
  };

  const preview = snippet.trim().slice(0, 80) + (snippet.trim().length > 80 ? '…' : '');

  return (
    <div
      data-selection-ui
      className="pointer-events-none absolute z-[60]"
      style={{
        top,
        left,
        transform: 'translateX(-50%)',
      }}
    >
      <div className="pointer-events-auto w-[min(320px,calc(100vw-2rem))] rounded-2xl border border-neutral-200 bg-white p-2.5 shadow-xl shadow-black/10">
        <div className="mb-1.5 flex items-start justify-between gap-2">
          <p className="line-clamp-2 text-[10px] leading-snug text-neutral-400">
            “{preview}”
          </p>
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={onClose}
            className="shrink-0 rounded-full p-0.5 text-neutral-400 hover:text-neutral-800"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
        <div
          className={cn(
            'flex items-end gap-1.5 rounded-xl border border-neutral-200 bg-neutral-50 px-2 py-1.5',
            busy && 'opacity-60',
          )}
        >
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onMouseDown={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            rows={2}
            disabled={busy}
            placeholder="Qué hacer con esta selección…"
            className="max-h-20 min-h-[40px] flex-1 resize-none bg-transparent text-[12px] outline-none placeholder:text-neutral-400"
            autoFocus
          />
          <button
            type="button"
            disabled={busy || !prompt.trim()}
            onMouseDown={(e) => e.preventDefault()}
            onClick={send}
            className="mb-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-neutral-900 text-white disabled:opacity-30"
          >
            {busy ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <ArrowUp className="h-3.5 w-3.5" strokeWidth={2.25} />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
