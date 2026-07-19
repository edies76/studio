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
