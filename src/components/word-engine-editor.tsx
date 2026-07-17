'use client';

/**
 * Real Word document engine — Syncfusion Document Editor (DOCX).
 * Native pages, styles, tables, headers — not HTML contentEditable.
 */

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import {
  DocumentEditorContainerComponent,
  Toolbar,
} from '@syncfusion/ej2-react-documenteditor';
import { registerLicense } from '@syncfusion/ej2-base';
import { cn } from '@/lib/utils';

// Syncfusion styles (Word UI chrome)
import '@syncfusion/ej2-base/styles/material.css';
import '@syncfusion/ej2-buttons/styles/material.css';
import '@syncfusion/ej2-inputs/styles/material.css';
import '@syncfusion/ej2-popups/styles/material.css';
import '@syncfusion/ej2-lists/styles/material.css';
import '@syncfusion/ej2-navigations/styles/material.css';
import '@syncfusion/ej2-splitbuttons/styles/material.css';
import '@syncfusion/ej2-dropdowns/styles/material.css';
import '@syncfusion/ej2-react-documenteditor/styles/material.css';

DocumentEditorContainerComponent.Inject(Toolbar);

const DEFAULT_SERVICE =
  process.env.NEXT_PUBLIC_WORD_ENGINE_SERVICE_URL ||
  'https://document.syncfusion.com/web-services/docx-editor/api/documenteditor/';

const LICENSE = process.env.NEXT_PUBLIC_SYNCFUSION_LICENSE || '';

let licenseRegistered = false;
function ensureLicense() {
  if (licenseRegistered) return;
  try {
    if (LICENSE) registerLicense(LICENSE);
  } catch {
    /* trial / community banner ok */
  }
  licenseRegistered = true;
}

export type WordEngineHandle = {
  /** Open a real .docx binary (uses conversion service → SFDT) */
  openDocxFile: (file: File) => Promise<void>;
  /** Open SFDT JSON string */
  openSfdt: (sfdt: string) => void;
  /** Export current doc as DOCX blob (client-side) */
  saveAsDocxBlob: () => Promise<Blob | null>;
  /** Get SFDT for persistence */
  getSfdt: () => string;
  focus: () => void;
};

type Props = {
  className?: string;
  height?: string | number;
  /** Called when user edits */
  onContentChange?: () => void;
  documentTitle?: string;
};

const WordEngineEditor = forwardRef<WordEngineHandle, Props>(function WordEngineEditor(
  { className, height = '100%', onContentChange, documentTitle },
  ref,
) {
  const containerRef = useRef<DocumentEditorContainerComponent | null>(null);
  const [ready, setReady] = useState(false);
  const [status, setStatus] = useState<string | null>('Cargando motor Word…');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    ensureLicense();
  }, []);

  useImperativeHandle(
    ref,
    () => ({
      openDocxFile: async (file: File) => {
        const container = containerRef.current;
        if (!container?.documentEditor) {
          throw new Error('Motor Word no listo');
        }
        setError(null);
        setStatus('Abriendo documento…');
        try {
          const formData = new FormData();
          formData.append('files', file);
          // Syncfusion DocumentEditor Web API — Import DOCX → SFDT
          const base = DEFAULT_SERVICE.replace(/\/?$/, '/');
          const res = await fetch(`${base}Import`, {
            method: 'POST',
            body: formData,
          });
          if (!res.ok) {
            throw new Error(`Import falló (${res.status}). ¿Servicio de conversión disponible?`);
          }
          const sfdt = await res.text();
          container.documentEditor.open(sfdt);
          if (documentTitle) {
            container.documentEditor.documentName = documentTitle.replace(/\.docx$/i, '');
          } else {
            container.documentEditor.documentName = file.name.replace(/\.docx$/i, '');
          }
          setStatus(null);
        } catch (e: any) {
          setError(e?.message || 'No se pudo abrir el .docx');
          setStatus(null);
          throw e;
        }
      },
      openSfdt: (sfdt: string) => {
        const ed = containerRef.current?.documentEditor;
        if (!ed) return;
        ed.open(sfdt);
        setStatus(null);
        setError(null);
      },
      saveAsDocxBlob: async () => {
        const ed = containerRef.current?.documentEditor;
        if (!ed) return null;
        // Client-side DOCX export (no server needed for DOCX)
        const blob = await ed.saveAsBlob('Docx');
        return blob;
      },
      getSfdt: () => {
        const ed = containerRef.current?.documentEditor;
        if (!ed) return '';
        return ed.serialize();
      },
      focus: () => {
        containerRef.current?.documentEditor?.focusIn();
      },
    }),
    [documentTitle],
  );

  return (
    <div className={cn('relative flex h-full min-h-0 w-full flex-col bg-neutral-100', className)}>
      {(status || error) && (
        <div
          className={cn(
            'absolute left-1/2 top-3 z-20 -translate-x-1/2 rounded-full border px-3 py-1.5 text-[11px] font-medium shadow-md',
            error
              ? 'border-red-200 bg-white text-red-700'
              : 'border-neutral-200 bg-white text-neutral-600',
          )}
        >
          {error || status}
        </div>
      )}
      <div className="min-h-0 flex-1" style={{ height }}>
        <DocumentEditorContainerComponent
          id="studio-word-engine"
          ref={(r: DocumentEditorContainerComponent | null) => {
            containerRef.current = r;
          }}
          height="100%"
          enableToolbar
          showPropertiesPane={false}
          serviceUrl={DEFAULT_SERVICE}
          created={() => {
            setReady(true);
            setStatus(null);
            const ed = containerRef.current?.documentEditor;
            if (ed) {
              ed.documentName = documentTitle || 'Documento';
              ed.pageOutline = '#e5e5e5';
              // Content change
              ed.contentChange = () => onContentChange?.();
            }
          }}
          // Locale-ish chrome
          locale="es-ES"
        />
      </div>
      {!ready && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-neutral-100/80">
          <p className="text-[13px] font-medium text-neutral-500">Iniciando motor de documentos…</p>
        </div>
      )}
    </div>
  );
});

export default WordEngineEditor;

/** Blank SFDT document (minimal) for new files in the engine */
export const BLANK_SFDT = JSON.stringify({
  sections: [
    {
      blocks: [
        {
          inlines: [{ text: '' }],
        },
      ],
      headersFooters: {},
    },
  ],
});
