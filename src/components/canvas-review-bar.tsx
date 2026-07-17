'use client';

import type { ProposeEditPayload } from '@/lib/doc-tools';
import { Check, CheckCheck, X } from 'lucide-react';
import { cn } from '@/lib/utils';

export type PendingReview = {
  id: string;
  edit: ProposeEditPayload;
  status: 'pending' | 'accepted' | 'rejected';
};

/** Multi-edit review: accept/reject each + accept all */
export default function CanvasReviewBar({
  items,
  activeId,
  onSelect,
  onAccept,
  onReject,
  onAcceptAll,
  onRejectAll,
}: {
  items: PendingReview[];
  activeId?: string | null;
  onSelect?: (id: string) => void;
  onAccept: (id: string) => void;
  onReject: (id: string) => void;
  onAcceptAll: () => void;
  onRejectAll: () => void;
}) {
  const pending = items.filter((i) => i.status === 'pending');
  if (!pending.length) return null;

  const active = pending.find((p) => p.id === activeId) || pending[0];

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-5 z-40 flex justify-center px-3">
      <div className="pointer-events-auto w-full max-w-lg overflow-hidden rounded-2xl border border-[#d9d2c5] bg-white/95 shadow-xl backdrop-blur">
        {/* List of point edits */}
        {pending.length > 1 && (
          <div className="flex max-h-28 flex-col gap-0.5 overflow-y-auto border-b border-neutral-100 px-2 py-1.5">
            {pending.map((p, i) => (
              <button
                key={p.id}
                type="button"
                onClick={() => onSelect?.(p.id)}
                className={cn(
                  'flex items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[11px]',
                  p.id === active.id
                    ? 'bg-studio-brown text-white'
                    : 'text-neutral-700 hover:bg-neutral-100',
                )}
              >
                <span className="font-mono opacity-60">{i + 1}</span>
                <span className="min-w-0 flex-1 truncate font-semibold">{p.edit.title}</span>
                <span className="flex shrink-0 gap-0.5">
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={(e) => {
                      e.stopPropagation();
                      onReject(p.id);
                    }}
                    className={cn(
                      'rounded p-0.5',
                      p.id === active.id ? 'hover:bg-white/15' : 'hover:bg-neutral-200',
                    )}
                    title="Rechazar"
                  >
                    <X className="h-3 w-3" />
                  </span>
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={(e) => {
                      e.stopPropagation();
                      onAccept(p.id);
                    }}
                    className={cn(
                      'rounded p-0.5',
                      p.id === active.id ? 'hover:bg-white/15' : 'hover:bg-neutral-200',
                    )}
                    title="Aceptar"
                  >
                    <Check className="h-3 w-3" />
                  </span>
                </span>
              </button>
            ))}
          </div>
        )}

        {/* Active edit summary */}
        <div className="flex items-center gap-2 px-2.5 py-2">
          <div className="min-w-0 flex-1 px-1">
            <p className="truncate text-[12px] font-semibold text-[#2c2a26]">
              {active.edit.title}
              {pending.length > 1 && (
                <span className="ml-1 font-mono text-[10px] font-normal text-neutral-400">
                  {pending.findIndex((p) => p.id === active.id) + 1}/{pending.length}
                </span>
              )}
            </p>
            {active.edit.summary && (
              <p className="truncate text-[10px] text-[#7a766c]">{active.edit.summary}</p>
            )}
          </div>
          <button
            type="button"
            onClick={() => onReject(active.id)}
            className="flex h-8 w-8 items-center justify-center rounded-full border border-[#d9d2c5] text-[#7a766c] hover:bg-[#f3f1ec]"
            title="Rechazar este"
          >
            <X className="h-3.5 w-3.5" strokeWidth={2} />
          </button>
          <button
            type="button"
            onClick={() => onAccept(active.id)}
            className="flex h-8 items-center gap-1 rounded-full bg-studio-brown px-3 text-[11px] font-semibold text-[#f3f1ec] hover:bg-studio-brown-hover"
            title="Aceptar este"
          >
            <Check className="h-3.5 w-3.5" strokeWidth={2} />
            Aceptar
          </button>
        </div>

        {pending.length > 1 && (
          <div className="flex gap-2 border-t border-neutral-100 px-2.5 py-2">
            <button
              type="button"
              onClick={onRejectAll}
              className="flex-1 rounded-full border border-neutral-200 py-1.5 text-[11px] font-medium text-neutral-600 hover:bg-neutral-50"
            >
              Rechazar todo
            </button>
            <button
              type="button"
              onClick={onAcceptAll}
              className="flex flex-1 items-center justify-center gap-1 rounded-full bg-studio-brown py-1.5 text-[11px] font-semibold text-[#f3f1ec] hover:bg-studio-brown-hover"
            >
              <CheckCheck className="h-3.5 w-3.5" strokeWidth={2} />
              Aceptar todo
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
