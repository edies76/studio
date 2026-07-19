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
  | { type: 'workspace_command'; command: 'undo' | 'redo' }
  | { type: 'propose_edit'; id: string; edit: ProposeEditPayload }
  | {
      type: 'done';
      finalText?: string;
      model?: string;
      durationMs?: number;
      outcome?: 'answer' | 'proposal' | 'error';
    }
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
    name: 'inspect_document',
    description:
      'Read structured document intelligence: outline, numbered blocks, word count, images, tables, links, equations, page breaks, and selection context. Use before structural or quality work. Does not modify the document.',
    parameters: {
      type: 'OBJECT',
      properties: { focus: { type: 'STRING', description: 'Optional focus: outline, media, structure, academic, or all.' } },
      required: [],
    },
  },
  {
    name: 'find_in_document',
    description:
      'Search the current document by phrase and return matching block indexes and previews before a targeted edit.',
    parameters: {
      type: 'OBJECT',
      properties: { query: { type: 'STRING', description: 'Text or phrase to find.' }, maxResults: { type: 'NUMBER', description: 'Maximum matches, 1–30.' } },
      required: ['query'],
    },
  },
  {
    name: 'check_document',
    description:
      'Run deterministic readiness checks for readable content, heading hierarchy, image alt text, table headers, equations, page breaks, and pending review state.',
    parameters: {
      type: 'OBJECT',
      properties: { focus: { type: 'STRING', description: 'Optional focus: academic, accessibility, structure, or all.' } },
      required: [],
    },
  },
  {
    name: 'workspace_command',
    description:
      'Control a reversible workspace action explicitly requested by the user. Use undo for “deshaz/undo” and redo for “rehaz/redo”.',
    parameters: {
      type: 'OBJECT',
      properties: { command: { type: 'STRING', enum: ['undo', 'redo'] } },
      required: ['command'],
    },
  },
  {
    name: 'edit_table_cell',
    description: 'Change exactly one cell in an existing table as a reviewable proposal. Read or inspect the document first to confirm indexes.',
    parameters: {
      type: 'OBJECT',
      properties: {
        tableIndex: { type: 'NUMBER', description: '0-based table index.' },
        rowIndex: { type: 'NUMBER', description: '0-based row index. Header row is usually 0.' },
        columnIndex: { type: 'NUMBER', description: '0-based column index.' },
        content: { type: 'STRING', description: 'Plain text content for the cell.' },
        title: { type: 'STRING' },
        summary: { type: 'STRING' },
      },
      required: ['tableIndex', 'rowIndex', 'columnIndex', 'content'],
    },
  },
  {
    name: 'insert_table',
    description:
      'Create a real editable HTML table as a reviewable proposal. Use when the user asks for a table, matrix, comparison, schedule, or structured rows and columns.',
    parameters: {
      type: 'OBJECT',
      properties: {
        rows: { type: 'NUMBER', description: 'Number of rows, 1–20.' },
        columns: { type: 'NUMBER', description: 'Number of columns, 1–12.' },
        hasHeader: { type: 'BOOLEAN', description: 'Whether the first row is a semantic header row. Defaults to true.' },
        caption: { type: 'STRING', description: 'Optional short caption displayed above the table.' },
        afterBlockIndex: { type: 'NUMBER', description: 'Optional block index after which to insert.' },
        title: { type: 'STRING' },
        summary: { type: 'STRING' },
      },
      required: [],
    },
  },
  {
    name: 'insert_page_break',
    description: 'Insert a real page break as a reviewable proposal that survives canvas and export.',
    parameters: { type: 'OBJECT', properties: {}, required: [] },
  },
  {
    name: 'insert_image',
    description:
      'Insert an HTTPS or data image as a reviewable proposal with alt text, dimensions, Word-like wrap mode, and optional free position.',
    parameters: {
      type: 'OBJECT',
      properties: {
        src: { type: 'STRING', description: 'HTTPS URL or data:image URL.' },
        alt: { type: 'STRING', description: 'Accessible alternative text.' },
        width: { type: 'NUMBER', description: 'Width in pixels, 40–2400.' },
        wrap: { type: 'STRING', enum: ['inline', 'left', 'right', 'center', 'break', 'behind'] },
        left: { type: 'NUMBER', description: 'Left position in pixels when wrap=behind.' },
        top: { type: 'NUMBER', description: 'Top position in pixels when wrap=behind.' },
      },
      required: ['src'],
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
    name: 'format_document',
    description:
      'Apply an explicit document-editor format request as a real proposal. Use this for font size, text color, highlight, font family, bold/italic, alignment, line height, or letter spacing. Never say CSS is unsupported: this tool translates the request into safe document styles. Scope defaults to the entire document; use selection or block when the user specifies one.',
    parameters: {
      type: 'OBJECT',
      properties: {
        scope: {
          type: 'STRING',
          enum: ['document', 'selection', 'block'],
          description: 'Where to apply formatting. Default document.',
        },
        blockIndex: {
          type: 'NUMBER',
          description: '0-based block index from read_document when scope=block.',
        },
        fontSize: {
          type: 'STRING',
          description: 'Font size such as 49px, 18pt, 1.2em, or a bare number interpreted as px.',
        },
        color: { type: 'STRING', description: 'Text color: named color, hex, rgb, or Spanish color name.' },
        backgroundColor: { type: 'STRING', description: 'Text highlight/background color.' },
        fontFamily: { type: 'STRING', description: 'Font family such as Arial, Georgia, Inter, or Times New Roman.' },
        fontWeight: { type: 'STRING', enum: ['normal', 'bold', '600', '700'] },
        fontStyle: { type: 'STRING', enum: ['normal', 'italic'] },
        textAlign: { type: 'STRING', enum: ['left', 'center', 'right', 'justify'] },
        lineHeight: { type: 'STRING', description: 'Line height such as 1.5 or 24px.' },
        letterSpacing: { type: 'STRING', description: 'Letter spacing such as 0.02em or 1px.' },
      },
      required: [],
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

  // Include studio-math-block so insert_equation / edit can target math by block index
  const re =
    /<(h[1-6]|p|li|blockquote|pre|table|ul|ol|div)(\s[^>]*)?>[\s\S]*?<\/\1>/gi;
  const out: { index: number; tag: string; preview: string; html: string }[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(cleaned))) {
    const full = m[0];
    let tag = m[1].toLowerCase();
    const attrs = m[2] || '';
    // Only keep divs that are math hosts (ignore layout wrappers)
    if (tag === 'div') {
      if (!/studio-math|data-tex|data-display/i.test(attrs + full)) continue;
      tag = 'math';
    }
    const plain = full
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 140);
    if (!plain && tag !== 'table' && tag !== 'math') continue;
    const preview =
      tag === 'math'
        ? `[math] ${(full.match(/data-tex="([^"]*)"/i)?.[1] || plain).slice(0, 100)}`
        : plain || `[${tag}]`;
    out.push({
      index: out.length,
      tag,
      preview,
      html: full,
    });
  }
  return out;
}
