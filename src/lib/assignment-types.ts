/** Shared types for professor assignment → rubric → grade cycle (client-safe). */

export type RubricLevel = {
  label: string;
  description: string;
  scoreRange?: string;
};

export type RubricCriterion = {
  id: string;
  name: string;
  weightPercent: number;
  levels: RubricLevel[];
};

export type AssignmentTask = {
  id: string;
  title: string;
  description: string;
  required: boolean;
};

export type BriefReference = {
  name: string;
  mimeType?: string;
  size?: number;
};

export type AssignmentBrief = {
  title: string;
  course?: string;
  objectives: string[];
  instructions: string;
  tasks: AssignmentTask[];
  constraints: string[];
  learningOutcome?: string;
  rubric: RubricCriterion[];
  rawText: string;
  references?: BriefReference[];
  systems?: string[];
  language?: 'es' | 'en';
};

export type DeliveryRequirementStatus = 'not_started' | 'in_progress' | 'partial' | 'done' | 'blocked' | 'needs_review';
export type DeliveryRequirementSource = 'task' | 'rubric' | 'constraint' | 'format' | 'source';

export type DeliveryEvidence = {
  id: string;
  kind: 'document_block' | 'reference' | 'brief' | 'calculation' | 'image' | 'table' | 'equation' | 'decision';
  label: string;
  blockId?: string;
  sourceId?: string;
  verified: boolean;
  note?: string;
};

export type DeliveryRequirement = {
  id: string;
  source: DeliveryRequirementSource;
  sourceId?: string;
  label: string;
  description: string;
  weightPercent?: number;
  status: DeliveryRequirementStatus;
  covered: boolean;
  explanation: string;
  evidence: DeliveryEvidence[];
  missingEvidence: string[];
  nextAction: 'draft_section' | 'find_source' | 'check_math' | 'add_figure' | 'improve_argument' | 'review_human' | 'none';
  lastReviewedAt?: number;
  reviewer: 'deterministic' | 'agent' | 'human';
  affectedBlockIds: string[];
};

export type DeliveryAgentUpdate = {
  summary: string;
  items: Array<{ id: string; status: DeliveryRequirementStatus; note?: string; evidence?: DeliveryEvidence[]; affectedBlockIds?: string[] }>;
  at: number;
};

export type DeliverySnapshot = {
  version: 1;
  briefTitle: string;
  briefRevision: string;
  documentRevision: number;
  coveragePercent: number;
  covered: number;
  total: number;
  readiness: 'ready' | 'warnings' | 'not_ready' | 'no_brief';
  requirements: DeliveryRequirement[];
  blockers: string[];
  warnings: string[];
  lastCheckedAt: number;
  lastAgentUpdate?: DeliveryAgentUpdate;
};

export type GradeCriterionResult = {
  criterionId: string;
  name: string;
  weightPercent: number;
  score: number; // 0..max for that criterion
  maxScore: number;
  feedback: string;
  status: 'pass' | 'partial' | 'fail';
};

export type GradeResult = {
  totalScore: number;
  maxTotal: number;
  percent: number;
  criteria: GradeCriterionResult[];
  missingTasks: string[];
  strengths: string[];
  improvements: string[];
  readyToExport: boolean;
};

export type ChecklistItem = {
  id: string;
  label: string;
  done: boolean;
  source: 'task' | 'rubric' | 'constraint';
};
