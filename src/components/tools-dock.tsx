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
  /** Open the ephemeral agent input */
  onOpenAgent?: () => void;
  /** Show "open agent" in the orbit menu */
  showAgentOption?: boolean;
};

const ACTIONS: { id: OrbitAction; label: string; sendLabel: string; icon: ReactNode }[] = [
  { id: 'improve', label: 'Improve', sendLabel: 'Send improve', icon: <Wand2 className="h-4 w-4" strokeWidth={1.75} /> },
  { id: 'shorter', label: 'Shorter', sendLabel: 'Send shorter', icon: <Minimize2 className="h-4 w-4" strokeWidth={1.75} /> },
  { id: 'expand', label: 'Expand', sendLabel: 'Send expand', icon: <Maximize2 className="h-4 w-4" strokeWidth={1.75} /> },
  { id: 'grammar', label: 'Grammar', sendLabel: 'Send grammar', icon: <SpellCheck className="h-4 w-4" strokeWidth={1.75} /> },
  { id: 'academic', label: 'Academic', sendLabel: 'Send academic', icon: <GraduationCap className="h-4 w-4" strokeWidth={1.75} /> },
];

const LEVELS = [
  { value: 100, tip: 'Mucho' },
  { value: 75, tip: 'Bastante' },
  { value: 50, tip: 'Medio' },
  { value: 25, tip: 'Poco' },
  { value: 10, tip: 'Muy poco' },
];

/**
 * Floating white tools capsule (bottom-right).
 * Opens with staggered options; closes with reverse collapse animation.
 * After picking an action → main icon becomes blue arrow "Send {action}".
 */
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
  /** Animate panel in/out without unmounting mid-close */
  const [panelVisible, setPanelVisible] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const expanded = open || Boolean(action);
  const showPanel = panelVisible || expanded;

  const reset = () => {
    setAction(null);
    setOpen(false);
    setIntensity(50);
    setHoverKey(null);
    setPanelVisible(false);
  };

  // Sync open → panelVisible for enter; exit animates then hides
  useEffect(() => {
    if (expanded) {
      if (closeTimer.current) clearTimeout(closeTimer.current);
      requestAnimationFrame(() => setPanelVisible(true));
    } else if (panelVisible) {
      setPanelVisible(false);
    }
  }, [expanded]); // eslint-disable-line react-hooks/exhaustive-deps

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
  const cell =
    'relative flex h-11 w-11 shrink-0 items-center justify-center text-neutral-800 transition-all duration-200 ease-out';

  const optionCount = (showAgentOption && onOpenAgent ? 1 : 0) + (action ? LEVELS.length : ACTIONS.length);
  const maxH = action ? 280 : Math.min(420, 56 + optionCount * 44);

  return (
    <div
      ref={rootRef}
      data-selection-ui
      title={hasSelection ? 'Tools · selección' : 'Tools · documento'}
      className="pointer-events-none absolute bottom-6 right-5 z-40"
    >
      <div
        className={cn(
          'pointer-events-auto flex flex-col items-center overflow-hidden border border-neutral-200 bg-white text-neutral-800 shadow-xl shadow-black/10 transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]',
          expanded || panelVisible ? 'rounded-[28px]' : 'rounded-full',
        )}
      >
        {/* Options panel — opens AND closes with height/opacity animation */}
        <div
          className={cn(
            'flex flex-col items-center overflow-hidden transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]',
            panelVisible && expanded
              ? 'opacity-100'
              : 'pointer-events-none opacity-0',
          )}
          style={{
            maxHeight: panelVisible && expanded ? maxH : 0,
          }}
        >
          {/* Open agent — no intensity */}
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
              <span
                className={cn(
                  'absolute inset-1 rounded-full transition-all duration-200 ease-out',
                  hoverKey === 'agent' ? 'scale-100 bg-neutral-100' : 'scale-90 bg-transparent',
                )}
              />
              <span className="relative z-10">
                <MessageSquarePlus className="h-4 w-4" strokeWidth={1.75} />
              </span>
            </button>
          )}

          {!action &&
            open &&
            ACTIONS.map((a, idx) => (
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
                style={{
                  transitionDelay: panelVisible ? `${idx * 30}ms` : '0ms',
                }}
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

        {/* Main button */}
        <button
          type="button"
          disabled={busy}
          title={
            action
              ? selected?.sendLabel || 'Send'
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
            if (open) {
              // Close with animation
              setPanelVisible(false);
              window.setTimeout(() => setOpen(false), 280);
            } else {
              setOpen(true);
            }
          }}
          className={cn(
            'relative flex h-12 w-12 shrink-0 items-center justify-center transition-colors',
            busy && 'opacity-50',
            action && 'text-blue-600',
          )}
        >
          <span
            className={cn(
              'absolute inset-1.5 rounded-full transition-all duration-200',
              hoverKey === 'main' || action
                ? action
                  ? 'bg-blue-50'
                  : 'bg-neutral-100'
                : 'bg-transparent',
            )}
          />
          <span className="relative z-10 transition-transform duration-200">
            {action ? (
              <ArrowUp className="h-5 w-5 text-blue-600" strokeWidth={2.25} />
            ) : (
              <Wrench className="h-5 w-5" strokeWidth={1.75} />
            )}
          </span>
        </button>
      </div>
    </div>
  );
}
