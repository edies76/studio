import Link from 'next/link';
import AnimatedBrand from '@/components/animated-brand';
import BrandMark from '@/components/brand-mark';
import LocaleSwitch from '@/components/locale-switch';

const productFacts = [
  ['01', 'Context first', 'Reads a professor’s brief, tasks, constraints and rubric before the draft takes shape.'],
  ['02', 'Paper is the source', 'A paginated Letter or Legal canvas keeps the document visible while the copilot works beside it.'],
  ['03', 'Reviewable AI', 'Targeted changes arrive as proposals. Accept or reject them before they become part of the file.'],
  ['04', 'Ready to leave', 'MathJax equations, editable tables, images and PDF or DOCX export stay in the same document loop.'],
];

const editorParts = [
  ['Brief parser', 'Tasks, objectives, constraints and rubric context become part of the working document.'],
  ['Document canvas', 'Real page proportions, margins, zoom, toolbar, selection editing and image controls.'],
  ['Studio copilot', 'Draft, inspect blocks, rewrite a selection or propose a focused change without silent mutation.'],
  ['MCP surface', 'The same document loop is available to external agents through tools, resources and prompts.'],
];

export const metadata = {
  title: 'Docs Studio | Documents with context',
  description: 'Docs Studio turns a brief into a document you can inspect, shape and export.',
};

export default function PreSummaryPage() {
  return (
    <div className="pre-summary-page">
      <header className="pre-summary-nav">
        <div className="pre-summary-brand-wrap">
          <AnimatedBrand className="pre-summary-brand" scrollRoot=".pre-summary-page" size={30} />
          <small>document workspace</small>
        </div>
        <nav aria-label="Docs Studio sections">
          <a href="#inside">Inside</a>
          <a href="#control">Control</a>
          <a href="#agents">For agents</a>
          <LocaleSwitch />
          <Link href="/home" className="pre-summary-nav__cta">Open the workspace <span>↗</span></Link>
        </nav>
      </header>

      <main>
        <section className="pre-summary-hero">
          <div className="pre-summary-hero__copy">
            <p className="pre-summary-kicker"><i /> Docs Studio / document workspace</p>
            <h1>Make the document the place where the work happens.</h1>
            <p className="pre-summary-lede">
              Docs Studio takes the brief seriously. It keeps the source material, a paginated document and an AI copilot in one working surface, so the result is something you can inspect and take with you — not just a chat transcript.
            </p>
            <div className="pre-summary-actions">
              <Link href="/home" className="pre-summary-button pre-summary-button--dark">Open Docs Studio <span>↗</span></Link>
              <Link href="/mcp" className="pre-summary-button">Connect an agent <span>↗</span></Link>
            </div>
            <p className="pre-summary-note">Brief parsing · paginated canvas · reviewable edits · PDF / DOCX</p>
          </div>

          <div className="pre-summary-visual" aria-label="Docs Studio document workflow preview">
            <div className="pre-summary-visual__chrome"><span /><span /><span /><b>docs-studio / working canvas</b><em>review mode</em></div>
            <div className="pre-summary-visual__grid">
              <div className="pre-summary-brief-card">
                <small>INPUT / 01</small>
                <strong>Professor&apos;s brief</strong>
                <p>Method, evidence, conclusion. Keep the assignment in view.</p>
                <code>brief.docx</code>
              </div>
              <div className="pre-summary-visual__handoff"><span /> <b>shape</b> <span /></div>
              <article className="pre-summary-paper-card">
                <div className="pre-summary-paper-card__top"><span>WORKING DOCUMENT</span><span>01 / 03</span></div>
                <small>Draft / ready to shape</small>
                <h2>Gaussian elimination, clearly explained.</h2>
                <p>Setup, row operations and the conclusion stay together on the page.</p>
                <div className="pre-summary-proposal"><i /><div><small>PROPOSED CHANGE</small><strong>Show the operation before the answer.</strong></div><b>✓</b></div>
              </article>
            </div>
            <div className="pre-summary-visual__footer"><span><i /> brief</span><span><i /> structure</span><span><i /> your voice</span></div>
          </div>
        </section>

        <section id="inside" className="pre-summary-section">
          <div className="pre-summary-section__head">
            <p className="pre-summary-label">WHAT IT IS</p>
            <h2>A document editor with the brief still in the room.</h2>
            <p>Every part of the product points at the same outcome: a document with structure, context and a clear review boundary.</p>
          </div>
          <div className="pre-summary-facts">
            {productFacts.map(([number, title, body]) => (
              <article key={number}>
                <span>{number}</span>
                <h3>{title}</h3>
                <p>{body}</p>
              </article>
            ))}
          </div>
        </section>

        <section id="control" className="pre-summary-section pre-summary-section--split">
          <div>
            <p className="pre-summary-label">THE WORKING SURFACE</p>
            <h2>The agent can move fast. The file still answers to you.</h2>
            <p>Drafting is direct. Editing is visible. The copilot can read the current blocks, work on a selection or prepare a larger rewrite, but the consequential step stays explicit.</p>
            <div className="pre-summary-review-line"><span>read</span><i /><span>propose</span><i /><span>accept / reject</span></div>
          </div>
          <div className="pre-summary-parts">
            {editorParts.slice(0, 3).map(([title, body], index) => (
              <div key={title}><span>0{index + 1}</span><div><strong>{title}</strong><p>{body}</p></div></div>
            ))}
          </div>
        </section>

        <section id="agents" className="pre-summary-agent-section">
          <div className="pre-summary-agent-section__mark"><span>DS</span><i /><i /><i /></div>
          <div>
            <p className="pre-summary-label">FOR EXTERNAL AGENTS</p>
            <h2>Docs Studio has a protocol surface, not a marketing promise.</h2>
            <p>The MCP layer exposes the document loop to another AI: inspect the file, find a block, run checks, draft, propose edits, place equations, tables or images, and export the result. The cloud endpoint is isolated by authenticated workspace.</p>
            <Link href="/mcp" className="pre-summary-inline-link">Read the MCP surface <span>↗</span></Link>
          </div>
        </section>

        <section className="pre-summary-final">
          <p className="pre-summary-label">A DIFFERENT KIND OF AI EDITOR</p>
          <h2>The chat can suggest. The document makes it real.</h2>
          <p>Bring the work into focus, keep the decision visible and leave with a file that still looks like the one you meant to make.</p>
          <Link href="/home" className="pre-summary-button pre-summary-button--dark">Open the workspace <span>↗</span></Link>
        </section>
      </main>

      <footer className="pre-summary-footer">
        <Link href="/pre-summary"><BrandMark size={24} /> Docs Studio</Link>
        <span>Context in. Document out.</span>
        <Link href="/mcp">MCP / agent surface ↗</Link>
      </footer>
    </div>
  );
}
