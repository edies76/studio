import Link from 'next/link';
import AnimatedBrand from '@/components/animated-brand';
import LocaleSwitch from '@/components/locale-switch';

export const metadata = {
  title: 'Docs Studio use cases | Rule-following documents',
  description: 'Concrete use cases for reports, proposals, specifications, compliance documents, and repeatable document batches.',
};

const cases = [
  ['01', 'Universities and training programs', 'Turn a rubric into a document students can actually complete.', 'Workshop and lab reports · Capstone submissions · Rubric-led research papers · Technical assignments', 'Required sections · word limits · equations · tables · citation instructions'],
  ['02', 'Consultancies and agencies', 'Make every client deliverable follow the brief and the house style.', 'RFP responses · Client strategy documents · Research summaries · Monthly reports', 'Brand voice · scope · deliverables · exclusions · reusable sections'],
  ['03', 'Engineering, operations, and compliance', 'Turn requirements into documents that do not forget the important parts.', 'Technical specifications · Operating procedures · Change requests · Incident reports', 'Mandatory fields · evidence · risk sections · approval steps · controlled vocabulary'],
  ['04', 'Reusable document patterns', 'Reuse an approved structure as the starting point for the next document.', 'Reports by student · Site-specific plans · Client summaries · Project packs', 'Brief context · visible structure · reviewable edits · individual export'],
];

export default function UseCasesPage() {
  return <main className="focused-page">
    <header className="focused-page__nav"><AnimatedBrand className="focused-page__brand" scrollRoot=".focused-page" /><nav><Link href="/origin">Why Docs Studio</Link><Link href="/mcp">MCP</Link><LocaleSwitch /><Link href="/home" className="focused-page__cta">Open workspace ↗</Link></nav></header>
    <div className="focused-page__wrap">
      <section className="focused-page__hero"><p className="focused-page__label">USE CASES / DOCUMENTS WITH A JOB</p><h1>What is Docs Studio for?</h1><p>It is not a general-purpose editor with an AI button. It is a focused document workspace for when a brief, rubric, template, or set of rules has to become a finished document.</p></section>
      <section className="focused-page__difference"><div><p className="focused-page__label">THE QUESTION</p><h2>Why use this instead of a normal editor?</h2><p>The hard part is often not typing. It is keeping the requirements attached to the document while the draft changes, checking what is missing, and producing the same quality of deliverable repeatedly.</p></div><div className="focused-page__comparison"><div><b>Word / Google Docs</b><span>Open-ended writing, collaboration, and final polishing.</span></div><div><b>Docs Studio</b><span>Brief-led generation, structured rules, reviewable edits, and repeatable output.</span></div><div><b>Use both</b><span>Generate and check here, then continue editing wherever your team works.</span></div></div></section>
      <section className="focused-page__cases"><div className="focused-page__section-head"><p className="focused-page__label">FOUR PLACES IT EARNS ITS KEEP</p><h2>Documents where the rules matter.</h2></div>{cases.map(([number, audience, title, examples, rules]) => <article key={number} className="focused-page__case"><span className="focused-page__number">{number}</span><div><p className="focused-page__label">{audience}</p><h3>{title}</h3></div><div><p>{examples}</p><small><b>Rules:</b> {rules}</small></div></article>)}</section>
      <section id="agents" className="focused-page__agents"><div><p className="focused-page__label">FOR HUMANS + AGENTS</p><h2>One document surface. Two ways to work.</h2></div><div><p>People can load context, shape the document, inspect suggestions, and export. Through MCP, external agents can create, read, draft, revise, and export the same structured document surface.</p><div className="focused-page__tools"><code>create_document</code><code>parse_brief</code><code>draft_document</code><code>check_document</code><code>propose_edit</code><code>export_document</code></div></div></section>
      <footer className="focused-page__footer"><span>Your AI can write. Docs Studio makes it follow the brief.</span><Link href="/home">Try a document ↗</Link></footer>
    </div>
  </main>;
}
