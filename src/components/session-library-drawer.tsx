'use client';

import { FileText, Library, X } from 'lucide-react';

export type SessionSource = { id: string; name: string; sentAt: number };

export default function SessionLibraryDrawer({ open, onClose, sources }: { open: boolean; onClose: () => void; sources: SessionSource[] }) {
  if (!open) return null;
  return <div className="fixed inset-0 z-[80] flex items-center justify-center bg-[#3d3229]/35 p-4" onClick={onClose}>
    <section className="max-h-[76vh] w-full max-w-md overflow-auto rounded-xl border border-neutral-200 bg-white p-5 shadow-xl" onClick={(event) => event.stopPropagation()}>
      <header className="flex items-center justify-between border-b border-neutral-100 pb-3"><div className="flex items-center gap-2"><Library className="h-4 w-4" /><div><strong className="block text-sm">Session Library</strong><span className="text-[11px] text-neutral-500">Reference files sent to the agent in this session</span></div></div><button type="button" onClick={onClose} className="rounded p-1 text-neutral-500 hover:bg-neutral-100"><X className="h-4 w-4" /></button></header>
      {sources.length ? <ul className="mt-4 divide-y divide-neutral-100">{sources.map((source) => <li key={source.id} className="flex items-center gap-3 py-3"><span className="flex h-8 w-8 items-center justify-center rounded-md bg-neutral-100 text-neutral-600"><FileText className="h-4 w-4" /></span><span className="min-w-0 flex-1"><strong className="block truncate text-[13px] text-neutral-800">{source.name}</strong><small className="text-[11px] text-neutral-500">Read by the agent · {new Date(source.sentAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</small></span></li>)}</ul> : <div className="py-12 text-center"><Library className="mx-auto h-7 w-7 text-neutral-300" /><p className="mt-3 text-sm font-medium text-neutral-700">No session sources yet</p><p className="mx-auto mt-1 max-w-[240px] text-[12px] leading-relaxed text-neutral-500">Attach a Word, TXT, or Markdown file from the chat composer, then send it with a message.</p></div>}
    </section>
  </div>;
}
