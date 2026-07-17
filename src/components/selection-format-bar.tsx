'use client';

import { useEffect, useState } from 'react';
import {
  Bold,
  Highlighter,
  Italic,
  Pencil,
  Underline,
  Type,
  Palette,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

type Props = {
  top: number;
  left: number;
  visible: boolean;
  onEditWithAi: () => void;
  /** Hide AI pencil if disabled in settings */
  showAiPencil?: boolean;
  /** e.g. "Ctrl+E" shown under the pencil */
  aiShortcutLabel?: string;
};

const COLORS = [
  { name: 'Negro', value: '#171717' },
  { name: 'Gris', value: '#525252' },
  { name: 'Rojo', value: '#dc2626' },
  { name: 'Azul', value: '#2563eb' },
  { name: 'Verde', value: '#059669' },
  { name: 'Marrón', value: '#92400e' },
];

const HIGHLIGHTS = [
  { name: 'Ninguno', value: 'transparent' },
  { name: 'Amarillo', value: '#fef08a' },
  { name: 'Verde', value: '#bbf7d0' },
  { name: 'Azul', value: '#bfdbfe' },
  { name: 'Rosa', value: '#fecdd3' },
];

function cmd(command: string, value?: string) {
  try {
    document.execCommand('styleWithCSS', false, 'true');
  } catch {
    /* ignore */
  }
  document.execCommand(command, false, value);
}

/**
 * Word-like selection bar — white capsule, same hover language as top toolbar.
 * Format tools + special AI pencil that opens the agent in edit mode.
 */
export default function SelectionFormatBar({
  top,
  left,
  visible,
  onEditWithAi,
  showAiPencil = true,
  aiShortcutLabel = 'Ctrl+E',
}: Props) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    if (visible) requestAnimationFrame(() => setMounted(true));
    else setMounted(false);
  }, [visible]);

  if (!visible) return null;

  const btn =
    'flex h-8 w-8 items-center justify-center rounded-md text-neutral-600 transition hover:bg-neutral-100 hover:text-neutral-900';

  return (
    <div
      data-selection-ui
      className={cn(
        'pointer-events-auto absolute z-50 flex -translate-x-1/2 items-center gap-0.5 rounded-2xl border border-neutral-200/90 bg-white px-1.5 py-1 shadow-[0_8px_30px_rgba(0,0,0,0.1)] transition-all duration-200',
        mounted ? 'translate-y-0 scale-100 opacity-100' : 'translate-y-1 scale-95 opacity-0',
      )}
      style={{ top, left }}
      onMouseDown={(e) => {
        // Keep selection when interacting with the bar
        e.preventDefault();
      }}
    >
      <button type="button" className={btn} title="Negrita" onClick={() => cmd('bold')}>
        <Bold className="h-3.5 w-3.5" strokeWidth={1.75} />
      </button>
      <button type="button" className={btn} title="Cursiva" onClick={() => cmd('italic')}>
        <Italic className="h-3.5 w-3.5" strokeWidth={1.75} />
      </button>
      <button type="button" className={btn} title="Subrayado" onClick={() => cmd('underline')}>
        <Underline className="h-3.5 w-3.5" strokeWidth={1.75} />
      </button>

      <div className="mx-0.5 h-5 w-px bg-neutral-200" />

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button type="button" className={btn} title="Color de texto">
            <Palette className="h-3.5 w-3.5" strokeWidth={1.75} />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="center" className="min-w-[8rem]">
          {COLORS.map((c) => (
            <DropdownMenuItem
              key={c.value}
              onClick={() => cmd('foreColor', c.value)}
              className="gap-2 text-[12px]"
            >
              <span className="h-3 w-3 rounded-full border border-neutral-200" style={{ background: c.value }} />
              {c.name}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button type="button" className={btn} title="Resaltado">
            <Highlighter className="h-3.5 w-3.5" strokeWidth={1.75} />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="center" className="min-w-[8rem]">
          {HIGHLIGHTS.map((h) => (
            <DropdownMenuItem
              key={h.value}
              onClick={() => cmd('hiliteColor', h.value)}
              className="gap-2 text-[12px]"
            >
              <span
                className="h-3 w-3 rounded border border-neutral-200"
                style={{ background: h.value === 'transparent' ? '#fff' : h.value }}
              />
              {h.name}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button type="button" className={btn} title="Tamaño">
            <Type className="h-3.5 w-3.5" strokeWidth={1.75} />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="center">
          {[
            { label: 'Pequeño', v: '2' },
            { label: 'Normal', v: '3' },
            { label: 'Mediano', v: '4' },
            { label: 'Grande', v: '5' },
            { label: 'Título', v: '6' },
          ].map((s) => (
            <DropdownMenuItem key={s.v} onClick={() => cmd('fontSize', s.v)} className="text-[12px]">
              {s.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {showAiPencil && (
        <>
          <div className="mx-0.5 h-5 w-px bg-neutral-200" />
          <button
            type="button"
            title={`Editar con IA · ${aiShortcutLabel}`}
            onClick={(e) => {
              e.stopPropagation();
              onEditWithAi();
            }}
            className={cn(
              'flex h-8 min-w-[2.5rem] flex-col items-center justify-center gap-0 rounded-md px-1.5',
              'text-neutral-700 transition hover:bg-neutral-100 hover:text-neutral-900',
            )}
          >
            <Pencil className="h-3.5 w-3.5" strokeWidth={1.75} />
            <span className="font-mono text-[8px] leading-none tracking-tight text-neutral-400">
              {aiShortcutLabel}
            </span>
          </button>
        </>
      )}
    </div>
  );
}
