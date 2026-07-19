'use client';

import type { AssignmentReview } from '@/lib/assignment-review';
import { ClipboardCheck, X } from 'lucide-react';

export default function AssignmentReviewDrawer({ open, onClose, review }: { open: boolean; onClose: () => void; review: AssignmentReview | null }) {
  if (!open) return null;
  return <div className="fixed inset-0 z-[80] flex items-center justify-center bg-[#3d3229]/35 p-4" onClick={onClose}>
    <section className="max-h-[80vh] w-full max-w-md overflow-auto rounded-xl border border-neutral-200 bg-white p-5 shadow-xl" onClick={(event) => event.stopPropagation()}>
      <header className="flex items-center justify-between border-b border-neutral-100 pb-3"><div className="flex items-center gap-2"><ClipboardCheck className="h-4 w-4" /><strong className="text-sm">Entrega</strong></div><button type="button" onClick={onClose} className="rounded p-1 text-neutral-500 hover:bg-neutral-100"><X className="h-4 w-4" /></button></header>
      {!review ? <p className="py-10 text-center text-sm text-neutral-500">Todavía no hay una consigna adjunta a este documento.</p> : <div className="space-y-5 pt-4"><div><p className="font-mono text-[10px] uppercase tracking-[.12em] text-neutral-400">{review.title}</p><p className="mt-1 text-2xl font-semibold tracking-tight">{review.covered}/{review.total} requisitos cubiertos</p></div><ReviewList title="Requisitos" items={review.requirements.map((item) => ({ label: item.label, done: item.covered }))} /><ReviewList title="Falta comprobar" items={review.missingEvidence.map((label) => ({ label, done: false }))} empty="No detecté criterios pendientes." /><ReviewList title="Recursos visuales" items={review.missingImages.map((label) => ({ label, done: false }))} empty="No hay imágenes requeridas pendientes." /><p className="border-t border-neutral-100 pt-4 text-xs leading-relaxed text-neutral-500">Este panel no modifica el documento. Pedile al agente que cubra un requisito específico o revise la entrega completa.</p></div>}
    </section>
  </div>;
}

function ReviewList({ title, items, empty }: { title: string; items: Array<{ label: string; done: boolean }>; empty?: string }) {
  return <section><p className="mb-2 font-mono text-[10px] uppercase tracking-[.12em] text-neutral-400">{title}</p>{items.length ? <ul className="space-y-1.5">{items.map((item, index) => <li key={`${item.label}-${index}`} className="flex gap-2 text-[13px] leading-snug text-neutral-700"><span className={item.done ? 'text-emerald-700' : 'text-amber-700'}>{item.done ? '✓' : '•'}</span>{item.label}</li>)}</ul> : <p className="text-[13px] text-neutral-500">{empty}</p>}</section>;
}
