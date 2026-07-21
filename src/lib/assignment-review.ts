import type { AssignmentBrief, DeliveryEvidence, DeliveryRequirement, DeliveryRequirementStatus, DeliverySnapshot } from '@/lib/assignment-types';
import type { StudioDocumentModel } from '@/lib/studio-document';

export type AssignmentReview = {
  title: string;
  covered: number;
  total: number;
  coveragePercent: number;
  requirements: DeliveryRequirement[];
  missingEvidence: string[];
  missingImages: string[];
  blockers: string[];
  warnings: string[];
  readiness: DeliverySnapshot['readiness'];
  readyToReview: boolean;
  snapshot: DeliverySnapshot;
};

type EvidenceBlock = { id: string; text: string; label: string; kind: DeliveryEvidence['kind'] };

function words(value: string) {
  return value.toLocaleLowerCase().match(/[\p{L}\p{N}]{3,}/gu) || [];
}

function clean(value: string) {
  return value.replace(/\s+/g, ' ').trim();
}

function stableId(value: string, index: number) {
  let hash = 2166136261;
  for (const char of value) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  return `legacy-block-${(hash >>> 0).toString(16)}-${index}`;
}

function blockText(block: StudioDocumentModel['blocks'][number]) {
  if (block.type === 'image') return block.alt;
  if (block.type === 'equation') return block.tex;
  if (block.type === 'pageBreak') return '';
  if (block.type === 'table') return block.rows.flatMap((row) => row.cells.flatMap((cell) => cell.runs.map((run) => run.text))).join(' ');
  if (block.type === 'list') return block.items.flatMap((item) => item.runs.map((run) => run.text)).join(' ');
  return block.runs.map((run) => run.text).join(' ');
}

function blocksFromDocument(html: string, model?: StudioDocumentModel): EvidenceBlock[] {
  if (model?.blocks?.length) {
    return model.blocks.flatMap((block) => {
      const text = clean(blockText(block));
      if (!text && block.type !== 'image' && block.type !== 'equation') return [];
      const label = block.type === 'heading' ? text : block.type === 'table' ? 'Table' : block.type === 'equation' ? 'Equation' : block.type === 'image' ? `Image: ${block.alt || 'untitled'}` : text.slice(0, 90);
      const kind: DeliveryEvidence['kind'] = block.type === 'image' ? 'image' : block.type === 'table' ? 'table' : block.type === 'equation' ? 'equation' : 'document_block';
      return [{ id: block.id, text, label, kind }];
    });
  }
  const matches = Array.from((html || '').matchAll(/<(h[1-6]|p|li|blockquote|pre|table|img|div)\b[^>]*>([\s\S]*?)<\/\1>|<img\b([^>]*)>/gi));
  return matches.flatMap((match, index) => {
    const raw = clean((match[2] || match[3] || '').replace(/<[^>]+>/g, ' '));
    if (!raw) return [];
    return [{ id: stableId(raw, index), text: raw, label: raw.slice(0, 90), kind: match[1]?.toLowerCase() === 'table' ? 'table' : 'document_block' }];
  });
}

function matchingBlocks(blocks: EvidenceBlock[], label: string) {
  const terms = words(label).filter((term) => !['debe', 'para', 'como', 'with', 'from', 'this', 'that', 'using', 'must', 'have', 'your'].includes(term));
  if (!terms.length) return [];
  return blocks.filter((block) => {
    const text = block.text.toLocaleLowerCase();
    const matched = terms.filter((term) => text.includes(term)).length;
    return matched >= (terms.length > 3 ? 2 : 1);
  }).slice(0, 5);
}

function actionFor(label: string): DeliveryRequirement['nextAction'] {
  if (/image|figure|chart|graph|diagram|figura|gr[aá]fic|imagen/i.test(label)) return 'add_figure';
  if (/equation|formula|matrix|system|gauss|math|ecuaci[oó]n|f[oó]rmula|matriz/i.test(label)) return 'check_math';
  if (/source|citation|reference|bibliograph|fuente|cita|referenc/i.test(label)) return 'find_source';
  if (/discuss|analy|argument|explain|compare|discussion|analiza|explica|compara/i.test(label)) return 'improve_argument';
  return 'draft_section';
}

function statusFor(source: DeliveryRequirement['source'], matches: EvidenceBlock[], label: string): DeliveryRequirementStatus {
  if (!matches.length) return source === 'rubric' || source === 'constraint' || source === 'format' ? 'needs_review' : 'not_started';
  if (source === 'rubric' || source === 'constraint' || source === 'format') return 'needs_review';
  if (/step|procedure|compare|conclusion|explain|analys|paso|conclus|compara|explica/i.test(label) && matches.length < 2) return 'partial';
  return 'done';
}

function makeRequirement(source: DeliveryRequirement['source'], sourceId: string, label: string, description: string, weightPercent: number | undefined, blocks: EvidenceBlock[], now: number): DeliveryRequirement {
  const matched = matchingBlocks(blocks, `${label} ${description}`);
  const status = statusFor(source, matched, `${label} ${description}`);
  const evidence = matched.map((block) => ({ id: `${sourceId}-${block.id}`, kind: block.kind, label: `${block.label} · ${block.id}`, blockId: block.id, verified: true, note: 'Located in the current document.' } satisfies DeliveryEvidence));
  const missingEvidence = status === 'done' ? [] : [source === 'rubric' ? 'Human review is required for this quality criterion.' : `No reliable evidence found for “${label}”.`];
  return {
    id: `${source}-${sourceId}`,
    source,
    sourceId,
    label,
    description: description || label,
    weightPercent,
    status,
    covered: status === 'done',
    explanation: status === 'done' ? `Evidence found in ${matched.length} document block(s).` : status === 'partial' ? 'Some evidence is present, but the document needs a deeper treatment.' : missingEvidence[0],
    evidence,
    missingEvidence,
    nextAction: status === 'done' ? 'none' : actionFor(`${label} ${description}`),
    lastReviewedAt: now,
    reviewer: 'deterministic',
    affectedBlockIds: matched.map((block) => block.id),
  };
}

function sourceRequirements(brief: AssignmentBrief) {
  const constraints = brief.constraints.filter((item) => /source|citation|reference|bibliograph|image|figure|chart|page|pdf|docx|apa|mla|ieee|word limit|extension|fuente|cita|referenc|imagen|p[aá]gina/i.test(item));
  return constraints.map((item, index) => ({ id: `constraint-${index}`, label: item, description: item }));
}

/** Transparent deterministic pass. It creates a delivery graph; the agent can enrich it but cannot invent coverage. */
export function buildDeliverySnapshot(brief: AssignmentBrief | undefined, html: string, model?: StudioDocumentModel, documentRevision = 1, previousAgentUpdate?: DeliverySnapshot['lastAgentUpdate']): DeliverySnapshot | null {
  if (!brief) return null;
  const now = Date.now();
  const blocks = blocksFromDocument(html, model);
  const requirements: DeliveryRequirement[] = [
    ...brief.tasks.map((task) => makeRequirement('task', task.id, task.title, task.description, undefined, blocks, now)),
    ...brief.rubric.map((criterion) => makeRequirement('rubric', criterion.id, criterion.name, criterion.levels.map((level) => `${level.label}: ${level.description}`).join(' '), criterion.weightPercent, blocks, now)),
    ...sourceRequirements(brief).map((item) => makeRequirement('constraint', item.id, item.label, item.description, undefined, blocks, now)),
  ];
  const imagesRequired = requirements.filter((item) => /image|figure|chart|graph|diagram|imagen|figura|gr[aá]fic/i.test(`${item.label} ${item.description}`));
  const imageCount = blocks.filter((block) => block.kind === 'image').length;
  if (imagesRequired.length > imageCount) {
    const imageRequirement = imagesRequired.find((item) => item.status !== 'done');
    if (imageRequirement) {
      imageRequirement.status = 'blocked';
      imageRequirement.covered = false;
      imageRequirement.missingEvidence = [`${imagesRequired.length - imageCount} required visual(s) are missing.`];
      imageRequirement.explanation = imageRequirement.missingEvidence[0];
      imageRequirement.nextAction = 'add_figure';
    }
  }
  const required = requirements.filter((item) => item.source === 'task' || item.source === 'rubric');
  const covered = required.filter((item) => item.covered).length;
  const blockers = requirements.filter((item) => item.status === 'blocked').map((item) => item.label).slice(0, 12);
  const warnings = requirements.filter((item) => item.status === 'partial' || item.status === 'needs_review').map((item) => item.label).slice(0, 12);
  const readiness: DeliverySnapshot['readiness'] = blockers.length || !required.length ? 'not_ready' : warnings.length || covered < required.length ? 'warnings' : 'ready';
  return { version: 1, briefTitle: brief.title, briefRevision: stableId(brief.rawText || brief.title, 0), documentRevision, coveragePercent: required.length ? Math.round((covered / required.length) * 100) : 0, covered, total: required.length, readiness, requirements, blockers, warnings, lastCheckedAt: now, lastAgentUpdate: previousAgentUpdate };
}

export function reviewAssignment(brief: AssignmentBrief | undefined, html: string, model?: StudioDocumentModel, documentRevision = 1): AssignmentReview | null {
  const snapshot = buildDeliverySnapshot(brief, html, model, documentRevision);
  if (!snapshot || !brief) return null;
  const missingEvidence = snapshot.requirements.flatMap((item) => item.missingEvidence).slice(0, 12);
  const missingImages = snapshot.requirements.filter((item) => item.nextAction === 'add_figure' && item.status !== 'done').map((item) => item.label);
  return {
    title: snapshot.briefTitle,
    covered: snapshot.covered,
    total: snapshot.total,
    coveragePercent: snapshot.coveragePercent,
    requirements: snapshot.requirements,
    missingEvidence,
    missingImages,
    blockers: snapshot.blockers,
    warnings: snapshot.warnings,
    readiness: snapshot.readiness,
    readyToReview: snapshot.readiness === 'ready',
    snapshot,
  };
}
