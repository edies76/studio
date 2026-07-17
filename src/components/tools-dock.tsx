'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import {
  GraduationCap,
  Maximize2,
  Minimize2,
  SpellCheck,
  Wand2,
  Wrench,
} from 'lucide-react';

export type OrbitAction = 'improve' | 'shorter' | 'expand' | 'grammar' | 'academic';

type Props = {
  busy?: boolean;
  hasSelection?: boolean;
  onAction: (action: OrbitAction, intensity: number) => void;
};

const ACTIONS: { id: OrbitAction; label: string; icon: ReactNode }[] = [
  { id: 'improve', label: 'Improve', icon: <Wand2 className="h-5 w-5" strokeWidth={1.75} /> },
  { id: 'shorter', label: 'Shorter', icon: <Minimize2 className="h-5 w-5" strokeWidth={1.75} /> },
  { id: 'expand', label: 'Expand', icon: <Maximize2 className="h-5 w-5" strokeWidth={1.75} /> },
  { id: 'grammar', label: 'Grammar', icon: <SpellCheck className="h-5 w-5" strokeWidth={1.75} /> },
  { id: 'academic', label: 'Academic', icon: <GraduationCap className="h-5 w-5" strokeWidth={1.75} /> },
];

const LEVELS = [
  { value: 100, tip: 'Mucho' },
  { value: 75, tip: 'Bastante' },
  { value: 50, tip: 'Medio' },
  { value: 25, tip: 'Poco' },
  { value: 10, tip: 'Muy poco' },
];

/** White capsule, black icons — hover like format toolbar; click outside collapses */
export default function ToolsDock({ busy, hasSelection, onAction }: Props) {
  const [open, setOpen] = useState(false);
  const [action, setAction] = useState<OrbitAction | null>(null);
  const [intensity, setIntensity] = useState(50);
  const [hoverKey, setHoverKey] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  const reset = () => {
    setAction(null);
    setOpen(false);
    setIntensity(50);
    setHoverKey(null);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') reset();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (!open && !action) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (rootRef.current && !rootRef.current.contains(t)) reset();
    };
    // capture so it wins over selection handlers
    document.addEventListener('mousedown', onDown, true);
    return () => document.removeEventListener('mousedown', onDown, true);
  }, [open, action]);

  const run = () => {
    if (!action || busy) return;
    onAction(action, intensity);
    reset();
  };

  const selected = ACTIONS.find((a) => a.id === action);
  const expanded = open || Boolean(action);

  const cell =
    'relative flex h-14 w-14 shrink-0 items-center justify-center text-neutral-800 transition-all duration-200 ease-out';

  return (
    <div
      ref={rootRef}
      data-selection-ui
      className="pointer-events-none absolute bottom-10 right-5 z-40"
      title={hasSelection ? 'Tools · selección' : 'Tools · documento'}
    >
      <div
        className={cn(
          'pointer-events-auto flex flex-col items-center overflow-hidden border border-neutral-200 bg-white text-neutral-800 shadow-xl shadow-black/10 transition-all duration-300 ease-out',
          expanded ? 'rounded-[32px]' : 'rounded-full',
        )}
      >
        <div
          className={cn(
            'flex flex-col items-center overflow-hidden transition-all duration-300 ease-out',
            expanded ? 'max-h-[400px] opacity-100' : 'max-h-0 opacity-0',
          )}
        >
          {!action &&
            open &&
            ACTIONS.map((a) => (
              <button
                key={a.id}
                type="button"
                title={a.label}
                disabled={busy}
                onMouseDown={(e) => e.preventDefault()}
                onMouseEnter={() => setHoverKey(a.id)}
                onMouseLeave={() => setHoverKey(null)}
                onClick={() => {
                  setAction(a.id);
                  setIntensity(50);
                }}
                className={cn(cell, busy && 'opacity-40')}
              >
                <span
                  className={cn(
                    'absolute inset-1.5 rounded-full transition-all duration-200 ease-out',
                    hoverKey === a.id ? 'bg-neutral-100 scale-100' : 'bg-transparent scale-90',
                  )}
                />
                <span className="relative z-10">{a.icon}</span>
              </button>
            ))}

          {action &&
            LEVELS.map((lv) => {
              const active = intensity === lv.value;
              return (
                <button
                  key={lv.value}
                  type="button"
                  title={lv.tip}
                  disabled={busy}
                  onMouseDown={(e) => e.preventDefault()}
                  onMouseEnter={() => setHoverKey(`i-${lv.value}`)}
                  onMouseLeave={() => setHoverKey(null)}
                  onClick={() => setIntensity(lv.value)}
                  className={cell}
                >
                  <span
                    className={cn(
                      'absolute inset-1.5 rounded-full transition-all duration-200',
                      hoverKey === `i-${lv.value}` || active ? 'bg-neutral-100' : 'bg-transparent',
                    )}
                  />
                  <span
                    className={cn(
                      'relative z-10 rounded-full bg-neutral-800 transition-all duration-200',
                      active ? 'h-3.5 w-3.5' : 'h-2 w-2 opacity-40',
                    )}
                  />
                </button>
              );
            })}
        </div>

        <button
          type="button"
          disabled={busy}
          title={
            action
              ? `${selected?.label} · click enviar · click fuera cancela`
              : open
                ? 'Cerrar'
                : 'AI tools'
          }
          onMouseDown={(e) => e.preventDefault()}
          onMouseEnter={() => setHoverKey('main')}
          onMouseLeave={() => setHoverKey(null)}
          onClick={() => {
            if (action) {
              run();
              return;
            }
            setOpen((v) => !v);
          }}
          className={cn(
            'relative flex h-16 w-16 shrink-0 items-center justify-center text-neutral-800',
            busy && 'opacity-50',
          )}
        >
          <span
            className={cn(
              'absolute inset-1.5 rounded-full transition-all duration-200',
              hoverKey === 'main' || action ? 'bg-neutral-100' : 'bg-transparent',
            )}
          />
          <span className="relative z-10">
            {selected ? selected.icon : <Wrench className="h-6 w-6" strokeWidth={1.75} />}
          </span>
        </button>
      </div>
    </div>
  );
}
