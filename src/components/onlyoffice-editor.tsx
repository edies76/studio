'use client';

import { useEffect, useId, useState } from 'react';

declare global { interface Window { DocsAPI?: { DocEditor: new (id: string, config: Record<string, unknown>) => unknown } } }

export default function OnlyOfficeEditor({ documentId, onClose }: { documentId: string; onClose: () => void }) {
  const id = `onlyoffice-${useId().replace(/[^a-z0-9_-]/gi, '')}`;
  const [error, setError] = useState('');
  useEffect(() => {
    let disposed = false;
    let script: HTMLScriptElement | null = null;
    void (async () => {
      try {
        const response = await fetch(`/api/docs/${documentId}/office-config`, { cache: 'no-store' });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || 'No se pudo preparar el modo Word.');
        script = document.createElement('script');
        script.src = `${payload.officeUrl}/web-apps/apps/api/documents/api.js`;
        script.async = true;
        script.onload = () => { if (!disposed && window.DocsAPI) new window.DocsAPI.DocEditor(id, payload.config); };
        script.onerror = () => setError('No se pudo cargar el motor de documentos. Revisa NEXT_PUBLIC_ONLYOFFICE_URL.');
        document.head.appendChild(script);
      } catch (cause: any) { if (!disposed) setError(cause?.message || 'No se pudo abrir el modo Word.'); }
    })();
    return () => { disposed = true; script?.remove(); };
  }, [documentId, id]);
  return <div className="fixed inset-0 z-[100] bg-[#f3f4f6]"><div className="flex h-12 items-center justify-between border-b border-neutral-200 bg-white px-4"><div><strong className="text-sm text-neutral-900">Modo Word</strong><span className="ml-2 text-xs text-neutral-500">Formato OOXML original</span></div><button type="button" onClick={onClose} className="rounded-md border border-neutral-200 px-3 py-1.5 text-xs font-semibold text-neutral-700 hover:bg-neutral-50">Volver a Docs Studio</button></div>{error ? <div className="grid h-[calc(100%-3rem)] place-items-center p-8 text-center"><div><p className="font-semibold text-neutral-900">Modo Word no disponible</p><p className="mt-2 max-w-md text-sm text-neutral-500">{error}</p></div></div> : <div id={id} className="h-[calc(100%-3rem)] w-full" />}</div>;
}
