'use client';

type GithubRepoCardProps = {
  onOpenBlankDocument: () => void;
};

const repoUrl = 'https://github.com/edies76/docs-studio';

const featureRows = [
  ['Canvas', 'Letter + Legal pages'],
  ['AI loop', 'Draft → review → decide'],
  ['Output', 'PDF + server-generated DOCX'],
];

export default function GithubRepoCard({ onOpenBlankDocument }: GithubRepoCardProps) {
  return (
    <article className="repo-card repo-card--minimal">
      <div className="repo-card__minimal-mark" aria-hidden="true">
        <span>DS</span>
        <i />
        <i />
        <i />
      </div>

      <div className="repo-card__body">
        <div className="repo-card__eyebrow">SOURCE / OPEN BUILD</div>
        <h3>The product is visible in the repository.</h3>
        <p>
          Inspect the actual canvas, streaming draft route, review state, MathJax, importers, and export paths that make Docs Studio a workspace instead of a prompt box.
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
            Open repository <span aria-hidden="true">↗</span>
          </a>
          <button type="button" className="repo-card__blank-button" onClick={onOpenBlankDocument}>
            Start with a blank page <span aria-hidden="true">→</span>
          </button>
        </div>
      </div>
    </article>
  );
}
