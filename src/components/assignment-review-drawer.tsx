'use client';

import type { AssignmentReview } from '@/lib/assignment-review';
import type { DeliveryBoardUpdate } from '@/lib/doc-tools';
import { CheckCircle2, CircleDot, ClipboardCheck, OctagonAlert, RefreshCw, X } from 'lucide-react';

export default function AssignmentReviewDrawer({ open, onClose, review, delivery, onRefresh }: {
  open: boolean;
  onClose: () => void;
  review: AssignmentReview | null;
  delivery: DeliveryBoardUpdate | null;
  onRefresh?: () => void;
}) {
  if (!open) return null;
  const boardItems = delivery?.items || [];
  return <div className="fixed inset-0 z-[80] flex items-center justify-center bg-[#3d3229]/35 p-4" onClick={onClose}>
    <section className="max-h-[84vh] w-full max-w-lg overflow-auto rounded-xl border border-neutral-200 bg-white p-5 shadow-xl" onClick={(event) => event.stopPropagation()}>
      <header className="flex items-center justify-between border-b border-neutral-100 pb-3">
        <div className="flex items-center gap-2"><ClipboardCheck className="h-4 w-4" /><div><strong className="block text-sm">Delivery</strong><span className="text-[11px] text-neutral-500">Brief progress, checked against the current document</span></div></div>
        <div className="flex items-center gap-1"><button type="button" onClick={onRefresh} className="rounded p-1.5 text-neutral-500 hover:bg-neutral-100" title="Refresh document checks"><RefreshCw className="h-3.5 w-3.5" /></button><button type="button" onClick={onClose} className="rounded p-1 text-neutral-500 hover:bg-neutral-100"><X className="h-4 w-4" /></button></div>
      </header>

      <div className="space-y-5 pt-4">
        {delivery && <section><p className="mb-2 font-mono text-[10px] uppercase tracking-[.12em] text-neutral-400">Agent workboard</p><p className="mb-3 text-[13px] leading-relaxed text-neutral-700">{delivery.summary}</p><ul className="space-y-2">{boardItems.map((item) => <li key={item.id} className="rounded-md border border-neutral-100 px-3 py-2"><div className="flex items-start gap-2 text-[13px] font-medium text-neutral-800"><StatusIcon status={item.status} /><span>{item.label}</span></div>{item.note && <p className="ml-5 mt-1 text-[11px] leading-relaxed text-neutral-500">{item.note}</p>}</li>)}</ul></section>}

        {!review ? <p className="py-5 text-center text-sm text-neutral-500">Attach an assignment guide to turn Delivery into a rubric-aware checklist.</p> : <section className="space-y-4"><div><p className="font-mono text-[10px] uppercase tracking-[.12em] text-neutral-400">Verified coverage</p><p className="mt-1 text-2xl font-semibold tracking-tight">{review.covered}/{review.total} requirements covered</p><p className="mt-1 text-[11px] text-neutral-500">This count is recalculated from the current document—not claimed by the agent.</p></div><ReviewList title="Requirements" items={review.requirements.map((item) => ({ label: item.label, done: item.covered }))} /><ReviewList title="Evidence to strengthen" items={review.missingEvidence.map((label) => ({ label, done: false }))} empty="No evidence gaps detected." /><ReviewList title="Required visuals" items={review.missingImages.map((label) => ({ label, done: false }))} empty="No pending required visuals." /></section>}
      </div>
    </section>
  </div>;
}

function StatusIcon({ status }: { status: 'done' | 'working' | 'blocked' }) {
  return status === 'done' ? <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-700" /> : status === 'blocked' ? <OctagonAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-700" /> : <CircleDot className="mt-0.5 h-3.5 w-3.5 shrink-0 text-stone-500" />;
}

function ReviewList({ title, items, empty }: { title: string; items: Array<{ label: string; done: boolean }>; empty?: string }) {
  return <section><p className="mb-2 font-mono text-[10px] uppercase tracking-[.12em] text-neutral-400">{title}</p>{items.length ? <ul className="space-y-1.5">{items.map((item, index) => <li key={`${item.label}-${index}`} className="flex gap-2 text-[13px] leading-snug text-neutral-700"><span className={item.done ? 'text-emerald-700' : 'text-amber-700'}>{item.done ? '✓' : '•'}</span>{item.label}</li>)}</ul> : <p className="text-[13px] text-neutral-500">{empty}</p>}</section>;
}
