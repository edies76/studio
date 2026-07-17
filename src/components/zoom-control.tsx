'use client';

import { Minus, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';

type Props = {
  zoom: number;
  onZoom: (z: number) => void;
};

export default function ZoomControl({ zoom, onZoom }: Props) {
  const pct = Math.round(zoom * 100);
  const set = (z: number) => onZoom(Math.min(2, Math.max(0.5, Math.round(z * 20) / 20)));

  return (
    <div
      data-selection-ui
      className="pointer-events-auto flex items-center gap-0.5 rounded-full border border-neutral-200 bg-white/95 px-1 py-1 shadow-lg backdrop-blur"
    >
      <button
        type="button"
        title="Alejar (Ctrl −)"
        onClick={() => set(zoom - 0.1)}
        className="flex h-7 w-7 items-center justify-center rounded-full text-neutral-600 hover:bg-neutral-100"
      >
        <Minus className="h-3.5 w-3.5" strokeWidth={2} />
      </button>
      <button
        type="button"
        title="100%"
        onClick={() => set(1)}
        className={cn(
          'min-w-[3rem] px-1 text-center font-mono text-[11px] font-medium tabular-nums',
          pct === 100 ? 'text-neutral-900' : 'text-neutral-500',
        )}
      >
        {pct}%
      </button>
      <button
        type="button"
        title="Acercar (Ctrl +)"
        onClick={() => set(zoom + 0.1)}
        className="flex h-7 w-7 items-center justify-center rounded-full text-neutral-600 hover:bg-neutral-100"
      >
        <Plus className="h-3.5 w-3.5" strokeWidth={2} />
      </button>
    </div>
  );
}
