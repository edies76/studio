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
  /** Sit beside floating composer instead of absolute bottom-right */
  variant?: 'floating' | 'inline';
};

const ACTIONS: { id: OrbitAction; label: string; icon: ReactNode }[] = [
  { id: 'improve', label: 'Improve', icon: <Wand2 className="h-4 w-4" strokeWidth={1.75} /> },
  { id: 'shorter', label: 'Shorter', icon: <Minimize2 className="h-4 w-4" strokeWidth={1.75} /> },
  { id: 'expand', label: 'Expand', icon: <Maximize2 className="h-4 w-4" strokeWidth={1.75} /> },
  { id: 'grammar', label: 'Grammar', icon: <SpellCheck className="h-4 w-4" strokeWidth={1.75} /> },
  { id: 'academic', label: 'Academic', icon: <GraduationCap className="h-4 w-4" strokeWidth={1.75} /> },
];

const LEVELS = [
  { value: 100, tip: 'Mucho' },
  { value: 75, tip: 'Bastante' },
  { value: 50, tip: 'Medio' },
  { value: 25, tip: 'Poco' },
  { value: 10, tip: 'Muy poco' },
];

/** Tools capsule — inline next to floating composer (default) or legacy floating */
export default function ToolsDock({
  busy,
  hasSelection,
  onAction,
  variant = 'inline',
}: Props) {
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
    'relative flex h-10 w-10 shrink-0 items-center justify-center text-neutral-800 transition-all duration-200 ease-out';

  const shell = (
    <div
      ref={rootRef}
      data-selection-ui
      title={hasSelection ? 'Tools · selección' : 'Tools · documento'}
      className={cn(variant === 'floating' && 'pointer-events-none absolute bottom-10 right-5 z-40')}
    >
      <div
        className={cn(
          'pointer-events-auto flex flex-col items-center overflow-hidden border border-neutral-200 bg-white text-neutral-800 shadow-lg shadow-black/8 transition-all duration-300 ease-out',
          expanded ? 'rounded-[28px]' : 'rounded-full',
        )}
      >
        <div
          className={cn(
            'flex flex-col items-center overflow-hidden transition-all duration-300 ease-out',
            expanded ? 'max-h-[360px] opacity-100' : 'max-h-0 opacity-0',
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
                    'absolute inset-1 rounded-full transition-all duration-200 ease-out',
                    hoverKey === a.id ? 'scale-100 bg-neutral-100' : 'scale-90 bg-transparent',
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
                      'absolute inset-1 rounded-full transition-all duration-200',
                      hoverKey === `i-${lv.value}` || active ? 'bg-neutral-100' : 'bg-transparent',
                    )}
                  />
                  <span
                    className={cn(
                      'relative z-10 rounded-full bg-neutral-800 transition-all duration-200',
                      active ? 'h-3 w-3' : 'h-1.5 w-1.5 opacity-40',
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
            'relative flex h-11 w-11 shrink-0 items-center justify-center text-neutral-800',
            busy && 'opacity-50',
          )}
        >
          <span
            className={cn(
              'absolute inset-1 rounded-full transition-all duration-200',
              hoverKey === 'main' || action ? 'bg-neutral-100' : 'bg-transparent',
            )}
          />
          <span className="relative z-10">
            {selected ? selected.icon : <Wrench className="h-4.5 w-4.5" strokeWidth={1.75} />}
          </span>
        </button>
      </div>
    </div>
  );

  return shell;
}
