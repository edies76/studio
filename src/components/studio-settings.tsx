'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import type { PaperSize } from '@/lib/doc-tools';
import {
  FileText,
  Image as ImageIcon,
  LayoutTemplate,
  MousePointer2,
  Settings2,
  X,
} from 'lucide-react';

export type StudioPrefs = {
  showEditButton: boolean;
  marginPreset: 'normal' | 'narrow' | 'wide' | 'apa';
  allowImages: boolean;
  imageMaxMb: number;
};

export const DEFAULT_PREFS: StudioPrefs = {
  showEditButton: true,
  marginPreset: 'normal',
  allowImages: true,
  imageMaxMb: 5,
};

type Section = 'document' | 'margins' | 'images' | 'editor';

type Props = {
  open: boolean;
  onClose: () => void;
  paperSize: PaperSize;
  onPaperSizeChange: (s: PaperSize) => void;
  prefs: StudioPrefs;
  onPrefsChange: (p: StudioPrefs) => void;
};

const SECTIONS: { id: Section; label: string; icon: typeof Settings2 }[] = [
  { id: 'document', label: 'Documento', icon: FileText },
  { id: 'margins', label: 'Márgenes', icon: LayoutTemplate },
  { id: 'images', label: 'Imágenes', icon: ImageIcon },
  { id: 'editor', label: 'Editor', icon: MousePointer2 },
];

/** ChatGPT-style settings: sidebar + panel, blur enter/exit */
export default function StudioSettings({
  open,
  onClose,
  paperSize,
  onPaperSizeChange,
  prefs,
  onPrefsChange,
}: Props) {
  const [section, setSection] = useState<Section>('document');
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (open) {
      requestAnimationFrame(() => setVisible(true));
    } else {
      setVisible(false);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open && !visible) return null;

  return (
    <div
      className={cn(
        'fixed inset-0 z-[80] flex items-center justify-center p-4 transition-all duration-300',
        visible
          ? 'bg-[#3d3229]/40 backdrop-blur-sm opacity-100'
          : 'bg-transparent backdrop-blur-0 opacity-0 pointer-events-none',
      )}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={cn(
          'flex h-[min(520px,85vh)] w-full max-w-2xl overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-2xl transition-all duration-300',
          visible ? 'scale-100 opacity-100 blur-0' : 'scale-95 opacity-0 blur-sm',
        )}
      >
        {/* Sidebar */}
        <aside className="flex w-44 shrink-0 flex-col border-r border-neutral-100 bg-neutral-50/80 p-2">
          <div className="mb-2 flex items-center justify-between px-2 py-1.5">
            <span className="text-xs font-semibold text-neutral-800">Ajustes</span>
            <button
              type="button"
              onClick={onClose}
              className="rounded-md p-1 text-neutral-400 hover:bg-neutral-200/80 hover:text-neutral-800"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          {SECTIONS.map((s) => {
            const Icon = s.icon;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => setSection(s.id)}
                className={cn(
                  'mb-0.5 flex items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[12px] font-medium transition-colors',
                  section === s.id
                    ? 'bg-studio-brown text-white'
                    : 'text-neutral-600 hover:bg-neutral-200/70 hover:text-neutral-900',
                )}
              >
                <Icon className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} />
                {s.label}
              </button>
            );
          })}
        </aside>

        {/* Content */}
        <div className="min-w-0 flex-1 overflow-y-auto p-5">
          {section === 'document' && (
            <div className="space-y-5">
              <Header title="Documento" sub="Tamaño de página y formato base" />
              <Row label="Tamaño de hoja">
                <div className="flex gap-1 rounded-full border border-neutral-200 bg-neutral-50 p-0.5">
                  {(['letter', 'legal'] as PaperSize[]).map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => onPaperSizeChange(s)}
                      className={cn(
                        'rounded-full px-3 py-1 text-[11px] font-medium capitalize transition-colors',
                        paperSize === s
                          ? 'bg-studio-brown text-white'
                          : 'text-neutral-500 hover:text-neutral-900',
                      )}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </Row>
              <p className="text-[11px] leading-relaxed text-neutral-400">
                Letter 8.5×11″ · Legal 8.5×14″. Los márgenes se aplican al lienzo y al export.
              </p>
            </div>
          )}

          {section === 'margins' && (
            <div className="space-y-5">
              <Header title="Márgenes" sub="Plantillas de espacio en página" />
              {(
                [
                  { id: 'normal' as const, name: 'Normal', d: '2.54 cm (1″) — estándar' },
                  { id: 'narrow' as const, name: 'Estrecho', d: '1.27 cm — más contenido' },
                  { id: 'wide' as const, name: 'Ancho', d: '3.18 cm — aire editorial' },
                  { id: 'apa' as const, name: 'APA', d: '2.54 cm + sangría de párrafo' },
                ] as const
              ).map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => onPrefsChange({ ...prefs, marginPreset: m.id })}
                  className={cn(
                    'flex w-full items-center justify-between rounded-xl border px-3.5 py-3 text-left transition-colors',
                    prefs.marginPreset === m.id
                      ? 'border-studio-brown bg-neutral-50'
                      : 'border-neutral-200 hover:border-neutral-300',
                  )}
                >
                  <div>
                    <div className="text-[13px] font-semibold text-neutral-900">{m.name}</div>
                    <div className="text-[11px] text-neutral-400">{m.d}</div>
                  </div>
                  <span
                    className={cn(
                      'h-4 w-4 rounded-full border-2',
                      prefs.marginPreset === m.id
                        ? 'border-studio-brown bg-studio-brown'
                        : 'border-neutral-300',
                    )}
                  />
                </button>
              ))}
            </div>
          )}

          {section === 'images' && (
            <div className="space-y-5">
              <Header title="Imágenes" sub="Inserción y límites (próximamente en el lienzo)" />
              <Row label="Permitir imágenes">
                <Switch
                  on={prefs.allowImages}
                  onChange={(v) => onPrefsChange({ ...prefs, allowImages: v })}
                />
              </Row>
              <Row label="Tamaño máx.">
                <select
                  value={prefs.imageMaxMb}
                  disabled={!prefs.allowImages}
                  onChange={(e) =>
                    onPrefsChange({ ...prefs, imageMaxMb: Number(e.target.value) })
                  }
                  className="rounded-lg border border-neutral-200 bg-white px-2 py-1 text-[12px] disabled:opacity-40"
                >
                  {[2, 5, 10, 15].map((n) => (
                    <option key={n} value={n}>
                      {n} MB
                    </option>
                  ))}
                </select>
              </Row>
              <p className="rounded-xl border border-dashed border-neutral-200 bg-neutral-50 px-3 py-4 text-center text-[11px] text-neutral-400">
                Arrastrá o pegá imágenes en el lienzo cuando esté activo.
                Formatos: PNG, JPG, WebP.
              </p>
            </div>
          )}

          {section === 'editor' && (
            <div className="space-y-5">
              <Header title="Editor" sub="Controles sobre el papel" />
              <Row label="Botón Editar al pasar el mouse">
                <Switch
                  on={prefs.showEditButton}
                  onChange={(v) => onPrefsChange({ ...prefs, showEditButton: v })}
                />
              </Row>
              <p className="text-[11px] text-neutral-400">
                Si está apagado, podés seguir seleccionando texto y usando tools / prompt.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Header({ title, sub }: { title: string; sub: string }) {
  return (
    <div>
      <h2 className="text-[15px] font-semibold text-neutral-900">{title}</h2>
      <p className="mt-0.5 text-[11px] text-neutral-400">{sub}</p>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-neutral-100 py-3">
      <span className="text-[13px] text-neutral-700">{label}</span>
      {children}
    </div>
  );
}

function Switch({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => onChange(!on)}
      className={cn(
        'relative h-6 w-11 rounded-full transition-colors',
        on ? 'bg-studio-brown' : 'bg-neutral-200',
      )}
    >
      <span
        className={cn(
          'absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform',
          on ? 'left-5' : 'left-0.5',
        )}
      />
    </button>
  );
}
