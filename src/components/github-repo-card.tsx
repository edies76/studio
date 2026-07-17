'use client';

import { ArrowUpRight, FileText, GitBranch, Github, Terminal } from 'lucide-react';

type GithubRepoCardProps = {
  onOpenBlankDocument: () => void;
};

const repoUrl = 'https://github.com/edies76/docs-studio';

const featureRows = [
  ['Canvas', 'Letter + Legal pagination'],
  ['Drafts', 'Streaming directly onto the paper'],
  ['Review', 'Diff, Accept, Reject'],
  ['Export', 'PDF + server-generated .docx'],
];

export default function GithubRepoCard({ onOpenBlankDocument }: GithubRepoCardProps) {
  return (
    <article className="repo-card">
      <div className="repo-card__visual" aria-hidden="true">
        <div className="repo-card__windowbar">
          <span className="repo-card__window-title">
            <span className="repo-card__window-dot" />
            docs-studio
          </span>
          <span className="repo-card__branch">
            <GitBranch size={12} strokeWidth={1.8} /> main
          </span>
        </div>

        <div className="repo-card__code">
          <span className="repo-card__line-number">01</span>
          <code><em>const</em> workspace = <strong>&apos;Docs Studio&apos;</strong>;</code>
          <span className="repo-card__line-number">02</span>
          <code><em>const</em> draft = <strong>stream</strong>(brief, canvas);</code>
          <span className="repo-card__line-number">03</span>
          <code><em>return</em> review(draft).<strong>accept</strong>();</code>
        </div>

        <div className="repo-card__stack">
          <span>Next.js</span>
          <span>Genkit</span>
          <span>MathJax</span>
          <span>DOCX</span>
        </div>
      </div>

      <div className="repo-card__body">
        <div className="repo-card__eyebrow">
          <Terminal size={13} strokeWidth={1.7} />
          Open build · source included
        </div>
        <h3>See the workspace behind the landing page.</h3>
        <p>
          Docs Studio is a real Next.js workspace for turning a brief into a document you can inspect, edit, and take with you. Read the implementation, follow the product loop, or start with a blank page.
        </p>

        <div className="repo-card__features">
          {featureRows.map(([label, value]) => (
            <div key={label}>
              <span>{label}</span>
              <strong>{value}</strong>
            </div>
          ))}
        </div>

        <div className="repo-card__actions">
          <a href={repoUrl} target="_blank" rel="noreferrer" className="repo-card__github-link">
            <Github size={16} strokeWidth={1.7} />
            View on GitHub
            <ArrowUpRight size={15} strokeWidth={1.8} />
          </a>
          <button type="button" className="repo-card__blank-button" onClick={onOpenBlankDocument}>
            <FileText size={15} strokeWidth={1.7} />
            Open a blank document
          </button>
        </div>
      </div>
    </article>
  );
}
