'use client';

import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { typesetEditor } from '@/lib/math-html';

type Props = {
  open: boolean;
  initialTex: string;
  initialDisplay: boolean;
  onCancel: () => void;
  onAccept: (tex: string, display: boolean) => void;
};

/** Small, deliberately focused LaTeX editor for one document equation. */
export default function EquationEditorDialog({
  open,
  initialTex,
  initialDisplay,
  onCancel,
  onAccept,
}: Props) {
  const [tex, setTex] = useState(initialTex);
  const [display, setDisplay] = useState(initialDisplay);
  const previewRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    setTex(initialTex);
    setDisplay(initialDisplay);
  }, [initialDisplay, initialTex, open]);

  useEffect(() => {
    const preview = previewRef.current;
    if (!preview || !open) return;
    preview.textContent = tex.trim()
      ? display
        ? `\\[${tex}\\]`
        : `\\(${tex}\\)`
      : 'Escribí LaTeX para ver la vista previa';
    if (tex.trim()) typesetEditor(preview);
  }, [display, open, tex]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/20 px-4"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onCancel();
      }}
    >
      <section
        aria-labelledby="equation-editor-title"
        aria-modal="true"
        role="dialog"
        className="w-full max-w-[560px] rounded-2xl border border-[#d8d1c8] bg-[#fffdfa] p-5 text-[#211b17] shadow-[0_24px_80px_rgba(38,29,23,0.2)]"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-[#8b4a34]">Objeto ecuación</p>
            <h2 id="equation-editor-title" className="mt-1 text-lg font-semibold tracking-[-0.02em]">Editar LaTeX</h2>
            <p className="mt-1 text-xs leading-5 text-[#75695e]">La ecuación conserva su fuente y se exporta como objeto matemático de Word.</p>
          </div>
          <button type="button" onClick={onCancel} aria-label="Cerrar" className="rounded-lg p-1.5 text-[#75695e] hover:bg-[#f0ece6]">
            <X className="h-4 w-4" strokeWidth={1.7} />
          </button>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2 rounded-xl bg-[#f2eee8] p-1">
          <button
            type="button"
            onClick={() => setDisplay(false)}
            className={`rounded-lg px-3 py-2 text-xs font-medium ${!display ? 'bg-white text-[#211b17] shadow-sm' : 'text-[#75695e]'}`}
          >
            En línea
          </button>
          <button
            type="button"
            onClick={() => setDisplay(true)}
            className={`rounded-lg px-3 py-2 text-xs font-medium ${display ? 'bg-white text-[#211b17] shadow-sm' : 'text-[#75695e]'}`}
          >
            Bloque centrado
          </button>
        </div>

        <label className="mt-4 block text-[10px] font-semibold uppercase tracking-[0.12em] text-[#75695e]" htmlFor="equation-latex-input">
          Fuente LaTeX
        </label>
        <textarea
          id="equation-latex-input"
          autoFocus
          value={tex}
          onChange={(event) => setTex(event.target.value)}
          spellCheck={false}
          className="mt-2 min-h-[98px] w-full resize-y rounded-xl border border-[#cfc5ba] bg-white px-3 py-2.5 font-mono text-sm leading-6 text-[#211b17] outline-none focus:border-[#8b4a34]"
          placeholder="\\frac{-b \\pm \\sqrt{b^2-4ac}}{2a}"
        />

        <div className="mt-4 rounded-xl border border-[#e0d9d0] bg-white px-4 py-5">
          <div className="mb-3 flex items-center justify-between text-[10px] uppercase tracking-[0.12em] text-[#9a8e82]">
            <span>Vista previa</span>
            <span>{display ? 'display math' : 'inline math'}</span>
          </div>
          <div ref={previewRef} className="min-h-10 text-center text-[#211b17] [&_.MathJax]:!text-[1.1em]" />
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onCancel} className="rounded-lg border border-[#cfc5ba] px-3.5 py-2 text-xs font-medium text-[#75695e] hover:bg-[#f4f0eb]">Cancelar</button>
          <button
            type="button"
            disabled={!tex.trim()}
            onClick={() => onAccept(tex.trim(), display)}
            className="rounded-lg bg-[#3d3229] px-4 py-2 text-xs font-semibold text-[#fffaf4] hover:bg-[#2a221c] disabled:cursor-not-allowed disabled:opacity-40"
          >
            Aceptar cambio
          </button>
        </div>
      </section>
    </div>
  );
}
