'use client';

import { useEffect, useRef, useState } from 'react';
import ThinkingShine from '@/components/thinking-shine';
import { sanitizeDocumentHtml, typesetEditor } from '@/lib/math-html';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

/** Thinking outside; collapsible preview with canvas-matching Inter font */
export default function DraftStreamCard({
  html,
  status,
  done,
}: {
  html: string;
  status?: string;
  done?: boolean;
}) {
  const [open, setOpen] = useState(true);
  const previewRef = useRef<HTMLDivElement>(null);
  const plain = html
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  useEffect(() => {
    const timer = window.setTimeout(() => typesetEditor(previewRef.current), 90);
    return () => window.clearTimeout(timer);
  }, [html, open]);

  return (
    <div className="space-y-2">
      {/* Shine only while working — hide when done */}
      {!done && <ThinkingShine label={status || 'Escribiendo…'} />}

      {plain ? (
        <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="flex w-full items-center gap-1.5 px-3 py-2 text-left text-[12px] font-semibold text-neutral-800 hover:bg-neutral-50"
          >
            {open ? (
              <ChevronDown className="h-3.5 w-3.5 text-neutral-400" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5 text-neutral-400" />
            )}
            <span>{done ? 'Documento en el lienzo' : 'Vista previa del draft'}</span>
            <span className="ml-auto font-mono text-[10px] font-normal text-neutral-400">
              {plain.split(/\s+/).length}w
            </span>
          </button>
          <div
            className={cn(
              'border-t border-neutral-100 transition-all',
              open ? 'max-h-52 overflow-y-auto px-3 py-2.5' : 'max-h-0 overflow-hidden',
            )}
          >
            <div
              ref={previewRef}
              className="studio-draft-preview prose prose-neutral max-w-none text-[12px] leading-relaxed text-neutral-700 prose-headings:font-inherit prose-headings:text-neutral-900"
              style={{ fontFamily: 'Inter, Segoe UI, system-ui, sans-serif' }}
              dangerouslySetInnerHTML={{
                __html: sanitizeDocumentHtml(
                  html.replace(/<script[\s\S]*?<\/script>/gi, '').slice(0, 8000),
                ),
              }}
            />
          </div>
        </div>
      ) : !done ? (
        <div className="rounded-xl border border-dashed border-neutral-200 bg-neutral-50/80 px-3 py-4 text-center text-[11px] text-neutral-400">
          El texto va a aparecer acá y en el papel…
        </div>
      ) : null}
    </div>
  );
}
