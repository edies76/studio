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
    setText(template.starter);
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
    if (combined.trim().length < 40) {
      setError(isEs ? 'Escribe una consigna o elige una plantilla antes de continuar.' : 'Write an assignment or choose a template before continuing.');
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
    <main className="brief-room">
      <header className="brief-header">
        <div className="brief-header__inner">
          <button type="button" className="brief-back" onClick={() => router.push('/home')}>← <span>{isEs ? 'Biblioteca' : 'Library'}</span></button>
          <a href="/" className="brief-brand"><BrandMark size={30} /><span>Docs Studio</span></a>
          <div className="brief-header__right"><LocaleSwitch /><a href="/mcp">MCP ↗</a></div>
        </div>
      </header>

      <section className="brief-intro">
        <div>
          <p className="brief-kicker"><span /> {isEs ? 'Brief room / 01' : 'Brief room / 01'}</p>
          <h1>{isEs ? 'Primero entiende el encargo. Después escribe.' : 'Understand the assignment first. Then write.'}</h1>
          <p className="brief-intro__lede">{isEs ? 'Combina una plantilla, la consigna del profesor y tus documentos de referencia. Docs Studio convierte ese material en contexto persistente para el documento y el agente.' : 'Combine a template, the professor’s assignment, and your reference documents. Docs Studio turns that material into persistent context for the document and agent.'}</p>
        </div>
        <div className="brief-flow" aria-label="Brief to document flow"><span><b>01</b>{isEs ? 'Reunir' : 'Gather'}</span><i /><span><b>02</b>{isEs ? 'Estructurar' : 'Structure'}</span><i /><span><b>03</b>{isEs ? 'Escribir' : 'Write'}</span></div>
      </section>

      <section className="brief-workspace">
        <div className="brief-workspace__main">
          <div className="brief-section-head"><p className="brief-label">01 / {isEs ? 'Plantilla' : 'Template'}</p><h2>{isEs ? 'Elige un punto de partida.' : 'Choose a starting point.'}</h2><p>{isEs ? 'La plantilla no redacta por ti. Define qué debe aparecer y te ayuda a no perder la forma de la entrega.' : 'The template does not write for you. It defines what should appear and helps preserve the shape of the deliverable.'}</p></div>
          <div className="brief-template-grid">{templates.map((template) => <button type="button" key={template.id} onClick={() => applyTemplate(template)} className={`brief-template ${selectedTemplate === template.id ? 'is-selected' : ''}`}><span className="brief-template__number">{String(templates.indexOf(template) + 1).padStart(2, '0')}</span><strong>{template.label}</strong><p>{template.description}</p><small>{template.structure}</small></button>)}</div>

          <div className="brief-section-head brief-section-head--assignment"><p className="brief-label">02 / {isEs ? 'Consigna' : 'Assignment'}</p><h2>{isEs ? 'Pon la fuente original junto al trabajo.' : 'Keep the source next to the work.'}</h2><p>{isEs ? 'Pega las instrucciones completas. El parser extrae tareas, objetivos, restricciones y rúbrica; si algo no está, no lo inventa.' : 'Paste the full instructions. The parser extracts tasks, objectives, constraints, and rubric; if something is missing, it does not invent it.'}</p></div>
          <div className="brief-editor-card"><div className="brief-editor-card__top"><span>{selected.label}</span><span>{text.length.toLocaleString()} {isEs ? 'caracteres' : 'characters'}</span></div><textarea value={text} onChange={(event) => setText(event.target.value)} placeholder={isEs ? 'Pega aquí la guía, instrucciones, rúbrica o pregunta central…' : 'Paste the assignment, instructions, rubric, or central question here…'} /><div className="brief-editor-card__foot"><span>{isEs ? 'Editable antes de analizar' : 'Editable before parsing'}</span><button type="button" onClick={() => setText(selected.starter)}>{isEs ? 'Cargar texto de plantilla' : 'Load template text'}</button></div></div>

          <div className="brief-section-head brief-section-head--references"><p className="brief-label">03 / {isEs ? 'Documentos de referencia' : 'Reference documents'}</p><h2>{isEs ? 'Agrega el material que el agente debe conocer.' : 'Add the material the agent should know.'}</h2><p>{isEs ? 'Las referencias se incorporan al brief y quedan registradas junto al documento. Así una fuente no se pierde entre pestañas.' : 'References become part of the brief and are recorded with the document. A source should not get lost between tabs.'}</p></div>
          <div className="brief-references-card">
            <input ref={fileRef} type="file" multiple accept=".docx,.txt,.md,text/plain" className="sr-only" onChange={(event) => { const files = Array.from(event.target.files || []); void Promise.all(files.map(readReference)); event.currentTarget.value = ''; }} />
            <button type="button" className="brief-upload-zone" onClick={() => fileRef.current?.click()}><span className="brief-upload-mark" aria-hidden="true">+</span><span><strong>{isEs ? 'Agregar documentos' : 'Add documents'}</strong><small>{isEs ? 'DOCX, TXT o MD · hasta 8 referencias' : 'DOCX, TXT, or MD · up to 8 references'}</small></span><b>↗</b></button>
            {references.length > 0 && <div className="brief-reference-list">{references.map((reference) => <div className="brief-reference" key={reference.id}><span className="brief-reference__type">{reference.name.split('.').pop()?.toUpperCase() || 'DOC'}</span><span><strong>{reference.name}</strong><small>{readableSize(reference.size)} · {reference.text.length.toLocaleString()} {isEs ? 'caracteres leídos' : 'characters read'}</small></span><button type="button" onClick={() => setReferences((items) => items.filter((item) => item.id !== reference.id))}>{isEs ? 'Quitar' : 'Remove'}</button></div>)}</div>}
          </div>
        </div>

        <aside className="brief-summary">
          <div className="brief-summary__sticky">
            <p className="brief-label">04 / {isEs ? 'Antes de abrir' : 'Before opening'}</p>
            <h2>{isEs ? 'Un contexto que el documento puede recordar.' : 'Context the document can remember.'}</h2>
            <div className="brief-summary__source"><span>{isEs ? 'Plantilla' : 'Template'}</span><strong>{selected.label}</strong><small>{selected.structure}</small></div>
            <div className="brief-summary__source"><span>{isEs ? 'Material' : 'Material'}</span><strong>{references.length.toString().padStart(2, '0')} {isEs ? 'referencias' : 'references'}</strong><small>{text.trim() ? (isEs ? 'Consigna lista para analizar' : 'Assignment ready to parse') : (isEs ? 'Falta la consigna' : 'Assignment is missing')}</small></div>
            <div className="brief-summary__rule" />
            <p className="brief-summary__note">{isEs ? 'Al continuar, se crea un documento vacío con el brief persistido. El agente podrá leerlo antes de proponer cambios.' : 'Continue to create a blank document with the brief persisted. The agent can read it before proposing changes.'}</p>
            <button type="button" className="brief-create-button" disabled={busy} onClick={() => void createFromBrief()}>{busy ? (isEs ? 'Analizando brief…' : 'Parsing brief…') : (isEs ? 'Crear documento con este contexto ↗' : 'Create document with this context ↗')}</button>
            {error && <p className="brief-error" role="alert">{error}</p>}
          </div>
        </aside>
      </section>

      <footer className="brief-footer"><span>Docs Studio / {isEs ? 'brief room' : 'brief room'}</span><span>{isEs ? 'El contexto también es un objeto del documento.' : 'Context is also a document object.'}</span><a href="/home">{isEs ? 'Volver a documentos ↗' : 'Back to documents ↗'}</a></footer>
    </main>
  );
}
