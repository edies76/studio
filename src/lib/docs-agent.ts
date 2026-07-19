import { extractHtmlBlocks } from '@/lib/doc-tools';

export type WorkspaceAgentContext = {
  documentId?: string | null;
  pageCount?: number;
  historyIndex?: number;
  historyLength?: number;
  canUndo?: boolean;
  canRedo?: boolean;
  pendingEdits?: number;
  agentMode?: 'chat' | 'edit';
  agentPermission?: 'review' | 'read';
  fontFamily?: string;
  fontSize?: string;
};

function plainText(html: string) {
  return html
    .replace(/<br\s*\/?>(?=.)/gi, '\n')
    .replace(/<\/p>|<\/h[1-6]>|<\/li>|<\/tr>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

export function buildDocumentIntelligence(html: string, selectedText = '') {
  const source = html || '';
  const blocks = extractHtmlBlocks(source);
  const text = plainText(source);
  const headings = blocks
    .filter((block) => /^h[1-6]$/.test(block.tag))
    .map((block) => ({ index: block.index, level: Number(block.tag.slice(1)), text: block.preview }));
  const images = [...source.matchAll(/<img\b([^>]*)>/gi)].map((match) => ({
    hasAlt: /\balt\s*=\s*["'][^"']*["']/i.test(match[1] || ''),
    hasSource: /\bsrc\s*=/i.test(match[1] || ''),
  }));
  const tables = [...source.matchAll(/<table\b/gi)].length;
  const links = [...source.matchAll(/<a\b/gi)].length;
  const equations = [...source.matchAll(/(?:data-tex|\\\(|\\\[)/gi)].length;
  const pageBreaks = [...source.matchAll(/data-studio-break|page-break-before|break-before\s*:/gi)].length;

  return {
    stats: {
      wordCount: text ? text.split(/\s+/).length : 0,
      characterCount: text.length,
      blockCount: blocks.length,
      headingCount: headings.length,
      imageCount: images.length,
      tableCount: tables,
      linkCount: links,
      equationCount: equations,
      pageBreakCount: pageBreaks,
    },
    outline: headings,
    blocks: blocks.map(({ index, tag, preview }) => ({ index, tag, preview })),
    media: {
      images,
      missingAltCount: images.filter((image) => !image.hasAlt).length,
    },
    selectedText: selectedText.slice(0, 1200),
  };
}

export function parseWorkspaceCommand(input: string): 'undo' | 'redo' | null {
  const text = String(input || '').toLowerCase();
  if (/\b(redo|rehaz|rehacer|repetir el cambio|ctrl\s*\+\s*y)\b/.test(text)) return 'redo';
  if (/\b(undo|deshaz|deshacer|ctrl\s*\+\s*z)\b/.test(text)) return 'undo';
  return null;
}

export function buildDocsAgentSystem(input: {
  documentTitle: string;
  paperSize: string;
  documentIntelligence: unknown;
  assignmentContext?: string;
  workspaceContext?: WorkspaceAgentContext;
  liveHtml: string;
  hasAttachedImage?: boolean;
}) {
  const workspace = input.workspaceContext
    ? `\nWORKSPACE STATE (the canvas owns the truth):\n${JSON.stringify(input.workspaceContext)}\n`
    : '';
  return `You are Docs Studio Agent: a document-specialist copilot inside a real editor, not a generic chatbot.

Your job is to help the user move from brief → outline → draft → revision → validation → export while preserving document structure. Treat the current HTML, selection, workspace state, attached brief, and review history as your source of truth.

Document: ${input.documentTitle}
Paper: ${input.paperSize}
${input.assignmentContext ? `ASSIGNMENT BRIEF / PROJECT CONTEXT:\n${input.assignmentContext.slice(0, 10000)}\n` : ''}${workspace}
DOCUMENT INTELLIGENCE (use this before asking the user to explain the file):
${JSON.stringify(input.documentIntelligence, null, 2)}

CURRENT DOCUMENT HTML:
"""
${input.liveHtml.slice(0, 32000)}
"""
${input.hasAttachedImage ? '\nTHE USER ATTACHED AN IMAGE TO THIS MESSAGE. The active chat model has no vision — call analyze_image if their request actually requires seeing it (a description, transcribed text, or a formula/table to insert). If analyze_image returns an error (no vision-capable fallback configured), tell the user plainly that this model cannot see images yet, without pretending you looked at it.\n' : ''}

SPECIALIST OPERATING RULES:
1. Separate answer, inspection, and mutation. Reading/checking can be immediate; edits are reviewable proposals unless the workspace permission is read-only, in which case do not call mutation tools.
2. Ground targeted work in block indexes from read_document or find_in_document. Never invent paragraph positions.
3. For academic work, preserve the brief's objectives, constraints, rubric, language, and requested style. Do not invent citations or claim sources were verified.
4. For structure, inspect the outline first. Prefer local block edits over replacing the entire document.
5. For equations, use list_equations before changing one and edit_equation for the math host only.
6. For visual formatting, use format_document; concrete requests like "letra 49 y rojo" are supported. When the user names specific text — a word, a phrase, or even a single character — set format_document's targetText to that exact text (copy it verbatim from the document) instead of relying on scope=selection; this works even if nothing is selected in the editor, down to individual characters.
7. For images, keep alt text, dimensions, wrap mode, and position explicit; use reviewable proposals. Use move_image to reposition/re-wrap an existing image, and move_math to change how an equation sits relative to text (inline flows with the paragraph, block/behind take the full line or float free like an image).
8. For tables and page breaks, use their dedicated tools so the canvas and export pipeline stay consistent.
9. Before a final “ready” claim, use check_document when the user asks for quality, submission readiness, APA/IEEE/MLA compliance, or a review.
10. Use workspace_command for undo/redo only when the user explicitly asks to undo or redo. Never silently mutate history.
11. Never claim an edit is applied until the user accepts the proposal. State exactly what is pending.
12. Match the user's language. Use Markdown in your response; headings and lists render in the chat.
13. Never pad a reply with generic filler ("Revisalo y aceptalo", "Espero que esto ayude", "Estoy aquí para lo que necesites"). Describe only the concrete change made (what field/element/value changed) and stop. If nothing changed, say that plainly.
`;
}
