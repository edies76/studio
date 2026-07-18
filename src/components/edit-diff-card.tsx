'use client';

import { useMemo, useState } from 'react';
import type { ProposeEditPayload } from '@/lib/doc-tools';
import { diffWordSegments, htmlToPlain, type WordDiffSegment } from '@/lib/html-diff';
import { diffHtmlBlocks, htmlToBlockList, type DiffBlock } from '@/lib/canvas-diff';
import { cn } from '@/lib/utils';
import { Check, ChevronDown, ChevronUp, X } from 'lucide-react';

type Props = {
  id: string;
  edit: ProposeEditPayload;
  onAccept: (id: string) => void;
  onReject: (id: string) => void;
  onAcceptPart?: (id: string, hunkIndex: number) => void;
  onRejectPart?: (id: string, hunkIndex: number) => void;
};

type Section = {
  block: DiffBlock;
  segments: WordDiffSegment[];
  hunkStart: number;
};

export default function EditDiffCard({
  id,
  edit,
  onAccept,
  onReject,
  onAcceptPart,
  onRejectPart,
}: Props) {
  const [tab, setTab] = useState<'diff' | 'preview'>('diff');
  const [open, setOpen] = useState(true);

  const sections = useMemo<Section[]>(() => {
    let hunkStart = 0;
    return diffHtmlBlocks(edit.beforeHtml || '', edit.afterHtml || '')
      .filter((block) => block.type !== 'same')
      .map((block) => {
        const before = htmlToPlain(block.beforeHtml || (block.type === 'del' ? block.html : ''));
        const after = htmlToPlain(block.afterHtml || (block.type === 'add' ? block.html : ''));
        const segments = diffWordSegments(before, after);
        const count = segments.filter((segment) => segment.type === 'change').length || 1;
        const section = { block, segments, hunkStart };
        hunkStart += count;
        return section;
      });
  }, [edit.beforeHtml, edit.afterHtml]);

  const hunkCount = sections.reduce(
    (sum, section) => sum + (section.segments.filter((segment) => segment.type === 'change').length || 1),
    0,
  );
  const partialCapable =
    htmlToBlockList(edit.beforeHtml || '').length === 1 &&
    htmlToBlockList(edit.afterHtml || '').length === 1 &&
    sections.length === 1 &&
    sections[0].block.type === 'paired';

  return (
    <div className="overflow-hidden rounded-xl border border-[#c9c4ba] bg-white">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-start justify-between gap-2 border-b border-[#e5e1d8] px-3 py-2.5 text-left"
      >
        <div className="min-w-0">
          <div className="text-xs font-semibold text-[#1c1b19]">{edit.title}</div>
          <p className="mt-0.5 text-[11px] leading-snug text-[#5c5952]">{edit.summary}</p>
        </div>
        {open ? <ChevronUp className="mt-0.5 h-4 w-4 shrink-0 text-[#7a766c]" /> : <ChevronDown className="mt-0.5 h-4 w-4 shrink-0 text-[#7a766c]" />}
      </button>

      {open && (
        <>
          <div className="flex gap-1 border-b border-[#e5e1d8] px-2 pt-2">
            {(['diff', 'preview'] as const).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setTab(value)}
                className={cn(
                  'rounded-md px-2.5 py-1 text-[11px] font-medium',
                  tab === value ? 'bg-studio-brown text-[#f3f1ec]' : 'text-[#5c5952] hover:bg-[#f3f1ec]',
                )}
              >
                {value === 'diff' ? `Cambios${hunkCount ? ` · ${hunkCount}` : ''}` : 'Vista previa'}
              </button>
            ))}
          </div>

          <div className="max-h-64 overflow-y-auto px-3 py-2 text-[12px]">
            {tab === 'diff' ? (
              sections.length === 0 ? (
                <p className="py-2 text-[#7a766c]">No hay diferencias de texto.</p>
              ) : (
                <div className="space-y-3">
                  {sections.map((section, sectionIndex) => (
                    <section key={sectionIndex} className="border-l-2 border-[#b4aa9d] pl-2">
                      <div className="mb-1 font-mono text-[9px] uppercase tracking-[0.16em] text-[#91877c]">
                        Sección {sectionIndex + 1}
                      </div>
                      <div className="leading-relaxed text-[#5c5952]">
                        {section.segments.map((segment, index) => {
                          if (segment.type === 'same') return <span key={index}>{segment.text}</span>;
                          const hunkIndex = section.hunkStart + section.segments.slice(0, index).filter((item) => item.type === 'change').length;
                          return (
                            <span key={index} className="inline-flex flex-wrap items-baseline gap-x-1">
                              {segment.before && <del className="text-[#9f2f29] decoration-1">{segment.before}</del>}
                              {segment.after && <ins className="text-[#23734b] no-underline">{segment.after}</ins>}
                              {partialCapable && (onAcceptPart || onRejectPart) && (
                                <span className="ml-1 inline-flex items-center gap-0.5 align-middle">
                                  <button
                                    type="button"
                                    title="Aceptar solo este cambio"
                                    aria-label="Aceptar solo este cambio"
                                    onClick={() => onAcceptPart?.(id, hunkIndex)}
                                    className="inline-flex h-5 w-5 items-center justify-center rounded border border-[#d8d0c6] text-[#23734b] hover:bg-[#edf5ee]"
                                  >
                                    <Check className="h-3 w-3" strokeWidth={2.5} />
                                  </button>
                                  <button
                                    type="button"
                                    title="Rechazar solo este cambio"
                                    aria-label="Rechazar solo este cambio"
                                    onClick={() => onRejectPart?.(id, hunkIndex)}
                                    className="inline-flex h-5 w-5 items-center justify-center rounded border border-[#d8d0c6] text-[#9f2f29] hover:bg-[#fbefed]"
                                  >
                                    <X className="h-3 w-3" strokeWidth={2.5} />
                                  </button>
                                </span>
                              )}
                            </span>
                          );
                        })}
                      </div>
                    </section>
                  ))}
                </div>
              )
            ) : (
              <div
                className="studio-draft-preview prose prose-sm max-w-none text-[#1c1b19]"
                dangerouslySetInnerHTML={{ __html: (edit.afterHtml || '').slice(0, 9000) }}
              />
            )}
          </div>

          <div className="flex gap-2 border-t border-[#e5e1d8] p-2">
            <button
              type="button"
              onClick={() => onAccept(id)}
              className="flex flex-1 items-center justify-center gap-1 rounded-md bg-studio-brown py-1.5 text-xs font-semibold text-[#f3f1ec] hover:bg-studio-brown-hover"
            >
              <Check className="h-3.5 w-3.5" strokeWidth={2} />
              Aceptar todo
            </button>
            <button
              type="button"
              onClick={() => onReject(id)}
              className="flex flex-1 items-center justify-center gap-1 rounded-md border border-[#c9c4ba] bg-[#f7f5f1] py-1.5 text-xs font-medium text-[#5c5952] hover:text-[#1c1b19]"
            >
              <X className="h-3.5 w-3.5" strokeWidth={2} />
              Rechazar todo
            </button>
          </div>
        </>
      )}
    </div>
  );
}
