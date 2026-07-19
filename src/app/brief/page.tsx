'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import BrandMark from '@/components/brand-mark';
import LocaleSwitch from '@/components/locale-switch';
import { importDocxToHtml } from '@/lib/import-docx';
import { useLocale } from '@/lib/i18n/locale-context';

type ReferenceDoc = {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  text: string;
};

type Template = {
  id: string;
  label: string;
  description: string;
  structure: string;
  starter: string;
};

const templates: Template[] = [
  {
    id: 'apa-essay',
    label: 'Ensayo APA',
    description: 'Argumento, evidencia y referencias con una estructura académica clara.',
    structure: 'Portada · Introducción · Desarrollo · Discusión · Referencias',
    starter: 'Elabora un ensayo académico siguiendo APA 7. Tema: [escribe el tema]. Incluye una tesis clara, argumentos respaldados por fuentes, discusión de límites y referencias. La extensión y las fuentes deben seguir la guía adjunta.',
  },
  {
    id: 'lab-report',
    label: 'Informe de laboratorio',
    description: 'Convierte método, datos y observaciones en un informe reproducible.',
    structure: 'Pregunta · Método · Datos · Análisis · Conclusión',
    starter: 'Prepara un informe de laboratorio. Explica la pregunta, el método, las variables, los datos observados, el análisis y una conclusión conectada con la evidencia. Señala cualquier dato que falte en vez de inventarlo.',
  },
  {
    id: 'literature-review',
    label: 'Revisión de literatura',
    description: 'Organiza fuentes por ideas y deja visible qué evidencia sostiene cada punto.',
    structure: 'Alcance · Temas · Comparación · Vacíos · Síntesis',
    starter: 'Redacta una revisión de literatura sobre [tema]. Agrupa las fuentes por temas, compara sus métodos y conclusiones, identifica desacuerdos y termina con vacíos de investigación. No inventes citas ni resultados.',
  },
  {
    id: 'project-brief',
    label: 'Informe de proyecto',
    description: 'De una consigna dispersa a entregables, responsables y criterios de revisión.',
    structure: 'Contexto · Objetivos · Plan · Riesgos · Entregables',
    starter: 'Convierte esta consigna en un informe de proyecto revisable. Extrae objetivos, entregables, supuestos, restricciones, riesgos y criterios para saber cuándo está terminado.',
  },
];

function textFromHtml(html: string) {
  const root = document.createElement('div');
  root.innerHTML = html;
  return (root.textContent || '').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
}

function readableSize(size: number) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

export default function BriefPage() {
  const router = useRouter();
  const { locale } = useLocale();
  const isEs = locale === 'es';
  const fileRef = useRef<HTMLInputElement>(null);
  const [selectedTemplate, setSelectedTemplate] = useState('apa-essay');
  const [text, setText] = useState('');
  const [references, setReferences] = useState<ReferenceDoc[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const selected = templates.find((template) => template.id === selectedTemplate) || templates[0];

  const applyTemplate = (template: Template) => {
    setSelectedTemplate(template.id);
    setError('');
  };

  const readReference = async (file: File) => {
    setError('');
    try {
      let fileText = '';
      if (/\.docx$/i.test(file.name) || file.type.includes('wordprocessingml')) {
        const imported = await importDocxToHtml(await file.arrayBuffer(), file.name);
        fileText = textFromHtml(imported.html);
      } else if (file.type === 'text/plain' || /\.(txt|md|markdown)$/i.test(file.name)) {
        fileText = await file.text();
      } else {
        throw new Error(isEs ? 'Por ahora agrega archivos .docx, .txt o .md.' : 'For now, add .docx, .txt, or .md files.');
      }
      setReferences((items) => [...items, {
        id: `${file.name}-${file.lastModified}-${Math.random().toString(36).slice(2, 7)}`,
        name: file.name,
        mimeType: file.type || 'text/plain',
        size: file.size,
        text: fileText.slice(0, 30000),
      }].slice(0, 8));
    } catch (cause: any) {
      setError(cause?.message || (isEs ? 'No se pudo leer ese archivo.' : 'Could not read that file.'));
    }
  };

  const createFromBrief = async () => {
    const combined = [
      `PLANTILLA ELEGIDA: ${selected.label}\nESTRUCTURA SUGERIDA: ${selected.structure}`,
      text.trim(),
      ...references.map((reference) => `\nDOCUMENTO DE REFERENCIA: ${reference.name}\n${reference.text}`),
    ].filter(Boolean).join('\n\n');
    if (text.trim().length < 20) {
      setError(isEs ? 'Agrega la consigna real antes de continuar. La plantilla solo define la estructura.' : 'Add the real assignment before continuing. A template only defines structure.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const parsed = await fetch('/api/parse-brief', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          text: combined,
          fileName: selected.label,
          references: references.map(({ name, mimeType, size }) => ({ name, mimeType, size })),
        }),
      });
      const parsedData = await parsed.json();
      if (!parsed.ok) throw new Error(parsedData.error || 'parse failed');
      const created = await fetch('/api/docs', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ title: parsedData.brief.title || selected.label, brief: parsedData.brief }),
      });
      const createdData = await created.json();
      if (!created.ok) throw new Error(createdData.error || 'create failed');
      router.push(`/studio/doc/${createdData.doc.id}`);
    } catch (cause: any) {
      setError(cause?.message || (isEs ? 'No se pudo crear el espacio de trabajo.' : 'Could not create the workspace.'));
      setBusy(false);
    }
  };

  return (
    <main className="brief-compact">
      <header className="brief-compact__header">
        <button type="button" onClick={() => router.push('/home')} className="brief-compact__back">← {isEs ? 'Biblioteca' : 'Library'}</button>
        <a href="/home" className="brief-compact__brand"><BrandMark size={24} /><span>Docs Studio</span></a>
        <LocaleSwitch />
      </header>
      <div className="brief-compact__body">
        <section className="brief-compact__form" aria-label={isEs ? 'Preparar documento' : 'Prepare document'}>
          <div className="brief-compact__title"><p>BRIEF / NUEVO DOCUMENTO</p><h1>{isEs ? 'Prepara el contexto.' : 'Prepare the context.'}</h1><span>{isEs ? 'La consigna queda guardada con el documento y guía al agente.' : 'The assignment is saved with the document and guides the agent.'}</span></div>
          <div className="brief-compact__field"><label>{isEs ? 'Plantilla' : 'Template'}</label><div className="brief-compact__templates">{templates.map((template) => <button type="button" key={template.id} onClick={() => applyTemplate(template)} className={selectedTemplate === template.id ? 'is-selected' : ''}><strong>{template.label}</strong><small>{template.structure}</small></button>)}</div></div>
          <div className="brief-compact__field brief-compact__field--grow"><div className="brief-compact__field-head"><label>{isEs ? 'Consigna o guía' : 'Assignment or guide'}</label><span>{text.length.toLocaleString()}</span></div><textarea value={text} onChange={(event) => setText(event.target.value)} placeholder={isEs ? 'Pega la guía, rúbrica, pregunta o requisitos completos…' : 'Paste the full guide, rubric, question, or requirements…'} /></div>
          <div className="brief-compact__references"><input ref={fileRef} type="file" multiple accept=".docx,.txt,.md,text/plain" className="sr-only" onChange={(event) => { const files = Array.from(event.target.files || []); void Promise.all(files.map(readReference)); event.currentTarget.value = ''; }} /><div><label>{isEs ? 'Referencias' : 'References'}</label><small>{isEs ? 'DOCX, TXT o MD · máximo 8' : 'DOCX, TXT, or MD · up to 8'}</small></div><button type="button" onClick={() => fileRef.current?.click()}>+ {isEs ? 'Agregar' : 'Add'}</button></div>
          {references.length > 0 && <div className="brief-compact__file-list">{references.map((reference) => <div key={reference.id}><span>{reference.name}</span><button type="button" onClick={() => setReferences((items) => items.filter((item) => item.id !== reference.id))}>×</button></div>)}</div>}
        </section>
        <aside className="brief-compact__summary"><p>LISTO PARA ABRIR</p><h2>{selected.label}</h2><span>{selected.structure}</span><dl><div><dt>{isEs ? 'Consigna' : 'Assignment'}</dt><dd>{text.trim() ? (isEs ? 'Lista para analizar' : 'Ready to parse') : (isEs ? 'Aún falta' : 'Missing')}</dd></div><div><dt>{isEs ? 'Referencias' : 'References'}</dt><dd>{references.length}</dd></div></dl><p className="brief-compact__note">{isEs ? 'Se crea un documento con este brief persistido. Nada se redacta ni se inventa todavía.' : 'A document is created with this persisted brief. Nothing is drafted or invented yet.'}</p><button type="button" disabled={busy} onClick={() => void createFromBrief()}>{busy ? (isEs ? 'Analizando…' : 'Parsing…') : (isEs ? 'Abrir documento ↗' : 'Open document ↗')}</button>{error && <p className="brief-error" role="alert">{error}</p>}</aside>
      </div>
    </main>
  );
}
