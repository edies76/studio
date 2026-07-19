import type { AssignmentBrief } from '@/lib/assignment-types';

export type AssignmentReview = {
  title: string;
  covered: number;
  total: number;
  requirements: Array<{ id: string; label: string; covered: boolean }>;
  missingEvidence: string[];
  missingImages: string[];
  readyToReview: boolean;
};

function words(value: string) {
  return value.toLocaleLowerCase().match(/[\p{L}\p{N}]{4,}/gu) || [];
}

function matches(text: string, label: string) {
  const terms = words(label).filter((term) => !['debe', 'para', 'como', 'with', 'from', 'this', 'that'].includes(term));
  return terms.length === 0 || terms.some((term) => text.includes(term));
}

/** A transparent deterministic pass. The agent can explain it, but cannot invent coverage. */
export function reviewAssignment(brief: AssignmentBrief | undefined, html: string): AssignmentReview | null {
  if (!brief) return null;
  const text = html.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').toLocaleLowerCase();
  const requirements = brief.tasks.map((task) => ({ id: task.id, label: task.title, covered: matches(text, `${task.title} ${task.description}`) }));
  const imageTasks = brief.tasks.filter((task) => /imagen|figura|gr[aá]fic|diagram|image|figure|chart/i.test(`${task.title} ${task.description}`));
  const imageCount = (html.match(/<img\b/gi) || []).length;
  const missingImages = imageTasks.slice(imageCount).map((task) => task.title);
  const hasReferences = /referencias|bibliograf[ií]a|references|bibliography|<cite\b/i.test(text + html);
  const missingEvidence = [
    ...(brief.constraints.filter((item) => /fuente|cita|referenc|bibliograph|source|citation/i.test(item) && !hasReferences)),
    ...(brief.rubric.filter((item) => !matches(text, item.name)).map((item) => item.name)),
  ].slice(0, 8);
  const covered = requirements.filter((item) => item.covered).length;
  return { title: brief.title, covered, total: requirements.length, requirements, missingEvidence, missingImages, readyToReview: covered === requirements.length && !missingEvidence.length && !missingImages.length };
}
