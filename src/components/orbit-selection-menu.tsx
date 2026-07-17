'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import {
  ArrowUp,
  GraduationCap,
  Maximize2,
  Minimize2,
  SpellCheck,
  Wand2,
  X,
} from 'lucide-react';

export type OrbitAction = 'improve' | 'shorter' | 'expand' | 'grammar' | 'academic';

type Props = {
  top: number;
  left: number;
  busy?: boolean;
  onSubmit: (action: OrbitAction, intensity: number) => void;
  onClose: () => void;
};

const ACTIONS: { id: OrbitAction; label: string; icon: ReactNode }[] = [
  { id: 'improve', label: 'Improve', icon: <Wand2 className="h-3.5 w-3.5" strokeWidth={1.75} /> },
  { id: 'shorter', label: 'Shorter', icon: <Minimize2 className="h-3.5 w-3.5" strokeWidth={1.75} /> },
  { id: 'expand', label: 'Expand', icon: <Maximize2 className="h-3.5 w-3.5" strokeWidth={1.75} /> },
  { id: 'grammar', label: 'Grammar', icon: <SpellCheck className="h-3.5 w-3.5" strokeWidth={1.75} /> },
  { id: 'academic', label: 'Academic', icon: <GraduationCap className="h-3.5 w-3.5" strokeWidth={1.75} /> },
];

/**
 * Circular FAB → fans options upward in a row → pick action → intensity → send arrow.
 * Wrapper is pointer-events-none so page scroll never locks.
 */
export default function OrbitSelectionMenu({ top, left, busy, onSubmit, onClose }: Props) {
  const [open, setOpen] = useState(false);
  const [action, setAction] = useState<OrbitAction | null>(null);
  const [intensity, setIntensity] = useState(50);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (action) setAction(null);
        else if (open) setOpen(false);
        else onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [action, open, onClose]);

  const send = () => {
    if (!action || busy) return;
    onSubmit(action, intensity);
    setAction(null);
    setOpen(false);
    setIntensity(50);
  };

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
      <div className="pointer-events-auto relative flex flex-col items-center">
        {/* Options fan upward */}
        <div
          className={cn(
            'mb-2 flex items-center gap-1.5 transition-all duration-300 ease-out',
            open && !action
              ? 'translate-y-0 scale-100 opacity-100'
              : 'pointer-events-none translate-y-4 scale-75 opacity-0',
          )}
        >
          {ACTIONS.map((a, i) => (
            <button
              key={a.id}
              type="button"
              disabled={busy}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => setAction(a.id)}
              className={cn(
                'flex items-center gap-1 rounded-full border border-neutral-200 bg-white px-2.5 py-1.5',
                'text-[11px] font-medium text-neutral-700 shadow-lg shadow-black/10',
                'hover:border-neutral-900 hover:bg-neutral-50 active:scale-95',
                'transition-all duration-300 ease-out',
              )}
              style={{
                transitionDelay: open && !action ? `${i * 45}ms` : '0ms',
                transform:
                  open && !action
                    ? 'translateY(0) scale(1)'
                    : `translateY(${12 + i * 4}px) scale(0.85)`,
              }}
            >
              {a.icon}
              {a.label}
            </button>
          ))}
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              setOpen(false);
              setAction(null);
              onClose();
            }}
            className="flex h-8 w-8 items-center justify-center rounded-full border border-neutral-200 bg-white text-neutral-400 shadow-lg hover:text-neutral-800"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Intensity card */}
        <div
          className={cn(
            'mb-2 w-56 origin-bottom rounded-2xl border border-neutral-200 bg-white p-3 shadow-xl shadow-black/10',
            'transition-all duration-200 ease-out',
            action
              ? 'translate-y-0 scale-100 opacity-100'
              : 'pointer-events-none translate-y-3 scale-90 opacity-0',
          )}
        >
          <div className="mb-2 flex items-center justify-between text-[11px]">
            <span className="font-semibold text-neutral-800">
              {ACTIONS.find((a) => a.id === action)?.label || 'Intensity'}
            </span>
            <span className="font-mono text-neutral-400">{intensity}%</span>
          </div>
          <input
            type="range"
            min={10}
            max={100}
            step={5}
            value={intensity}
            onChange={(e) => setIntensity(Number(e.target.value))}
            className="w-full accent-neutral-900"
          />
          <div className="mt-1 flex justify-between text-[10px] text-neutral-400">
            <span>Subtle</span>
            <span>Strong</span>
          </div>
        </div>

        {/* FAB → Send */}
        <button
          type="button"
          disabled={busy}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => {
            if (action) send();
            else setOpen((v) => !v);
          }}
          className={cn(
            'flex h-11 w-11 items-center justify-center rounded-full border shadow-lg transition-all duration-200',
            action
              ? 'border-neutral-900 bg-neutral-900 text-white hover:bg-neutral-800 hover:scale-105'
              : open
                ? 'border-neutral-300 bg-white text-neutral-800 ring-4 ring-neutral-900/5'
                : 'border-neutral-900 bg-neutral-900 text-white hover:scale-105',
            busy && 'opacity-50',
          )}
          title={action ? 'Send' : 'AI tools'}
        >
          {action ? (
            <ArrowUp className="h-4 w-4" strokeWidth={2.25} />
          ) : (
            <span className="text-[12px] font-semibold tracking-tight">AI</span>
          )}
        </button>
      </div>
    </div>
  );
}
