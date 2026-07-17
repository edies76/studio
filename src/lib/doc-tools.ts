/** Tool schemas for Studio document chat (client + server safe names). */

export type PaperSize = 'letter' | 'legal';

export type ProposeEditPayload = {
  title: string;
  summary: string;
  beforeHtml?: string;
  afterHtml: string;
  mode: 'replace_document' | 'replace_selection' | 'insert_html';
  selectionHint?: string;
  changeList?: string[];
};

export type ChatStreamEvent =
  | { type: 'status'; label: string }
  | { type: 'thinking'; label: string }
  | { type: 'text'; delta: string }
  | { type: 'tool_start'; name: string; label: string }
  | { type: 'tool_end'; name: string; ok: boolean }
  | { type: 'propose_edit'; id: string; edit: ProposeEditPayload }
  | { type: 'done'; finalText?: string; model?: string }
  | { type: 'error'; message: string };

export const STUDIO_TOOL_DEFINITIONS = [
  {
    name: 'set_status',
    description:
      'Update the live activity chip. Call as you progress with short labels (Thinking…, Rewriting selection…, Proposing edit…). Do NOT invent multi-step plans.',
    parameters: {
      type: 'OBJECT',
      properties: {
        label: {
          type: 'STRING',
          description: 'Short status e.g. "Rewriting selection…"',
        },
        phase: {
          type: 'STRING',
          description: 'Optional phase key: thinking|rewrite|format|propose|done',
        },
      },
      required: ['label'],
    },
  },
  {
    name: 'propose_edit',
    description:
      'Propose a document edit for an EXISTING document. User must Accept before apply. Never use for brand-new empty docs (client handles first draft). Include beforeHtml + changeList.',
    parameters: {
      type: 'OBJECT',
      properties: {
        title: { type: 'STRING' },
        summary: { type: 'STRING', description: 'What changed and why (1–3 sentences)' },
        mode: {
          type: 'STRING',
          enum: ['replace_document', 'replace_selection', 'insert_html'],
        },
        afterHtml: {
          type: 'STRING',
          description:
            'New HTML. Tags: h1-h3,p,ul,ol,li,table,pre,code,strong,em. Math: Unicode preferred. No markdown fences.',
        },
        beforeHtml: {
          type: 'STRING',
          description: 'Previous HTML being replaced (for ghost/diff).',
        },
        selectionHint: { type: 'STRING' },
        changeList: {
          type: 'ARRAY',
          items: { type: 'STRING' },
          description: 'Bullet list of concrete changes for the review UI',
        },
      },
      required: ['title', 'summary', 'mode', 'afterHtml'],
    },
  },
] as const;
