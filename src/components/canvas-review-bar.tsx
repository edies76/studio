'use client';

import type { ProposeEditPayload } from '@/lib/doc-tools';
import { Check, X } from 'lucide-react';

/** Minimal accept/reject floating on canvas — brown accent, no chat bloat */
export default function CanvasReviewBar({
  edit,
  onAccept,
  onReject,
}: {
  edit: ProposeEditPayload;
  onAccept: () => void;
  onReject: () => void;
}) {
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-6 z-40 flex justify-center px-4">
      <div className="pointer-events-auto flex max-w-md items-center gap-2 rounded-full border border-[#d9d2c5] bg-white/95 px-2 py-1.5 shadow-lg backdrop-blur">
        <div className="min-w-0 flex-1 px-2">
          <p className="truncate text-[11px] font-semibold text-[#2c2a26]">{edit.title}</p>
          {edit.summary && (
            <p className="truncate text-[10px] text-[#7a766c]">{edit.summary}</p>
          )}
        </div>
        <button
          type="button"
          onClick={onReject}
          className="flex h-8 w-8 items-center justify-center rounded-full border border-[#d9d2c5] text-[#7a766c] hover:bg-[#f3f1ec]"
          title="Rechazar"
        >
          <X className="h-3.5 w-3.5" strokeWidth={2} />
        </button>
        <button
          type="button"
          onClick={onAccept}
          className="flex h-8 items-center gap-1 rounded-full bg-[#2c2a26] px-3 text-[11px] font-semibold text-[#f3f1ec] hover:bg-[#1c1b19]"
          title="Aceptar"
        >
          <Check className="h-3.5 w-3.5" strokeWidth={2} />
          Aceptar
        </button>
      </div>
    </div>
  );
}
