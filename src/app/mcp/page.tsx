import Link from 'next/link';
import BrandMark from '@/components/brand-mark';
import AnimatedBrand from '@/components/animated-brand';
import LocaleSwitch from '@/components/locale-switch';

const tools = [
  ['01', 'get_capabilities', 'Return the server contract, transports, and honest session boundary.'],
  ['02', 'create_document', 'Open a blank Letter or Legal workspace, optionally seeded with HTML.'],
  ['03', 'list_documents', 'List documents currently held by this MCP process.'],
  ['04', 'read_document', 'Return HTML, plain text, blocks, word count, brief context, and pending edits.'],
  ['05', 'parse_brief', 'Extract tasks, objectives, constraints, learning outcome, and rubric weights.'],
  ['06', 'draft_document', 'Run the same streaming draft endpoint used by the Docs Studio canvas.'],
  ['07', 'chat_document', 'Use the document copilot; AI changes return as reviewable proposals.'],
  ['08', 'propose_edit', 'Create a named proposal without mutating the current document.'],
  ['09', 'accept_edit', 'Apply a proposal only after the source document still matches.'],
  ['10', 'reject_edit', 'Close a proposal and leave the document untouched.'],
  ['11', 'insert_math', 'Add an editable MathJax equation to the document.'],
  ['12', 'insert_table', 'Add an editable HTML table with a header row.'],
  ['13', 'get_history', 'Return recent document events for review and audit.'],
  ['14', 'export_document', 'Return HTML, DOCX, or a text-layout PDF as content/base64.'],
];

const resources = [
  ['docs://workspace', 'Current process workspace', 'List documents held by the MCP process.'],
  ['docs://document/{documentId}', 'Document state', 'HTML, text, blocks, brief, and pending review proposals.'],
  ['docs://history/{documentId}', 'Audit trail', 'Created, drafted, proposed, accepted, rejected, inserted, exported.'],
];

const boundaries = [
  ['Available now', 'The same document loop', 'Create → draft → read → propose → accept/reject → export.'],
  ['Available now', 'Local + remote transports', 'stdio for a spawned client; Streamable HTTP at /mcp for a running server.'],
  ['Needs a session bridge', 'Live browser sync', 'The MCP workspace is process-scoped; it does not silently change an open browser tab.'],
  ['Next integration', 'Identity and persistence', 'Add auth plus durable document IDs before making a hosted endpoint multi-user.'],
];

const stdioConfig = [
  '{',
  '  "mcpServers": {',
  '    "docs-studio": {',
  '      "command": "npx",',
  '      "args": ["tsx", "src/mcp/server.ts"],',
  '      "cwd": "/path/to/docs-studio",',
  '      "env": {',
  '        "DOCS_STUDIO_URL": "http://localhost:9003"',
  '      }',
  '    }',
  '  }',
  '}',
].join('\n');

const httpConfig = [
  'npm run dev',
  'npm run mcp:http',
  '',
  'MCP endpoint',
  'http://localhost:8787/mcp',
  '',
  '# optional',
  'MCP_PORT=8787',
  'DOCS_STUDIO_URL=http://localhost:9003',
].join('\n');

function CodeBlock({ children }: { children: string }) {
  return <pre className="mcp-code"><code>{children}</code></pre>;
}

export const metadata = {
  title: 'Docs Studio MCP | A document workspace for external AI',
  description: 'Use Docs Studio document creation, review, and export through MCP tools, resources, and prompts.',
};

export default function McpPage() {
  return (
    <div className="mcp-page">
      <header className="mcp-nav">
        <div className="mcp-brand-wrap">
          <AnimatedBrand className="mcp-brand" scrollRoot=".mcp-page" size={30} />
          <small>/ MCP</small>
        </div>
        <nav className="mcp-nav__links" aria-label="MCP documentation">
          <a href="#surface">Surface</a>
          <a href="#connect">Connect</a>
          <a href="#boundaries">Boundaries</a>
          <Link href="/">Producto ↗</Link>
          <LocaleSwitch />
        </nav>
      </header>

      <main>
        <section className="mcp-hero">
          <div className="mcp-hero__copy">
            <p className="mcp-kicker"><span className="mcp-status-dot" /> Model Context Protocol / v0.1</p>
            <h1>A document workspace an external AI can actually use.</h1>
            <p className="mcp-hero__lede">
              Docs Studio MCP exposes the real loop behind the app: parse a brief, draft onto a document, inspect blocks, propose reviewable edits, and export the result.
            </p>
            <div className="mcp-hero__actions">
              <a className="mcp-button mcp-button--dark" href="#connect">Connect the server <span>↓</span></a>
              <Link className="mcp-button mcp-button--quiet" href="/home">Abrir biblioteca <span>↗</span></Link>
            </div>
            <p className="mcp-hero__note">Built on the official TypeScript SDK · stdio + Streamable HTTP · Zod-validated inputs</p>
          </div>

          <div className="mcp-hero__diagram" aria-label="MCP document flow diagram">
            <div className="mcp-diagram__rail" />
            <div className="mcp-diagram__node mcp-diagram__node--client">
              <span className="mcp-diagram__index">01</span>
              <strong>External AI</strong>
              <small>asks with tools</small>
            </div>
            <div className="mcp-diagram__connector"><span>JSON-RPC</span></div>
            <div className="mcp-diagram__node mcp-diagram__node--server">
              <span className="mcp-diagram__index">02</span>
              <strong>Docs Studio MCP</strong>
              <small>guards the document loop</small>
            </div>
            <div className="mcp-diagram__connector"><span>state + files</span></div>
            <div className="mcp-diagram__node mcp-diagram__node--canvas">
              <span className="mcp-diagram__index">03</span>
              <strong>Reviewable canvas</strong>
              <small>nothing changes by surprise</small>
            </div>
            <div className="mcp-diagram__caption">Tools take action. Resources describe state. Prompts set the working rhythm.</div>
          </div>
        </section>

        <section className="mcp-proof-row" aria-label="MCP surface summary">
          <div><span>14</span><small>document tools</small></div>
          <div><span>03</span><small>read-only resources</small></div>
          <div><span>03</span><small>workflow prompts</small></div>
          <div><span>02</span><small>transport modes</small></div>
        </section>

        <section id="surface" className="mcp-section mcp-surface">
          <div className="mcp-section__intro">
            <p className="mcp-label">THE EXPOSED SURFACE</p>
            <h2>Small primitives. A complete document loop.</h2>
            <p>
              The contract is intentionally close to what the web app already does. Drafting applies the first version; later changes are proposals with an explicit accept or reject step.
            </p>
          </div>
          <div className="mcp-tool-grid">
            {tools.map(([number, name, description]) => (
              <article className="mcp-tool-card" key={name}>
                <span className="mcp-tool-card__number">{number}</span>
                <h3>{name}</h3>
                <p>{description}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="mcp-section mcp-resources">
          <div className="mcp-section__intro">
            <p className="mcp-label">READ-ONLY CONTEXT</p>
            <h2>Give the model a map before it edits.</h2>
          </div>
          <div className="mcp-resource-list">
            {resources.map(([uri, title, description]) => (
              <div className="mcp-resource-row" key={uri}>
                <code>{uri}</code>
                <div><strong>{title}</strong><p>{description}</p></div>
              </div>
            ))}
          </div>
        </section>

        <section className="mcp-section mcp-flow">
          <div className="mcp-section__intro">
            <p className="mcp-label">THE IMPORTANT PART</p>
            <h2>AI can move quickly without hiding the decision.</h2>
            <p>Every mutating path is visible in the API. The review boundary is part of the protocol, not a promise in the UI copy.</p>
          </div>
          <div className="mcp-review-flow" aria-label="Draft and review flow">
            <div className="mcp-review-step"><span>1</span><strong>draft_document</strong><small>first draft applies</small></div>
            <div className="mcp-review-line" />
            <div className="mcp-review-step mcp-review-step--accent"><span>2</span><strong>propose_edit</strong><small>change waits here</small></div>
            <div className="mcp-review-line" />
            <div className="mcp-review-step"><span>3</span><strong>accept_edit</strong><small>or reject_edit</small></div>
          </div>
        </section>

        <section id="connect" className="mcp-section mcp-connect">
          <div className="mcp-section__intro">
            <p className="mcp-label">CONNECT IN A MINUTE</p>
            <h2>Local first. Remote when the workspace is ready.</h2>
            <p>Run the web app for the AI draft and DOCX routes, then start the MCP server in another process. The server defaults to <code>http://localhost:9003</code>; set <code>DOCS_STUDIO_URL</code> when it lives elsewhere.</p>
          </div>
          <div className="mcp-connect-grid">
            <article className="mcp-code-card">
              <div className="mcp-code-card__head"><span>STDIO / CLAUDE DESKTOP, CURSOR, ETC.</span><b>local</b></div>
              <CodeBlock>{stdioConfig}</CodeBlock>
              <p>Or run <code>npm run mcp:stdio</code> from the repository.</p>
            </article>
            <article className="mcp-code-card mcp-code-card--paper">
              <div className="mcp-code-card__head"><span>STREAMABLE HTTP</span><b>remote-ready</b></div>
              <CodeBlock>{httpConfig}</CodeBlock>
              <p>HTTP sessions are held in memory by this process. Add auth and persistence before exposing it to multiple users.</p>
            </article>
          </div>
        </section>

        <section id="boundaries" className="mcp-section mcp-boundaries">
          <div className="mcp-section__intro">
            <p className="mcp-label">WHAT IS TRUE TODAY</p>
            <h2>The useful boundary is documented too.</h2>
            <p>This is a working integration, not a fictional “agent platform”. Here is where the implementation is complete and where the next product work belongs.</p>
          </div>
          <div className="mcp-boundary-table">
            {boundaries.map(([status, title, detail]) => (
              <div className="mcp-boundary-row" key={title}>
                <span className={status === 'Available now' ? 'is-live' : 'is-next'}>{status}</span>
                <strong>{title}</strong>
                <p>{detail}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mcp-final">
          <div>
            <p className="mcp-label">THE SOURCE IS OPEN</p>
            <h2>Start with a brief, a blank page, or the protocol.</h2>
            <p>Docs Studio is a real editor with an external surface now. Read the implementation, open the app, or connect your own AI client.</p>
          </div>
          <div className="mcp-final__actions">
            <a className="mcp-button mcp-button--dark" href="https://github.com/edies76/docs-studio" target="_blank" rel="noreferrer">Open GitHub <span>↗</span></a>
            <Link className="mcp-button mcp-button--quiet" href="/">Producto ↗</Link>
          </div>
        </section>
      </main>

      <footer className="mcp-footer">
        <Link href="/"><BrandMark size={24} /> Docs Studio</Link>
        <span>MCP · workspace académico / 2026</span>
        <Link href="/home">Open library ↗</Link>
      </footer>
    </div>
  );
}
