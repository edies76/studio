'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import BrandMark from '@/components/brand-mark';
import LocaleSwitch from '@/components/locale-switch';
import { importDocxToHtml } from '@/lib/import-docx';
import { buildStudentScaffold } from '@/lib/brief-scaffold';
import type { AssignmentBrief } from '@/lib/assignment-types';
import { useLocale } from '@/lib/i18n/locale-context';

type ReferenceDoc = { id: string; name: string; mimeType: string; size: number; text: string };
type Template = { id: string; label: string; description: string; structure: string };

const templates: Template[] = [
  { id: 'apa-essay', label: 'Ensayo APA', description: 'Argumento, evidencia y referencias con una estructura académica clara.', structure: 'Portada · Introducción · Desarrollo · Discusión · Referencias' },
  { id: 'lab-report', label: 'Informe de laboratorio', description: 'Convierte método, datos y observaciones en un informe reproducible.', structure: 'Pregunta · Método · Datos · Análisis · Conclusión' },
  { id: 'literature-review', label: 'Revisión de literatura', description: 'Organiza fuentes por ideas y deja visible qué evidencia sostiene cada punto.', structure: 'Alcance · Temas · Comparación · Vacíos · Síntesis' },
  { id: 'project-brief', label: 'Informe de proyecto', description: 'De una consigna dispersa a entregables, responsables y criterios de revisión.', structure: 'Contexto · Objetivos · Plan · Riesgos · Entregables' },
];

function textFromHtml(html: string) { const root = document.createElement('div'); root.innerHTML = html; return (root.textContent || '').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim(); }
function parseSse(buffer: string) { return buffer.split('\n\n').map((item) => item.trim()).filter(Boolean).map((item) => { try { return JSON.parse(item.replace(/^data:\s*/, '')); } catch { return null; } }).filter(Boolean); }

export default function BriefPage() {
  const router = useRouter();
  const { locale } = useLocale();
  const isEs = locale === 'es';
  const fileRef = useRef<HTMLInputElement>(null);
  const [selectedTemplate, setSelectedTemplate] = useState('apa-essay');
  const [text, setText] = useState('');
  const [references, setReferences] = useState<ReferenceDoc[]>([]);
  const [analysed, setAnalysed] = useState<AssignmentBrief | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const selected = templates.find((template) => template.id === selectedTemplate) || templates[0];

  const readReference = async (file: File) => {
    setError('');
    try {
      const fileText = /\.docx$/i.test(file.name) || file.type.includes('wordprocessingml')
        ? textFromHtml((await importDocxToHtml(await file.arrayBuffer(), file.name)).html)
        : (file.type === 'text/plain' || /\.(txt|md|markdown)$/i.test(file.name)) ? await file.text() : (() => { throw new Error(isEs ? 'Por ahora agrega archivos .docx, .txt o .md.' : 'For now, add .docx, .txt, or .md files.'); })();
      setReferences((items) => [...items, { id: `${file.name}-${file.lastModified}-${Math.random().toString(36).slice(2, 7)}`, name: file.name, mimeType: file.type || 'text/plain', size: file.size, text: fileText.slice(0, 30000) }].slice(0, 8));
    } catch (cause: any) { setError(cause?.message || (isEs ? 'No se pudo leer ese archivo.' : 'Could not read that file.')); }
  };

  const analyse = async () => {
    if (text.trim().length < 20) { setError(isEs ? 'Agrega la consigna real antes de continuar.' : 'Add the real assignment before continuing.'); return; }
    setBusy(true); setError('');
    try {
      const combined = [`PLANTILLA ELEGIDA: ${selected.label}\nESTRUCTURA SUGERIDA: ${selected.structure}`, text.trim(), ...references.map((item) => `DOCUMENTO DE REFERENCIA: ${item.name}\n${item.text}`)].join('\n\n');
      const response = await fetch('/api/parse-brief', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ text: combined, fileName: selected.label, references: references.map(({ name, mimeType, size }) => ({ name, mimeType, size })) }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'parse failed');
      setAnalysed(data.brief as AssignmentBrief);
    } catch (cause: any) { setError(cause?.message || (isEs ? 'No se pudo analizar la consigna.' : 'Could not analyse the assignment.')); } finally { setBusy(false); }
  };

  const createDocument = async (mode: 'scaffold' | 'draft') => {
    if (!analysed) return;
    setBusy(true); setError('');
    try {
      let html = buildStudentScaffold(analysed);
      let chatSummary = isEs ? 'Leí la consigna y preparé una estructura con entregables, criterios y puntos de evidencia.' : 'I read the assignment and prepared a structure with deliverables, criteria, and evidence points.';
      if (mode === 'draft') {
        const prompt = `Crea una PRIMERA VERSIÓN de trabajo en HTML para esta tarea universitaria. Usa solamente la consigna y las referencias proporcionadas; no inventes citas, resultados, datos ni requisitos. Conserva todas las secciones, entregables y orden de la consigna. Si falta evidencia, escribe [EVIDENCIA PENDIENTE: especifica qué hace falta]. Si el trabajo pide una imagen o figura que no se proporcionó, inserta un párrafo en el lugar correcto: [IMAGEN PENDIENTE: describe exactamente la imagen necesaria]. No menciones que eres IA ni agregues comentarios fuera del documento.\n\nCONSIGNA ANALIZADA:\n${JSON.stringify(analysed)}\n\nREFERENCIAS:\n${references.map((item) => `${item.name}:\n${item.text}`).join('\n\n')}`;
        const response = await fetch('/api/draft', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ prompt, language: analysed.language || (isEs ? 'es' : 'en') }) });
        if (!response.ok || !response.body) throw new Error('draft failed');
        const reader = response.body.getReader(); const decoder = new TextDecoder(); let pending = ''; let draft = '';
        for (;;) { const result = await reader.read(); if (result.done) break; pending += decoder.decode(result.value, { stream: true }); const splitAt = pending.lastIndexOf('\n\n'); if (splitAt < 0) continue; const events = parseSse(pending.slice(0, splitAt)); pending = pending.slice(splitAt + 2); for (const event of events) { if (event.type === 'html_delta') draft += event.delta || ''; if (event.type === 'error') throw new Error(event.message || 'draft failed'); } }
        if (!draft.trim()) throw new Error('draft failed');
        html = draft.trim().replace(/^```(?:html)?\s*/i, '').replace(/\s*```$/i, '');
        chatSummary = isEs ? 'Preparé una primera versión basada en la consigna. Dejé dentro del documento los marcadores [EVIDENCIA PENDIENTE] y [IMAGEN PENDIENTE] donde faltan fuentes, datos o archivos. Revísalos antes de entregar.' : 'I prepared a first version from the assignment. I left [EVIDENCE PENDING] and [IMAGE PENDING] markers in the document where sources, data, or files are missing. Review them before submitting.';
      }
      const created = await fetch('/api/docs', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ title: analysed.title || selected.label, brief: analysed, html }) });
      const data = await created.json(); if (!created.ok) throw new Error(data.error || 'create failed');
      await fetch(`/api/docs/${data.doc.id}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ chatTurn: { id: `brief-${Date.now()}`, role: 'assistant', content: chatSummary, createdAt: Date.now() } }) });
      router.push(`/studio/doc/${data.doc.id}`);
    } catch (cause: any) { setError(cause?.message || (isEs ? 'No se pudo crear el documento.' : 'Could not create the document.')); setBusy(false); }
  };

  return <main className="brief-compact">
    <header className="brief-compact__header"><button type="button" onClick={() => router.push('/home')} className="brief-compact__back">← {isEs ? 'Biblioteca' : 'Library'}</button><a href="/home" className="brief-compact__brand"><BrandMark size={24} /><span>Docs Studio</span></a><LocaleSwitch /></header>
    <div className="brief-compact__body"><section className="brief-compact__form" aria-label={isEs ? 'Preparar documento' : 'Prepare document'}>
      <div className="brief-compact__title"><p>BRIEF / NUEVO DOCUMENTO</p><h1>{isEs ? 'Entiende la tarea antes de escribir.' : 'Understand the assignment before writing.'}</h1><span>{isEs ? 'Sube la guía: extraemos entregables, rúbrica, restricciones y una ruta para empezar.' : 'Upload the guide: we extract deliverables, rubric, constraints, and a path to start.'}</span></div>
      <div className="brief-compact__field"><label>{isEs ? 'Tipo de entrega' : 'Delivery type'}</label><div className="brief-compact__templates">{templates.map((item) => <button type="button" key={item.id} onClick={() => { setSelectedTemplate(item.id); setAnalysed(null); }} className={selectedTemplate === item.id ? 'is-selected' : ''}><strong>{item.label}</strong><small>{item.structure}</small></button>)}</div></div>
      <div className="brief-compact__field brief-compact__field--grow"><div className="brief-compact__field-head"><label>{isEs ? 'Consigna o guía' : 'Assignment or guide'}</label><span>{text.length.toLocaleString()}</span></div><textarea value={text} onChange={(event) => { setText(event.target.value); setAnalysed(null); }} placeholder={isEs ? 'Pega la guía, rúbrica, pregunta o requisitos completos…' : 'Paste the full guide, rubric, question, or requirements…'} /></div>
      <div className="brief-compact__references"><input ref={fileRef} type="file" multiple accept=".docx,.txt,.md,text/plain" className="sr-only" onChange={(event) => { const files = Array.from(event.target.files || []); void Promise.all(files.map(readReference)); event.currentTarget.value = ''; }} /><div><label>{isEs ? 'Guías y fuentes' : 'Guides and sources'}</label><small>{isEs ? 'DOCX, TXT o MD · máximo 8' : 'DOCX, TXT, or MD · up to 8'}</small></div><button type="button" onClick={() => fileRef.current?.click()}>+ {isEs ? 'Subir' : 'Upload'}</button></div>
      {references.length > 0 && <div className="brief-compact__file-list">{references.map((item) => <div key={item.id}><span>{item.name}</span><button type="button" onClick={() => { setReferences((items) => items.filter((ref) => ref.id !== item.id)); setAnalysed(null); }}>×</button></div>)}</div>}
    </section><aside className="brief-compact__summary"><p>{analysed ? (isEs ? 'CONSIGNA ENTENDIDA' : 'ASSIGNMENT UNDERSTOOD') : (isEs ? 'LISTO PARA ANALIZAR' : 'READY TO ANALYSE')}</p><h2>{analysed?.title || selected.label}</h2><span>{analysed ? `${analysed.tasks.length} ${isEs ? 'entregables detectados' : 'deliverables detected'}` : selected.description}</span><dl><div><dt>{isEs ? 'Consigna' : 'Assignment'}</dt><dd>{text.trim() ? (isEs ? 'Lista' : 'Ready') : (isEs ? 'Aún falta' : 'Missing')}</dd></div><div><dt>{isEs ? 'Archivos' : 'Files'}</dt><dd>{references.length}</dd></div></dl><p className="brief-compact__note">{analysed ? (isEs ? 'Confirma cómo quieres empezar. La estructura conserva tu control; el primer borrador deja visibles las evidencias e imágenes pendientes.' : 'Choose how to start. The structure keeps you in control; the first draft makes missing evidence and images visible.') : (isEs ? 'No adivina la tarea: primero revisas lo que entendió antes de abrir el documento.' : 'It does not guess the task: first you review what it understood before opening the document.')}</p><button type="button" disabled={busy} onClick={() => { if (analysed) void createDocument('scaffold'); else void analyse(); }}>{busy ? (isEs ? 'Procesando…' : 'Processing…') : analysed ? (isEs ? 'Abrir estructura ↗' : 'Open structure ↗') : (isEs ? 'Entender consigna ↗' : 'Understand assignment ↗')}</button>{error && <p className="brief-error" role="alert">{error}</p>}</aside></div>
    {analysed && <div className="brief-confirm" role="dialog" aria-modal="true" aria-label={isEs ? 'Revisión de consigna' : 'Assignment review'}><div><button type="button" className="brief-confirm__close" onClick={() => setAnalysed(null)}>×</button><p>{isEs ? 'ANTES DE CREAR' : 'BEFORE CREATING'}</p><h2>{analysed.title}</h2><span>{analysed.instructions || (isEs ? 'Revisa los entregables detectados.' : 'Review the detected deliverables.')}</span><ul>{analysed.tasks.slice(0, 5).map((task) => <li key={task.id}><strong>{task.title}</strong>{task.description && <small>{task.description}</small>}</li>)}</ul><div className="brief-confirm__actions"><button type="button" onClick={() => void createDocument('scaffold')} disabled={busy}>{isEs ? 'Solo estructura' : 'Structure only'}</button><button type="button" onClick={() => void createDocument('draft')} disabled={busy}>{isEs ? 'Crear primera versión' : 'Create first version'}</button></div><small>{isEs ? 'La primera versión no inventa datos ni fuentes: marca lo que necesites completar.' : 'The first version does not invent data or sources: it marks what you need to complete.'}</small></div></div>}
  </main>;
}
