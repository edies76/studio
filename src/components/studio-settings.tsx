'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import type { PaperSize } from '@/lib/doc-tools';
import {
  FileText,
  Image as ImageIcon,
  Keyboard,
  LayoutTemplate,
  MessageSquare,
  MousePointer2,
  Settings2,
  X,
} from 'lucide-react';

export type AgentVisibility = 'auto' | 'always' | 'hidden';
export type AgentPermission = 'review' | 'read';

export type StudioPrefs = {
  showEditButton: boolean;
  marginPreset: 'normal' | 'narrow' | 'wide' | 'apa';
  allowImages: boolean;
  imageMaxMb: number;
  /** How the agent input appears */
  agentVisibility: AgentVisibility;
  /** Whether the agent may propose mutations or only inspect/answer. */
  agentPermission: AgentPermission;
  /** Show "open agent" inside Tools dock */
  showAgentInTools: boolean;
  /** Show format bar on text selection */
  showSelectionToolbar: boolean;
  /** Show AI pencil on selection bar */
  showSelectionAi: boolean;
  /** Letter after Ctrl for open agent (default i) */
  shortcutOpenAgent: string;
  /** Letter after Ctrl for edit selection (default e) */
  shortcutEditSelection: string;
};

export const DEFAULT_PREFS: StudioPrefs = {
  showEditButton: true,
  marginPreset: 'normal',
  allowImages: true,
  imageMaxMb: 5,
  agentVisibility: 'auto',
  agentPermission: 'review',
  showAgentInTools: true,
  showSelectionToolbar: true,
  showSelectionAi: true,
  shortcutOpenAgent: 'i',
  shortcutEditSelection: 'e',
};

type Section = 'document' | 'margins' | 'images' | 'editor' | 'agent';

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
  { id: 'agent', label: 'Agente', icon: MessageSquare },
];

const KEY_OPTIONS = ['i', 'e', 'k', 'j', 'm', 'b', 'd', 'h', '/', "'"] as const;

/** Settings modal — white toolbar language (rounded chips, soft hover, Inter) */
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
    if (open) requestAnimationFrame(() => setVisible(true));
    else setVisible(false);
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

  const set = (patch: Partial<StudioPrefs>) => onPrefsChange({ ...prefs, ...patch });

  return (
    <div
      className={cn(
        'fixed inset-0 z-[80] flex items-center justify-center p-4 transition-all duration-300',
        visible
          ? 'bg-black/25 backdrop-blur-sm opacity-100'
          : 'pointer-events-none bg-transparent opacity-0 backdrop-blur-0',
      )}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={cn(
          'flex h-[min(560px,88vh)] w-full max-w-2xl overflow-hidden rounded-2xl border border-neutral-200 bg-white font-sans shadow-[0_24px_80px_rgba(0,0,0,0.12)] transition-all duration-300',
          visible ? 'scale-100 opacity-100' : 'scale-95 opacity-0',
        )}
        style={{ fontFamily: 'Inter, Segoe UI, system-ui, sans-serif' }}
      >
        {/* Sidebar */}
        <aside className="flex w-44 shrink-0 flex-col border-r border-neutral-100 bg-neutral-50/90 p-2">
          <div className="mb-2 flex items-center justify-between px-2 py-1.5">
            <span className="text-[12px] font-semibold tracking-tight text-neutral-800">Ajustes</span>
            <button
              type="button"
              onClick={onClose}
              className="flex h-7 w-7 items-center justify-center rounded-md text-neutral-500 transition hover:bg-neutral-100 hover:text-neutral-900"
            >
              <X className="h-3.5 w-3.5" strokeWidth={1.75} />
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
                    ? 'bg-neutral-900 text-white shadow-sm'
                    : 'text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900',
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
                <Segmented
                  value={paperSize}
                  options={[
                    { id: 'letter', label: 'Letter' },
                    { id: 'legal', label: 'Legal' },
                  ]}
                  onChange={(v) => onPaperSizeChange(v as PaperSize)}
                />
              </Row>
              <Hint>Letter 8.5×11″ · Legal 8.5×14″. Los márgenes se aplican al lienzo y al export.</Hint>
            </div>
          )}

          {section === 'margins' && (
            <div className="space-y-3">
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
                  onClick={() => set({ marginPreset: m.id })}
                  className={cn(
                    'flex w-full items-center justify-between rounded-xl border px-3.5 py-3 text-left transition-colors',
                    prefs.marginPreset === m.id
                      ? 'border-neutral-900 bg-neutral-50'
                      : 'border-neutral-200 hover:border-neutral-300 hover:bg-neutral-50/80',
                  )}
                >
                  <div>
                    <div className="text-[13px] font-semibold text-neutral-900">{m.name}</div>
                    <div className="text-[11px] text-neutral-400">{m.d}</div>
                  </div>
                  <span
                    className={cn(
                      'flex h-4 w-4 items-center justify-center rounded-full border-2',
                      prefs.marginPreset === m.id
                        ? 'border-neutral-900 bg-neutral-900'
                        : 'border-neutral-300',
                    )}
                  >
                    {prefs.marginPreset === m.id && (
                      <span className="h-1.5 w-1.5 rounded-full bg-white" />
                    )}
                  </span>
                </button>
              ))}
            </div>
          )}

          {section === 'images' && (
            <div className="space-y-5">
              <Header title="Imágenes" sub="Inserción y límites" />
              <Row label="Permitir imágenes">
                <Switch on={prefs.allowImages} onChange={(v) => set({ allowImages: v })} />
              </Row>
              <Row label="Tamaño máx.">
                <select
                  value={prefs.imageMaxMb}
                  disabled={!prefs.allowImages}
                  onChange={(e) => set({ imageMaxMb: Number(e.target.value) })}
                  className="h-8 rounded-lg border border-neutral-200 bg-white px-2 text-[12px] text-neutral-800 outline-none hover:bg-neutral-50 disabled:opacity-40"
                >
                  {[2, 5, 10, 15].map((n) => (
                    <option key={n} value={n}>
                      {n} MB
                    </option>
                  ))}
                </select>
              </Row>
              <div className="rounded-xl border border-dashed border-neutral-200 bg-neutral-50 px-3 py-4 text-center text-[11px] text-neutral-400">
                Arrastrá o pegá imágenes en el lienzo. PNG, JPG, WebP.
              </div>
            </div>
          )}

          {section === 'editor' && (
            <div className="space-y-5">
              <Header title="Editor" sub="Controles sobre el papel" />
              <Row label="Botón Editar al pasar el mouse">
                <Switch on={prefs.showEditButton} onChange={(v) => set({ showEditButton: v })} />
              </Row>
              <Row label="Barra al seleccionar texto">
                <Switch
                  on={prefs.showSelectionToolbar}
                  onChange={(v) => set({ showSelectionToolbar: v })}
                />
              </Row>
              <Row label="Lápiz IA en la selección">
                <Switch
                  on={prefs.showSelectionAi}
                  onChange={(v) => set({ showSelectionAi: v })}
                  disabled={!prefs.showSelectionToolbar}
                />
              </Row>
              <Hint>La barra de selección usa el mismo estilo blanco de la toolbar superior.</Hint>
            </div>
          )}

          {section === 'agent' && (
            <div className="space-y-5">
              <Header title="Agente" sub="Input flotante, Tools y atajos" />

              <div>
                <p className="mb-2 text-[12px] font-medium text-neutral-700">Permiso de edición</p>
                <div className="flex flex-col gap-1.5">
                  {([
                    { id: 'review' as const, name: 'Proponer para revisar', d: 'Puede analizar y preparar cambios; tú decides qué entra.' },
                    { id: 'read' as const, name: 'Solo lectura', d: 'Puede leer, buscar y validar, pero no cambiar el documento.' },
                  ] as const).map((o) => (
                    <button
                      key={o.id}
                      type="button"
                      onClick={() => set({ agentPermission: o.id })}
                      className={cn(
                        'flex w-full items-start gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors',
                        prefs.agentPermission === o.id
                          ? 'border-neutral-900 bg-neutral-50'
                          : 'border-neutral-200 hover:bg-neutral-50/80',
                      )}
                    >
                      <span className={cn('mt-0.5 h-4 w-4 shrink-0 rounded-full border-2', prefs.agentPermission === o.id ? 'border-neutral-900 bg-neutral-900' : 'border-neutral-300')} />
                      <div>
                        <div className="text-[13px] font-semibold text-neutral-900">{o.name}</div>
                        <div className="text-[11px] text-neutral-400">{o.d}</div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="mb-2 text-[12px] font-medium text-neutral-700">Visibilidad del input</p>
                <div className="flex flex-col gap-1.5">
                  {(
                    [
                      {
                        id: 'auto' as const,
                        name: 'Solo cuando se abre',
                        d: 'Tools, lápiz, atajos — no está siempre en pantalla',
                      },
                      {
                        id: 'always' as const,
                        name: 'Siempre visible',
                        d: 'El input queda fijo abajo (modo clásico)',
                      },
                      {
                        id: 'hidden' as const,
                        name: 'Desactivado',
                        d: 'No se muestra; solo panel de chat lateral',
                      },
                    ] as const
                  ).map((o) => (
                    <button
                      key={o.id}
                      type="button"
                      onClick={() => set({ agentVisibility: o.id })}
                      className={cn(
                        'flex w-full items-start gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors',
                        prefs.agentVisibility === o.id
                          ? 'border-neutral-900 bg-neutral-50'
                          : 'border-neutral-200 hover:bg-neutral-50/80',
                      )}
                    >
                      <span
                        className={cn(
                          'mt-0.5 h-4 w-4 shrink-0 rounded-full border-2',
                          prefs.agentVisibility === o.id
                            ? 'border-neutral-900 bg-neutral-900'
                            : 'border-neutral-300',
                        )}
                      />
                      <div>
                        <div className="text-[13px] font-semibold text-neutral-900">{o.name}</div>
                        <div className="text-[11px] text-neutral-400">{o.d}</div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <Row label="Abrir desde Tools (flotante)">
                <Switch
                  on={prefs.showAgentInTools}
                  onChange={(v) => set({ showAgentInTools: v })}
                  disabled={prefs.agentVisibility === 'hidden'}
                />
              </Row>

              <div className="rounded-xl border border-neutral-200 bg-neutral-50/80 p-3">
                <div className="mb-2 flex items-center gap-1.5 text-[12px] font-semibold text-neutral-800">
                  <Keyboard className="h-3.5 w-3.5" strokeWidth={1.75} />
                  Atajos de teclado
                </div>
                <Row label="Abrir agente">
                  <ShortcutPicker
                    letter={prefs.shortcutOpenAgent}
                    onChange={(letter) => set({ shortcutOpenAgent: letter })}
                  />
                </Row>
                <Row label="Editar selección">
                  <ShortcutPicker
                    letter={prefs.shortcutEditSelection}
                    onChange={(letter) => set({ shortcutEditSelection: letter })}
                  />
                </Row>
                <Hint>
                  Ctrl+{prefs.shortcutOpenAgent.toUpperCase()} abre el agente · Ctrl+
                  {prefs.shortcutEditSelection.toUpperCase()} con texto seleccionado entra en modo edición.
                </Hint>
                <div className="mt-3 space-y-1 rounded-lg border border-neutral-200 bg-white px-2.5 py-2 text-[10px] text-neutral-500">
                  <p className="font-semibold text-neutral-700">Otros atajos del lienzo</p>
                  <p>
                    <kbd className="rounded border border-neutral-200 bg-neutral-50 px-1 font-mono">Ctrl</kbd>+
                    <kbd className="rounded border border-neutral-200 bg-neutral-50 px-1 font-mono">+</kbd>/
                    <kbd className="rounded border border-neutral-200 bg-neutral-50 px-1 font-mono">−</kbd> zoom
                  </p>
                  <p>
                    <kbd className="rounded border border-neutral-200 bg-neutral-50 px-1 font-mono">Ctrl</kbd>+
                    <kbd className="rounded border border-neutral-200 bg-neutral-50 px-1 font-mono">0</kbd> zoom 100%
                  </p>
                  <p>
                    <kbd className="rounded border border-neutral-200 bg-neutral-50 px-1 font-mono">Esc</kbd> cierra
                    agente (si el input está vacío)
                  </p>
                  <p>
                    <kbd className="rounded border border-neutral-200 bg-neutral-50 px-1 font-mono">Ctrl</kbd>+
                    <kbd className="rounded border border-neutral-200 bg-neutral-50 px-1 font-mono">Z</kbd> deshacer
                    (navegador / toolbar)
                  </p>
                </div>
              </div>
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
      <h2 className="text-[15px] font-semibold tracking-tight text-neutral-900">{title}</h2>
      <p className="mt-0.5 text-[11px] text-neutral-400">{sub}</p>
    </div>
  );
}

function Hint({ children }: { children: ReactNode }) {
  return <p className="text-[11px] leading-relaxed text-neutral-400">{children}</p>;
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-neutral-100 py-2.5 last:border-0">
      <span className="text-[13px] text-neutral-700">{label}</span>
      {children}
    </div>
  );
}

function Segmented({
  value,
  options,
  onChange,
}: {
  value: string;
  options: { id: string; label: string }[];
  onChange: (id: string) => void;
}) {
  return (
    <div className="flex gap-0.5 rounded-full border border-neutral-200 bg-neutral-50 p-0.5">
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          onClick={() => onChange(o.id)}
          className={cn(
            'rounded-full px-3 py-1 text-[11px] font-medium transition-colors',
            value === o.id
              ? 'bg-neutral-900 text-white shadow-sm'
              : 'text-neutral-500 hover:bg-white hover:text-neutral-900',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Switch({
  on,
  onChange,
  disabled,
}: {
  on: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      disabled={disabled}
      onClick={() => onChange(!on)}
      className={cn(
        'relative h-6 w-11 rounded-full transition-colors disabled:opacity-40',
        on ? 'bg-neutral-900' : 'bg-neutral-200',
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

function ShortcutPicker({
  letter,
  onChange,
}: {
  letter: string;
  onChange: (letter: string) => void;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <kbd className="rounded-md border border-neutral-200 bg-white px-1.5 py-0.5 font-mono text-[10px] text-neutral-500 shadow-sm">
        Ctrl
      </kbd>
      <span className="text-neutral-300">+</span>
      <select
        value={letter.toLowerCase()}
        onChange={(e) => onChange(e.target.value)}
        className="h-8 min-w-[3rem] rounded-lg border border-neutral-200 bg-white px-2 font-mono text-[12px] font-semibold uppercase text-neutral-800 outline-none hover:bg-neutral-50"
      >
        {KEY_OPTIONS.map((k) => (
          <option key={k} value={k}>
            {k === '/' ? '/' : k.toUpperCase()}
          </option>
        ))}
      </select>
    </div>
  );
}
