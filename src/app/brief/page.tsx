'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import BrandMark from '@/components/brand-mark';
import LocaleSwitch from '@/components/locale-switch';
import { importDocxToHtml } from '@/lib/import-docx';
import { buildStudentScaffold } from '@/lib/brief-scaffold';
import type { AssignmentBrief } from '@/lib/assignment-types';
import { useLocale } from '@/lib/i18n/locale-context';
import styles from '../home/brief/brief.module.css';

type Template = { id: string; label: string; description: string; structure: string };

const templates: Template[] = [
  { id: 'apa-essay', label: 'APA Essay', description: 'A clear argument with evidence and references.', structure: 'Title · Introduction · Argument · Discussion · References' },
  { id: 'lab-report', label: 'Lab Report', description: 'Method, data, and findings in a clear sequence.', structure: 'Question · Method · Data · Analysis · Conclusion' },
  { id: 'literature-review', label: 'Literature Review', description: 'Sources arranged by ideas, findings, and gaps.', structure: 'Scope · Themes · Comparison · Gaps · Synthesis' },
  { id: 'project-brief', label: 'Project Report', description: 'Objectives, plan, and deliverables from the start.', structure: 'Context · Objectives · Plan · Risks · Deliverables' },
  { id: 'problem-set', label: 'Problem Set', description: 'A repeatable solution path for technical exercises.', structure: 'Problem · Method · Working · Result · Check' },
  { id: 'case-study', label: 'Case Study', description: 'Frame a situation, assess it, and make a recommendation.', structure: 'Context · Evidence · Analysis · Options · Recommendation' },
  { id: 'research-proposal', label: 'Research Proposal', description: 'Turn a question into a scoped study plan.', structure: 'Question · Background · Method · Timeline · References' },
  { id: 'data-analysis', label: 'Data Analysis', description: 'Connect data, visuals, and conclusions without losing the method.', structure: 'Question · Data · Method · Findings · Limits' },
  { id: 'technical-report', label: 'Technical Report', description: 'Explain a procedure, its result, and the evidence behind it.', structure: 'Purpose · System · Procedure · Results · Next steps' },
  { id: 'thesis-chapter', label: 'Thesis Chapter', description: 'Build a disciplined chapter around a research argument.', structure: 'Claim · Literature · Method · Analysis · Synthesis' },
];

export default function BriefPage() {
  const router = useRouter();
  const { locale } = useLocale();
  const isEs = locale === 'es';
  const guideInputRef = useRef<HTMLInputElement>(null);
  const [selectedTemplate, setSelectedTemplate] = useState('apa-essay');
  const [prompt, setPrompt] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const selected = templates.find((template) => template.id === selectedTemplate) || templates[0];

  const attachGuide = async (file: File) => {
    try {
      // Some university platforms rename an OOXML Word file to `.doc`. The
      // importer validates its real container, so let it decide instead of
      // rejecting a valid document by extension alone.
      const raw = /\.docx?$/i.test(file.name) || file.type.includes('word')
        ? (await importDocxToHtml(await file.arrayBuffer(), file.name)).html.replace(/<[^>]*>/g, ' ')
        : /\.(txt|md|markdown)$/i.test(file.name) || file.type === 'text/plain' ? await file.text() : '';
      if (!raw.trim()) throw new Error('Attach a Word, TXT, or Markdown guide.');
      // The guide lives in the document brief, never as a fake visible chat turn.
      setPrompt((current) => [current.trim(), `Attached guide: ${file.name}\n${raw.replace(/\s+/g, ' ').trim()}`].filter(Boolean).join('\n\n'));
      setError('');
    } catch (cause: any) { setError(cause?.message || 'Could not read the guide.'); }
  };

  const createDocument = async () => {
    if (!prompt.trim()) {
      setError(isEs ? 'Escribe qué necesitas preparar.' : 'Write what you need to prepare.');
      return;
    }

    let brief: AssignmentBrief = {
      title: selected.label,
      objectives: [`Prepare a ${selected.label.toLowerCase()} that responds to the user brief.`],
      instructions: `${selected.description}\n\nSuggested structure: ${selected.structure}`,
      tasks: [{ id: selected.id, title: selected.label, description: prompt.trim(), required: true }],
      constraints: ['Keep the document concise until the user asks for more detail.'],
      rubric: [],
      rawText: prompt.trim(),
      language: isEs ? 'es' : 'en',
    };

    setBusy(true);
    setError('');
    try {
      const parsed = await fetch('/api/parse-brief', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ text: prompt.trim(), fileName: selected.label }),
      });
      const parsedData = await parsed.json();
      if (parsed.ok && parsedData.brief) {
        brief = { ...parsedData.brief, language: parsedData.brief.language === 'en' ? 'en' : 'es' };
      }
      const created = await fetch('/api/docs', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        // The first brief must be deterministic. A blank document lets the
        // first agent response become an uncontrolled full rewrite, which is
        // the source of the broken cover/decorative first-open experience.
        body: JSON.stringify({ title: brief.title || selected.label, brief, html: buildStudentScaffold(brief) }),
      });
      const data = await created.json();
      if (!created.ok) throw new Error(data.error || 'create failed');

      router.push(`/studio/doc/${data.doc.id}`);
    } catch (cause: any) {
      setError(cause?.message || (isEs ? 'No se pudo crear el documento.' : 'Could not create the document.'));
      setBusy(false);
    }
  };

  return <main className={`${styles.scope} brief-compact`}>
    <header className="brief-compact__header">
      <button type="button" onClick={() => router.push('/home')} className="brief-compact__back">← {isEs ? 'Biblioteca' : 'Library'}</button>
      <a href="/home" className="brief-compact__brand"><BrandMark size={24} /><span>Docs Studio</span></a>
      <LocaleSwitch />
    </header>
    <section className="brief-start" aria-label="Create a document from a brief">
      <div className="brief-start__form">
        <div className="brief-start__templates" aria-label="Document type">
          {templates.map((item) => <button type="button" key={item.id} onClick={() => setSelectedTemplate(item.id)} className={selectedTemplate === item.id ? 'is-selected' : ''}>
            <strong>{item.label}</strong><small>{item.description}</small>
          </button>)}
        </div>
        <label className="brief-start__prompt">
          <span>{isEs ? '¿Qué estás preparando?' : 'What are you preparing?'}</span>
          <textarea value={prompt} onChange={(event) => { setPrompt(event.target.value); setError(''); }} placeholder={isEs ? 'Pega la consigna, rúbrica o guía. Se conservará dentro del documento.' : 'Paste the assignment, rubric, or your working goal. It will stay with the document.'} />
        </label>
        <div className="brief-start__foot">
          <input ref={guideInputRef} type="file" accept=".doc,.docx,.txt,.md,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain" className="sr-only" onChange={(event) => { const file = event.target.files?.[0]; if (file) void attachGuide(file); event.currentTarget.value = ''; }} />
          <button type="button" className="brief-start__attach" onClick={() => guideInputRef.current?.click()}>{isEs ? 'Adjuntar guía' : 'Attach guide'}</button>
          <span>{selected.label} · {selected.structure}</span>
          <button type="button" disabled={busy || !prompt.trim()} onClick={() => void createDocument()}>{busy ? (isEs ? 'Preparando…' : 'Opening…') : (isEs ? 'Abrir estructura ↗' : 'Open workspace ↗')}</button>
        </div>
      </div>
      {error && <p className="brief-error" role="alert">{error}</p>}
    </section>
  </main>;
}
