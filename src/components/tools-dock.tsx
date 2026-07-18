'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import {
  ArrowUp,
  GraduationCap,
  Maximize2,
  MessageSquarePlus,
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
  onOpenAgent?: () => void;
  showAgentOption?: boolean;
};

const ACTIONS: { id: OrbitAction; label: string; sendLabel: string; icon: ReactNode }[] = [
  { id: 'improve', label: 'Improve', sendLabel: 'Send improve', icon: <Wand2 className="h-5 w-5" strokeWidth={1.75} /> },
  { id: 'shorter', label: 'Shorter', sendLabel: 'Send shorter', icon: <Minimize2 className="h-5 w-5" strokeWidth={1.75} /> },
  { id: 'expand', label: 'Expand', sendLabel: 'Send expand', icon: <Maximize2 className="h-5 w-5" strokeWidth={1.75} /> },
  { id: 'grammar', label: 'Grammar', sendLabel: 'Send grammar', icon: <SpellCheck className="h-5 w-5" strokeWidth={1.75} /> },
  { id: 'academic', label: 'Academic', sendLabel: 'Send academic', icon: <GraduationCap className="h-5 w-5" strokeWidth={1.75} /> },
];

const LEVELS = [
  { value: 100, tip: 'Mucho' },
  { value: 75, tip: 'Bastante' },
  { value: 50, tip: 'Medio' },
  { value: 25, tip: 'Poco' },
  { value: 10, tip: 'Muy poco' },
];

/** Floating tools capsule — fat main button, full-size hover hit area */
export default function ToolsDock({
  busy,
  hasSelection,
  onAction,
  onOpenAgent,
  showAgentOption = true,
}: Props) {
  const [open, setOpen] = useState(false);
  const [action, setAction] = useState<OrbitAction | null>(null);
  const [intensity, setIntensity] = useState(50);
  const [hoverKey, setHoverKey] = useState<string | null>(null);
  const [panelVisible, setPanelVisible] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const expanded = open || Boolean(action);

  const reset = () => {
    setAction(null);
    setOpen(false);
    setIntensity(50);
    setHoverKey(null);
    setPanelVisible(false);
  };

  useEffect(() => {
    if (expanded) {
      requestAnimationFrame(() => setPanelVisible(true));
    } else if (panelVisible) {
      setPanelVisible(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expanded]);

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

  // Fat cells: button and hover disc share the same box (no inset shrink)
  const cell =
    'relative flex h-14 w-14 shrink-0 items-center justify-center text-neutral-800 transition-colors duration-150 ease-out';
  const hoverDisc = (active: boolean) =>
    cn(
      'absolute inset-0 rounded-full transition-colors duration-150',
      active ? 'bg-neutral-100' : 'bg-transparent',
    );

  const optionCount =
    (showAgentOption && onOpenAgent ? 1 : 0) + (action ? LEVELS.length : ACTIONS.length);
  const maxH = action ? 360 : Math.min(520, 64 + optionCount * 56);

  return (
    <div
      ref={rootRef}
      data-selection-ui
      title={hasSelection ? 'Tools · selección' : 'Tools · documento'}
      className="pointer-events-none absolute bottom-6 right-5 z-40"
    >
      <div
        className={cn(
          'pointer-events-auto flex flex-col items-center overflow-hidden border border-neutral-200 bg-white text-neutral-800 shadow-xl shadow-black/10 transition-all duration-300 ease-out',
          expanded || panelVisible ? 'rounded-[36px]' : 'rounded-full',
        )}
      >
        <div
          className={cn(
            'flex flex-col items-center overflow-hidden transition-all duration-300 ease-out',
            panelVisible && expanded ? 'opacity-100' : 'pointer-events-none opacity-0',
          )}
          style={{ maxHeight: panelVisible && expanded ? maxH : 0 }}
        >
          {showAgentOption && onOpenAgent && !action && open && (
            <button
              type="button"
              title="Abrir agente"
              disabled={busy}
              onMouseDown={(e) => e.preventDefault()}
              onMouseEnter={() => setHoverKey('agent')}
              onMouseLeave={() => setHoverKey(null)}
              onClick={() => {
                onOpenAgent();
                reset();
              }}
              className={cn(cell, busy && 'opacity-40')}
            >
              <span className={hoverDisc(hoverKey === 'agent')} />
              <span className="relative z-10">
                <MessageSquarePlus className="h-5 w-5" strokeWidth={1.75} />
              </span>
            </button>
          )}

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
                <span className={hoverDisc(hoverKey === a.id)} />
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
                  <span className={hoverDisc(hoverKey === `i-${lv.value}` || active)} />
                  <span
                    className={cn(
                      'relative z-10 rounded-full bg-neutral-800 transition-all duration-150',
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
          title={action ? selected?.sendLabel || 'Send' : open ? 'Cerrar' : 'AI tools'}
          onMouseDown={(e) => e.preventDefault()}
          onMouseEnter={() => setHoverKey('main')}
          onMouseLeave={() => setHoverKey(null)}
          onClick={() => {
            if (action) {
              run();
              return;
            }
            if (open) {
              setPanelVisible(false);
              window.setTimeout(() => setOpen(false), 280);
            } else {
              setOpen(true);
            }
          }}
          className={cn(
            'relative flex h-16 w-16 shrink-0 items-center justify-center transition-colors',
            busy && 'opacity-50',
            action && 'text-blue-600',
          )}
        >
          {/* Full-size hover — same circle as the button, no inset shrink */}
          <span
            className={cn(
              'absolute inset-0 rounded-full transition-colors duration-150',
              hoverKey === 'main' || action
                ? action
                  ? 'bg-blue-50'
                  : 'bg-neutral-100'
                : 'bg-transparent',
            )}
          />
          <span className="relative z-10">
            {action ? (
              <ArrowUp className="h-6 w-6 text-blue-600" strokeWidth={2.25} />
            ) : (
              <Wrench className="h-6 w-6" strokeWidth={1.75} />
            )}
          </span>
        </button>
      </div>
    </div>
  );
}
