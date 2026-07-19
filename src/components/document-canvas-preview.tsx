import { ArrowRight, Check } from 'lucide-react';

export default function DocumentCanvasPreview() {
  return (
    <div className="document-preview" aria-label="Preview of the Docs Studio workflow">

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

    </div>
  );
}
