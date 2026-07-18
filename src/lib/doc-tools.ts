/** Tool schemas for Studio document chat (client + server safe names). */

export type PaperSize = 'letter' | 'legal';

export type ProposeEditPayload = {
  title: string;
  summary: string;
  beforeHtml?: string;
  afterHtml: string;
  mode: 'replace_document' | 'replace_selection' | 'insert_html' | 'replace_block';
  /** 0-based block index for replace_block (p, h1-h3, li, table, etc.) */
  blockIndex?: number;
  selectionHint?: string;
  changeList?: string[];
};

export type ChatStreamEvent =
  | { type: 'status'; label: string }
  | { type: 'thinking'; label: string }
  | { type: 'text'; delta: string }
  | { type: 'tool_start'; name: string; label: string; id?: string }
  | { type: 'tool_end'; name: string; ok: boolean; label?: string; id?: string }
  | { type: 'propose_edit'; id: string; edit: ProposeEditPayload }
  | { type: 'done'; finalText?: string; model?: string }
  | { type: 'error'; message: string };

export const STUDIO_TOOL_DEFINITIONS = [
  {
    name: 'set_status',
    description:
      'Short live status the user can see (e.g. "Leyendo el documento…", "Editando párrafo 3…"). Call before heavy work.',
    parameters: {
      type: 'OBJECT',
      properties: {
        label: { type: 'STRING', description: 'Short status in user language' },
        phase: {
          type: 'STRING',
          description: 'Optional: thinking|read|edit|propose|done',
        },
      },
      required: ['label'],
    },
  },
  {
    name: 'read_document',
    description:
      'Read the current document and return a numbered list of blocks (headings, paragraphs, tables). ALWAYS call this before targeted edits so you know indices. Does not change the document.',
    parameters: {
      type: 'OBJECT',
      properties: {
        focus: {
          type: 'STRING',
          description: 'Optional focus hint e.g. "introduction" or "tables"',
        },
      },
      required: [],
    },
  },
  {
    name: 'edit_paragraph',
    description:
      'Propose a targeted edit of ONE block by index from read_document. User must Accept. Prefer this over full-document rewrites when the user asked for point changes. Include the original block HTML as beforeHtml if possible.',
    parameters: {
      type: 'OBJECT',
      properties: {
        blockIndex: {
          type: 'NUMBER',
          description: '0-based index from read_document list',
        },
        title: { type: 'STRING' },
        summary: { type: 'STRING', description: 'What changed and why (1–2 sentences)' },
        afterHtml: {
          type: 'STRING',
          description: 'Replacement HTML for that single block only (e.g. one <p> or <h2>)',
        },
        beforeHtml: {
          type: 'STRING',
          description: 'Optional original block HTML for diff',
        },
      },
      required: ['blockIndex', 'title', 'summary', 'afterHtml'],
    },
  },
  {
    name: 'propose_edit',
    description:
      'Propose a larger edit (full document or current selection). User must Accept. For single-paragraph fixes prefer edit_paragraph. Never use on brand-new empty docs (client drafts those).',
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
          description: 'Bullet list of concrete changes',
        },
      },
      required: ['title', 'summary', 'mode', 'afterHtml'],
    },
  },
  {
    name: 'list_equations',
    description:
      'MATH-SAFE: List every equation/formula in the document with index, display/inline flag, and exact TeX source. ALWAYS call this before changing any formula. Does not modify the document.',
    parameters: {
      type: 'OBJECT',
      properties: {
        focus: {
          type: 'STRING',
          description: 'Optional filter e.g. "display only" or "linear algebra"',
        },
      },
      required: [],
    },
  },
  {
    name: 'edit_equation',
    description:
      'MATH-SAFE: Replace ONE equation by index from list_equations. Only changes the math host (data-tex / \\( \\) / \\[ \\]). Surrounding prose stays. Prefer this over edit_paragraph when the user asked to fix a formula. Proposes a document edit the user must Accept.',
    parameters: {
      type: 'OBJECT',
      properties: {
        equationIndex: {
          type: 'NUMBER',
          description: '0-based index from list_equations',
        },
        tex: {
          type: 'STRING',
          description: 'New LaTeX WITHOUT surrounding \\( \\) or \\[ \\] delimiters',
        },
        display: {
          type: 'BOOLEAN',
          description: 'true = display/block math, false = inline. Omit to keep current.',
        },
        title: { type: 'STRING' },
        summary: { type: 'STRING' },
      },
      required: ['equationIndex', 'tex', 'title', 'summary'],
    },
  },
  {
    name: 'insert_equation',
    description:
      'MATH-SAFE: Insert a new equation after a block index from read_document (or at end if blockIndex omitted). Creates a proper studio-math host. User must Accept.',
    parameters: {
      type: 'OBJECT',
      properties: {
        afterBlockIndex: {
          type: 'NUMBER',
          description: 'Insert after this read_document block index; omit to append at end',
        },
        tex: { type: 'STRING', description: 'LaTeX without delimiters' },
        display: { type: 'BOOLEAN', description: 'Default true for new equations' },
        title: { type: 'STRING' },
        summary: { type: 'STRING' },
      },
      required: ['tex', 'title', 'summary'],
    },
  },
] as const;

/** Extract top-level-ish content blocks from HTML for read/edit_paragraph */
export function extractHtmlBlocks(html: string): { index: number; tag: string; preview: string; html: string }[] {
  if (!html?.trim()) return [];
  // Prefer top-level fragments between tags
  const cleaned = html
    .replace(/<\/?(html|head|body)[^>]*>/gi, '')
    .replace(/<div[^>]*data-studio-break[^>]*>[\s\S]*?<\/div>/gi, '')
    .replace(/<div[^>]*data-studio-tail[^>]*>[\s\S]*?<\/div>/gi, '');

  const re =
    /<(h[1-6]|p|li|blockquote|pre|table|ul|ol)(\s[^>]*)?>[\s\S]*?<\/\1>/gi;
  const out: { index: number; tag: string; preview: string; html: string }[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(cleaned))) {
    // skip nested li inside already-captured ul? simple: skip if inside previous table-ish
    const full = m[0];
    const tag = m[1].toLowerCase();
    // skip li if we're going to show ul/ol as whole — keep li for edit granularity
    const plain = full
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 140);
    if (!plain && tag !== 'table') continue;
    out.push({
      index: out.length,
      tag,
      preview: plain || `[${tag}]`,
      html: full,
    });
  }
  return out;
}
