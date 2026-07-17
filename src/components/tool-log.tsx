'use client';

import { cn } from '@/lib/utils';
import { Check, Loader2, X } from 'lucide-react';

export type ToolLogItem = {
  id: string;
  label: string;
  /** Final label when done (e.g. "Párrafo 5 editado") */
  doneLabel?: string;
  state: 'running' | 'done' | 'error';
};

/** Stack of tool steps: running animates, done becomes plain text under the next one */
export default function ToolLog({ items }: { items: ToolLogItem[] }) {
  if (!items.length) return null;

  return (
    <div className="space-y-1 py-1">
      {items.map((it) => (
        <div
          key={it.id}
          className={cn(
            'flex items-start gap-2 text-[12.5px] leading-snug',
            it.state === 'running' && 'text-neutral-700',
            it.state === 'done' && 'text-neutral-500',
            it.state === 'error' && 'text-red-600',
          )}
        >
          <span className="mt-0.5 shrink-0">
            {it.state === 'running' ? (
              <Loader2 className="h-3 w-3 animate-spin text-neutral-500" />
            ) : it.state === 'done' ? (
              <Check className="h-3 w-3 text-emerald-600" strokeWidth={2.25} />
            ) : (
              <X className="h-3 w-3" strokeWidth={2} />
            )}
          </span>
          {it.state === 'running' ? (
            <span className="studio-shine-text font-medium">{it.label}</span>
          ) : (
            <span className="font-medium">{it.doneLabel || it.label}</span>
          )}
        </div>
      ))}
    </div>
  );
}
