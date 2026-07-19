import Link from 'next/link';
import BrandMark from '@/components/brand-mark';
import AnimatedBrand from '@/components/animated-brand';
import LocaleSwitch from '@/components/locale-switch';
import McpAccessPanel from '@/components/mcp-access-panel';

const tools = [
  ['01', 'get_capabilities', 'Return the server contract, transports, and honest session boundary.'],
  ['02', 'create_document', 'Open a blank Letter or Legal workspace, optionally seeded with HTML.'],
  ['03', 'list_documents', 'List persistent documents belonging to the authenticated workspace.'],
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
  ['14', 'export_document', 'Return HTML, DOCX, or PDF as content/base64.'],
];

const resources = [
  ['docs://workspace', 'Authenticated workspace', 'List persistent documents for the signed-in owner.'],
  ['docs://document/{documentId}', 'Document state', 'HTML, text, blocks, brief, and pending review proposals.'],
  ['docs://history/{documentId}', 'Audit trail', 'Created, drafted, proposed, accepted, rejected, inserted, exported.'],
];

const boundaries = [
  ['Available now', 'The same document loop', 'Create → draft → read → propose → accept/reject → export.'],
  ['Available now', 'Remote authenticated workspace', 'Streamable HTTP at https://docss.studio/api/mcp with a personal Bearer credential.'],
  ['Available now', 'Review boundary', 'Consequential edits can remain proposals until an agent or user explicitly accepts them.'],
  ['Still explicit', 'Live browser sync', 'An agent works on persistent documents, not silently on the cursor or selection in an open browser tab.'],
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
  '{',
  '  "mcpServers": {',
  '    "docs-studio": {',
  '      "url": "https://docss.studio/api/mcp",',
  '      "headers": {',
  '        "Authorization": "Bearer dsm_YOUR_PERSONAL_TOKEN"',
  '      }',
  '    }',
  '  }',
  '}',
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
              <a className="mcp-button mcp-button--dark" href="#connect">Connect your agent <span>↓</span></a>
              <Link className="mcp-button mcp-button--quiet" href="/home">Abrir biblioteca <span>↗</span></Link>
            </div>
            <p className="mcp-hero__note">Official TypeScript SDK · persistent DynamoDB workspace · Streamable HTTP</p>
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
          <div><span>25</span><small>document tools</small></div>
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
            <h2>Connect an agent to your own documents.</h2>
            <p>Sign into Docs Studio with Google and create a personal MCP credential. Any client that supports Streamable HTTP can use it; the credential sees only that user&apos;s persistent workspace.</p>
          </div>
          <div className="mcp-connect-grid">
            <article className="mcp-code-card">
              <div className="mcp-code-card__head"><span>STDIO / LOCAL DEVELOPMENT</span><b>local</b></div>
              <CodeBlock>{stdioConfig}</CodeBlock>
              <p>Or run <code>npm run mcp:stdio</code> from the repository.</p>
            </article>
            <article className="mcp-code-card mcp-code-card--paper">
              <div className="mcp-code-card__head"><span>STREAMABLE HTTP / ANY MCP CLIENT</span><b>remote</b></div>
              <CodeBlock>{httpConfig}</CodeBlock>
              <p>The token is created once from the signed-in workspace, stored hashed, and can be revoked. It starts with all currently available MCP permissions.</p>
            </article>
          </div>
          <McpAccessPanel />
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
