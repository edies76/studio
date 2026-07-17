'use client';

import ThinkingShine from '@/components/thinking-shine';
import { sanitizeDocumentHtml } from '@/lib/math-html';

/** Live draft stream preview in chat — compact + shine while writing */
export default function DraftStreamCard({
  html,
  status,
  done,
}: {
  html: string;
  status?: string;
  done?: boolean;
}) {
  const plain = html
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return (
    <div className="rounded-xl border border-[#e5e1d8] bg-[#faf8f5] px-3 py-2.5">
      {!done ? (
        <ThinkingShine label={status || 'Escribiendo…'} />
      ) : (
        <p className="text-[12px] font-medium text-[#2c2a26]">Listo en el lienzo</p>
      )}
      {plain && (
        <div
          className="studio-draft-preview mt-2 max-h-40 overflow-y-auto text-[11px] leading-relaxed text-neutral-600"
          dangerouslySetInnerHTML={{
            __html: sanitizeDocumentHtml(
              html
                .replace(/<script[\s\S]*?<\/script>/gi, '')
                .slice(0, 8000),
            ),
          }}
        />
      )}
    </div>
  );
}
