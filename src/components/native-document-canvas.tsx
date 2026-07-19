'use client';

import { useMemo } from 'react';
import { PAPER } from '@/components/paper-canvas';
import { layoutNativeDocument } from '@/lib/native-layout';
import type { StudioBlock, StudioDocumentModel } from '@/lib/studio-document';

type Props = {
  document: StudioDocumentModel;
  paperSize: 'letter' | 'legal' | 'a4';
  fontFamily: string;
  fontSize: string;
  editable?: boolean;
  onChange: (next: StudioDocumentModel) => void;
};

function blockText(block: StudioBlock) {
  if ('runs' in block) return block.runs.map((run) => run.text).join('');
  if (block.type === 'list') return block.items.map((item) => item.runs.map((run) => run.text).join('')).join('\n');
  return '';
}

/** Native page renderer. Blocks are positioned from `native-layout`, while
 * text edits emit a new StudioDocumentModel instead of serializing DOM HTML. */
export default function NativeDocumentCanvas({ document, paperSize, fontFamily, fontSize, editable = true, onChange }: Props) {
  const paper = PAPER[paperSize];
  const numericFont = Number.parseFloat(fontSize) || 12;
  const layout = useMemo(
    () => layoutNativeDocument(document, { width: paper.widthPx, height: paper.heightPx, margin: 72, fontSize: numericFont, lineHeight: numericFont * 1.5 }),
    [document, numericFont, paper.heightPx, paper.widthPx],
  );
  const updateText = (id: string, value: string) => {
    onChange({
      ...document,
      blocks: document.blocks.map((block) => {
        if (block.id !== id || !('runs' in block)) return block;
        return { ...block, runs: [{ text: value }] } as StudioBlock;
      }),
    });
  };

  return <div className="h-full overflow-auto bg-neutral-100 p-8" style={{ fontFamily }}>
    <div className="mx-auto flex w-fit flex-col gap-7">
      {layout.pages.map((page, index) => <section key={index} className="relative bg-white shadow-sm" style={{ width: paper.widthPx, height: paper.heightPx }}>
        {page.map(({ block, x, y, width, height }) => {
          const common = { key: block.id, style: { position: 'absolute' as const, left: x, top: y, width, minHeight: height } };
          if (block.type === 'image') return <img {...common} src={block.src} alt={block.alt} style={{ ...common.style, width: block.width || width, height: block.height || 'auto' }} draggable={false} />;
          if (block.type === 'table') return <table {...common} className="border-collapse text-sm"><tbody>{block.rows.map((row) => <tr key={row.id}>{row.cells.map((cell) => <td key={cell.id} className="border border-neutral-300 px-2 py-1">{cell.runs.map((run) => run.text).join('')}</td>)}</tr>)}</tbody></table>;
          if (block.type === 'list') return <div {...common} className="whitespace-pre-wrap" contentEditable={editable} suppressContentEditableWarning onInput={(event) => updateText(block.id, event.currentTarget.textContent || '')}>{blockText(block)}</div>;
          if ('runs' in block) return <div {...common} className={block.type === 'heading' ? 'font-bold' : ''} contentEditable={editable} suppressContentEditableWarning onInput={(event) => updateText(block.id, event.currentTarget.textContent || '')}>{blockText(block)}</div>;
          return null;
        })}
      </section>)}
    </div>
  </div>;
}
