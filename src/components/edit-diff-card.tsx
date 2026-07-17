'use client';

import { useMemo, useState } from 'react';
import type { ProposeEditPayload } from '@/lib/doc-tools';
import { diffPlain, htmlToPlain } from '@/lib/html-diff';
import { cn } from '@/lib/utils';
import { Check, ChevronDown, ChevronUp, X } from 'lucide-react';

type Props = {
  id: string;
  edit: ProposeEditPayload;
  onAccept: (id: string) => void;
  onReject: (id: string) => void;
};

export default function EditDiffCard({ id, edit, onAccept, onReject }: Props) {
  const [tab, setTab] = useState<'diff' | 'preview'>('diff');
  const [open, setOpen] = useState(true);

  const lines = useMemo(() => {
    const before = htmlToPlain(edit.beforeHtml || '');
    const after = htmlToPlain(edit.afterHtml || '');
    return diffPlain(before, after).slice(0, 80);
  }, [edit.beforeHtml, edit.afterHtml]);

  const changeList =
    edit.changeList?.length
      ? edit.changeList
      : lines
          .filter((l) => l.type !== 'same')
          .slice(0, 8)
          .map((l) => (l.type === 'add' ? `+ ${l.text.slice(0, 100)}` : `− ${l.text.slice(0, 100)}`));

  return (
    <div className="overflow-hidden rounded-xl border border-[#c9c4ba] bg-white shadow-sm">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-start justify-between gap-2 border-b border-[#e5e1d8] px-3 py-2.5 text-left"
      >
        <div className="min-w-0">
          <div className="text-xs font-semibold text-[#1c1b19]">{edit.title}</div>
          <p className="mt-0.5 text-[11px] leading-snug text-[#5c5952]">{edit.summary}</p>
        </div>
        {open ? (
          <ChevronUp className="mt-0.5 h-4 w-4 shrink-0 text-[#7a766c]" />
        ) : (
          <ChevronDown className="mt-0.5 h-4 w-4 shrink-0 text-[#7a766c]" />
        )}
      </button>

      {open && (
        <>
          {changeList.length > 0 && (
            <div className="border-b border-[#e5e1d8] bg-[#fbfaf7] px-3 py-2">
              <div className="mb-1 font-mono text-[10px] uppercase tracking-wider text-[#7a766c]">
                Changes
              </div>
              <ul className="space-y-1">
                {changeList.map((c, i) => (
                  <li key={i} className="text-[11px] leading-snug text-[#1c1b19]">
                    · {c}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex gap-1 border-b border-[#e5e1d8] px-2 pt-2">
            {(['diff', 'preview'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className={cn(
                  'rounded-md px-2.5 py-1 text-[11px] font-medium',
                  tab === t
                    ? 'bg-[#2c2a26] text-[#f3f1ec]'
                    : 'text-[#5c5952] hover:bg-[#f3f1ec]',
                )}
              >
                {t === 'diff' ? 'Diff' : 'Preview'}
              </button>
            ))}
          </div>

          <div className="max-h-48 overflow-y-auto px-0 py-0 text-[11px]">
            {tab === 'diff' ? (
              <div className="font-mono">
                {lines.length === 0 ? (
                  <p className="p-3 text-[#7a766c]">No plain-text diff (new document).</p>
                ) : (
                  lines.map((l, i) => (
                    <div
                      key={i}
                      className={cn(
                        'border-l-2 px-3 py-0.5 leading-snug',
                        l.type === 'add' && 'border-emerald-600/50 bg-emerald-50 text-emerald-950',
                        l.type === 'del' && 'border-rose-500/40 bg-rose-50 text-rose-950 line-through',
                        l.type === 'same' && 'border-transparent text-[#7a766c]',
                      )}
                    >
                      <span className="mr-1 opacity-60">{l.type === 'add' ? '+' : l.type === 'del' ? '−' : ' '}</span>
                      {l.text}
                    </div>
                  ))
                )}
              </div>
            ) : (
              <div
                className="prose prose-sm max-w-none p-3 text-[12px] text-[#1c1b19]"
                dangerouslySetInnerHTML={{ __html: (edit.afterHtml || '').slice(0, 6000) }}
              />
            )}
          </div>

          <div className="flex gap-2 border-t border-[#e5e1d8] p-2">
            <button
              type="button"
              onClick={() => onAccept(id)}
              className="flex flex-1 items-center justify-center gap-1 rounded-md bg-[#2c2a26] py-1.5 text-xs font-semibold text-[#f3f1ec] hover:bg-[#1c1b19]"
            >
              <Check className="h-3.5 w-3.5" strokeWidth={2} />
              Accept
            </button>
            <button
              type="button"
              onClick={() => onReject(id)}
              className="flex flex-1 items-center justify-center gap-1 rounded-md border border-[#c9c4ba] bg-[#f7f5f1] py-1.5 text-xs font-medium text-[#5c5952] hover:text-[#1c1b19]"
            >
              <X className="h-3.5 w-3.5" strokeWidth={2} />
              Reject
            </button>
          </div>
        </>
      )}
    </div>
  );
}
