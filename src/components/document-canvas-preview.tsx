'use client';

import { useState, type PointerEvent } from 'react';
import { ArrowRight, Check, MousePointer2 } from 'lucide-react';

type PointerPosition = {
  x: number;
  y: number;
  active: boolean;
};

const clamp = (value: number) => Math.max(0, Math.min(100, value));

export default function DocumentCanvasPreview() {
  const [pointer, setPointer] = useState<PointerPosition>({ x: 50, y: 50, active: false });

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    if (!rect.width || !rect.height) return;

    setPointer({
      x: clamp(((event.clientX - rect.left) / rect.width) * 100),
      y: clamp(((event.clientY - rect.top) / rect.height) * 100),
      active: true,
    });
  };

  return (
    <div
      className="document-preview"
      aria-label="Interactive preview of the Docs Studio workflow"
      onPointerMove={handlePointerMove}
      onPointerLeave={() => setPointer((current) => ({ ...current, active: false }))}
    >
      <div
        className="document-preview__spotlight"
        aria-hidden="true"
        style={{ left: `${pointer.x}%`, top: `${pointer.y}%`, opacity: pointer.active ? 1 : 0.45 }}
      />

      <div className="document-preview__chrome">
        <div className="document-preview__chrome-title">
          <span className="document-preview__status-dot" aria-hidden="true" />
          Docs Studio <span>/ working canvas</span>
        </div>
        <span>Draft 01 · review mode</span>
      </div>

      <div className="document-preview__workspace">
        <div className="document-preview__brief">
          <span className="document-preview__eyebrow">01 / input</span>
          <strong>Professor&apos;s brief</strong>
          <p>Explain the method, show the work, and leave a conclusion the reader can follow.</p>
          <span className="document-preview__file">DOCX · attached</span>
        </div>

        <div className="document-preview__handoff" aria-hidden="true">
          <ArrowRight size={18} strokeWidth={1.5} />
          <span>shape</span>
        </div>

        <article className="document-preview__paper">
          <div className="document-preview__paper-topline">
            <span>Working document</span>
            <span>3 sections</span>
          </div>
          <div className="document-preview__paper-content">
            <span className="document-preview__eyebrow">Draft / ready to shape</span>
            <h3>Gaussian elimination, clearly explained.</h3>
            <p>
              The system keeps the method visible: setup, row operations, and the conclusion that follows from them.
            </p>
            <div className="document-preview__proposal">
              <span className="document-preview__proposal-mark" aria-hidden="true" />
              <div>
                <span>Suggested structure</span>
                <strong>Show the operation before the answer.</strong>
              </div>
              <Check size={16} strokeWidth={1.8} aria-label="Visible suggestion" />
            </div>
          </div>
        </article>
      </div>

      <div className="document-preview__footer">
        <span><i className="document-preview__legend document-preview__legend--brief" /> brief</span>
        <span><i className="document-preview__legend document-preview__legend--structure" /> structure</span>
        <span><i className="document-preview__legend document-preview__legend--voice" /> your voice</span>
      </div>

      <div
        className="document-preview__cursor"
        aria-hidden="true"
        style={{ left: `${pointer.x}%`, top: `${pointer.y}%`, opacity: pointer.active ? 1 : 0 }}
      >
        <MousePointer2 size={16} strokeWidth={1.7} />
      </div>
    </div>
  );
}
