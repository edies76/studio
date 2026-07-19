'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import type { ChatEvent } from '@/components/chat-event-card';
import { History, X } from 'lucide-react';

export type HistoryItem = {
  id: string;
  at: number;
  event: ChatEvent;
};

export type VersionSnapshot = {
  id: string;
  label: string;
  html: string;
  createdAt: number;
  source: 'agent' | 'manual' | 'restore' | 'system';
};

type Props = {
  open: boolean;
  onClose: () => void;
  items: HistoryItem[];
  versions?: VersionSnapshot[];
  onRestoreVersion?: (id: string) => void;
};

/** Git-like change log — not inline spam */
export default function HistoryDrawer({ open, onClose, items, versions = [], onRestoreVersion }: Props) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (open) requestAnimationFrame(() => setVisible(true));
    else setVisible(false);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
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
          : 'pointer-events-none opacity-0',
      )}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={cn(
          'flex h-[min(480px,80vh)] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-2xl transition-all duration-300',
          visible ? 'scale-100 opacity-100 blur-0' : 'scale-95 opacity-0 blur-sm',
        )}
      >
        <div className="flex items-center justify-between border-b border-neutral-100 px-4 py-3">
          <div className="flex items-center gap-2">
            <History className="h-4 w-4 text-neutral-700" strokeWidth={1.75} />
            <span className="text-sm font-semibold text-neutral-900">Historial</span>
            <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] font-medium text-neutral-500">
              {items.length + versions.length}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-800"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-3 py-2">
          {versions.length > 0 && (
            <section className="mb-4">
              <div className="mb-2 flex items-center justify-between px-2">
                <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-neutral-400">Versiones seguras</p>
                <span className="font-mono text-[10px] text-neutral-400">{versions.length}</span>
              </div>
              {[...versions].map((version) => (
                <div key={version.id} className="mb-1.5 rounded-lg border border-neutral-200 bg-white px-3 py-2.5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-[12px] font-semibold text-neutral-800">{version.label}</p>
                      <p className="mt-0.5 font-mono text-[10px] text-neutral-400">
                        {version.source} · {new Date(version.createdAt).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                      </p>
                    </div>
                    {onRestoreVersion && (
                      <button type="button" onClick={() => onRestoreVersion(version.id)} className="shrink-0 rounded-md border border-neutral-200 px-2 py-1 text-[10px] font-semibold text-neutral-700 hover:bg-neutral-50">
                        Restaurar
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </section>
          )}
          {items.length === 0 && versions.length === 0 ? (
            <p className="px-2 py-10 text-center text-[12px] text-neutral-400">
              Todavía no hay cambios puntuales.
            </p>
          ) : (
            [...items].reverse().map((it) => (
              <div
                key={it.id}
                className="mb-1.5 rounded-xl border border-neutral-100 bg-neutral-50/80 px-3 py-2.5"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[12px] font-semibold text-neutral-800">
                    {it.event.title}
                  </span>
                  <span className="font-mono text-[10px] text-neutral-400">
                    {new Date(it.at).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
                {it.event.summary && (
                  <p className="mt-0.5 text-[11px] text-neutral-500">{it.event.summary}</p>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
