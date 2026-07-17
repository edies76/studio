'use client';

import { useState, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import {
  AlignLeft,
  Bold,
  Italic,
  Underline,
  Highlighter,
  Wand2,
  Minimize2,
  Maximize2,
  SpellCheck,
  GraduationCap,
  ArrowUp,
  Quote,
  Type,
} from 'lucide-react';

export type SelectionAction =
  | 'improve'
  | 'shorter'
  | 'expand'
  | 'grammar'
  | 'academic'
  | 'custom'
  | 'bold'
  | 'italic'
  | 'underline'
  | 'highlight'
  | 'quote';

type Props = {
  top: number;
  left: number;
  mode: 'icon' | 'menu';
  onOpen: () => void;
  onAction: (action: SelectionAction, value?: string) => void;
  onClose: () => void;
  busy?: boolean;
};

const AI_ACTIONS: { id: SelectionAction; label: string; icon: ReactNode }[] = [
  { id: 'improve', label: 'Improve', icon: <Wand2 className="h-3.5 w-3.5" strokeWidth={1.75} /> },
  { id: 'shorter', label: 'Shorter', icon: <Minimize2 className="h-3.5 w-3.5" strokeWidth={1.75} /> },
  { id: 'expand', label: 'Expand', icon: <Maximize2 className="h-3.5 w-3.5" strokeWidth={1.75} /> },
  { id: 'grammar', label: 'Grammar', icon: <SpellCheck className="h-3.5 w-3.5" strokeWidth={1.75} /> },
  { id: 'academic', label: 'Academic', icon: <GraduationCap className="h-3.5 w-3.5" strokeWidth={1.75} /> },
];

export default function SelectionToolbar({
  top,
  left,
  mode,
  onOpen,
  onAction,
  onClose,
  busy,
}: Props) {
  const [custom, setCustom] = useState('');

  if (mode === 'icon') {
    return (
      <button
        type="button"
        style={{ top, left }}
        onMouseDown={(e) => e.preventDefault()}
        onClick={(e) => {
          e.stopPropagation();
          onOpen();
        }}
        className="absolute z-50 flex h-8 w-8 items-center justify-center rounded-full border border-[#c9c4ba] bg-studio-brown text-[#f3f1ec] shadow-sm transition hover:scale-105 active:scale-95"
        title="AI tools"
      >
        <Type className="h-3.5 w-3.5" strokeWidth={1.75} />
      </button>
    );
  }

  return (
    <div
      style={{ top, left }}
      onMouseDown={(e) => e.preventDefault()}
      className="absolute z-[60] w-[min(340px,calc(100vw-2rem))] rounded-xl border border-[#c9c4ba] bg-[#f7f5f1] p-2 shadow-[0_8px_30px_rgba(0,0,0,0.12)]"
    >
      <div className="mb-2 flex flex-wrap gap-1">
        {AI_ACTIONS.map((a) => (
          <button
            key={a.id}
            type="button"
            disabled={busy}
            onClick={() => onAction(a.id)}
            className={cn(
              'inline-flex items-center gap-1 rounded-md border border-[#d4d0c8] bg-white px-2 py-1 text-[11px] font-medium text-[#1c1b19] hover:bg-[#ebe9e4]',
              busy && 'opacity-50',
            )}
          >
            {a.icon}
            {a.label}
          </button>
        ))}
      </div>
      <div className="mb-2 flex gap-1 border-t border-[#e5e1d8] pt-2">
        {(
          [
            ['bold', <Bold key="b" className="h-3.5 w-3.5" />],
            ['italic', <Italic key="i" className="h-3.5 w-3.5" />],
            ['underline', <Underline key="u" className="h-3.5 w-3.5" />],
            ['highlight', <Highlighter key="h" className="h-3.5 w-3.5" />],
            ['quote', <Quote key="q" className="h-3.5 w-3.5" />],
          ] as const
        ).map(([id, icon]) => (
          <button
            key={id}
            type="button"
            onClick={() => onAction(id as SelectionAction)}
            className="flex h-8 w-8 items-center justify-center rounded-md border border-[#d4d0c8] bg-white text-[#5c5952] hover:bg-[#ebe9e4] hover:text-[#1c1b19]"
            title={id}
          >
            {icon}
          </button>
        ))}
        <button
          type="button"
          onClick={onClose}
          className="ml-auto rounded-md px-2 text-[11px] text-[#7a766c] hover:text-[#1c1b19]"
        >
          Esc
        </button>
      </div>
      <div className="flex items-center gap-1 rounded-lg border border-[#d4d0c8] bg-white px-2 py-1">
        <AlignLeft className="h-3.5 w-3.5 shrink-0 text-[#9a968c]" strokeWidth={1.5} />
        <input
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && custom.trim()) {
              onAction('custom', custom.trim());
              setCustom('');
            }
            if (e.key === 'Escape') onClose();
          }}
          placeholder="Ask AI about this selection…"
          className="min-w-0 flex-1 bg-transparent py-1.5 text-xs text-[#1c1b19] outline-none placeholder:text-[#9a968c]"
        />
        <button
          type="button"
          disabled={!custom.trim() || busy}
          onClick={() => {
            if (!custom.trim()) return;
            onAction('custom', custom.trim());
            setCustom('');
          }}
          className="flex h-7 w-7 items-center justify-center rounded-full bg-studio-brown text-[#f3f1ec] disabled:opacity-40"
        >
          <ArrowUp className="h-3.5 w-3.5" strokeWidth={2} />
        </button>
      </div>
    </div>
  );
}
