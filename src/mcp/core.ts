import type { AssignmentBrief } from '../lib/assignment-types';
import { sanitizeDocumentHtml } from '../lib/math-html';

export type DocumentPaperSize = 'letter' | 'legal';

export type HistoryEntry = {
  id: string;
  type: 'created' | 'drafted' | 'edited' | 'proposed' | 'accepted' | 'rejected' | 'inserted' | 'exported';
  label: string;
  at: string;
};

export type PendingEdit = {
  id: string;
  title: string;
  summary: string;
  mode: 'replace_document' | 'replace_selection' | 'replace_block';
  beforeHtml: string;
  afterHtml: string;
  selectionHint?: string;
  createdAt: string;
  status: 'pending' | 'accepted' | 'rejected';
};

export type StudioDocument = {
  id: string;
  title: string;
  html: string;
  paperSize: DocumentPaperSize;
  createdAt: string;
  updatedAt: string;
  brief?: AssignmentBrief;
  history: HistoryEntry[];
  pendingEdits: Map<string, PendingEdit>;
};

function uid(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function now() {
  return new Date().toISOString();
}

function plainText(html: string) {
  return decodeEntities(
    html
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>|<\/h[1-6]>|<\/li>|<\/tr>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/[ \t]+/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim(),
  );
}

function decodeEntities(value: string) {
  return value
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export type DocumentBlock = {
  index: number;
  tag: string;
  html: string;
  preview: string;
};

export function extractDocumentBlocks(html: string): DocumentBlock[] {
  const blocks: DocumentBlock[] = [];
  const pattern = /<(h1|h2|h3|p|li|pre|blockquote)(?:\s[^>]*)?>[\s\S]*?<\/\1>/gi;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(html))) {
    const blockHtml = match[0];
    blocks.push({
      index: blocks.length,
      tag: match[1].toLowerCase(),
      html: blockHtml,
      preview: plainText(blockHtml).slice(0, 180),
    });
  }
  return blocks;
}

export function publicDocument(document: StudioDocument) {
  return {
    id: document.id,
    title: document.title,
    paperSize: document.paperSize,
    html: document.html,
    text: plainText(document.html),
    wordCount: plainText(document.html).split(/\s+/).filter(Boolean).length,
    blocks: extractDocumentBlocks(document.html).map(({ index, tag, preview }) => ({ index, tag, preview })),
    pendingEdits: Array.from(document.pendingEdits.values()).filter((edit) => edit.status === 'pending'),
    createdAt: document.createdAt,
    updatedAt: document.updatedAt,
    brief: document.brief
      ? {
          title: document.brief.title,
          course: document.brief.course,
          objectives: document.brief.objectives,
          instructions: document.brief.instructions,
          tasks: document.brief.tasks,
          constraints: document.brief.constraints,
          rubric: document.brief.rubric,
        }
      : undefined,
  };
}

export class DocsStudioWorkspace {
  private documents = new Map<string, StudioDocument>();

  createDocument(input: {
    title?: string;
    html?: string;
    paperSize?: DocumentPaperSize;
    brief?: AssignmentBrief;
  }) {
    const createdAt = now();
    const document: StudioDocument = {
      id: uid('doc'),
      title: input.title?.trim() || 'Untitled document',
      html: sanitizeDocumentHtml(input.html || ''),
      paperSize: input.paperSize === 'legal' ? 'legal' : 'letter',
      createdAt,
      updatedAt: createdAt,
      brief: input.brief,
      history: [],
      pendingEdits: new Map(),
    };
    this.documents.set(document.id, document);
    this.addHistory(document, 'created', 'Created document');
    return document;
  }

  listDocuments() {
    return Array.from(this.documents.values()).map((document) => publicDocument(document));
  }

  getDocument(id: string) {
    const document = this.documents.get(id);
    if (!document) throw new Error(`Document not found: ${id}`);
    return document;
  }

  readDocument(id: string) {
    return publicDocument(this.getDocument(id));
  }

  setBrief(id: string, brief: AssignmentBrief) {
    const document = this.getDocument(id);
    document.brief = brief;
    document.updatedAt = now();
    this.addHistory(document, 'edited', `Attached brief: ${brief.title}`);
    return publicDocument(document);
  }

  replaceContent(id: string, html: string, type: HistoryEntry['type'], label: string) {
    const document = this.getDocument(id);
    document.html = sanitizeDocumentHtml(html);
    document.updatedAt = now();
    this.addHistory(document, type, label);
    return publicDocument(document);
  }

  proposeEdit(input: ProposalInput) {
    const document = this.getDocument(input.documentId);
    const edit: PendingEdit & { documentId?: string } = {
      id: uid('edit'),
      createdAt: now(),
      status: 'pending',
      title: input.title,
      summary: input.summary,
      mode: input.mode,
      beforeHtml: input.beforeHtml,
      afterHtml: sanitizeDocumentHtml(input.afterHtml),
      selectionHint: input.selectionHint,
    };
    document.pendingEdits.set(edit.id, edit);
    document.updatedAt = now();
    this.addHistory(document, 'proposed', `${edit.title} · pending review`);
    return edit;
  }

  acceptEdit(documentId: string, editId: string) {
    const document = this.getDocument(documentId);
    const edit = document.pendingEdits.get(editId);
    if (!edit || edit.status !== 'pending') throw new Error(`Pending edit not found: ${editId}`);

    if (edit.mode === 'replace_document') {
      if (edit.beforeHtml && document.html !== edit.beforeHtml) {
        throw new Error('Document changed since this proposal. Read it again and create a fresh proposal.');
      }
      document.html = edit.afterHtml;
    } else {
      const current = edit.beforeHtml || document.html;
      const position = document.html.indexOf(current);
      if (position < 0) {
        throw new Error('The proposed selection is no longer present in the document.');
      }
      document.html = `${document.html.slice(0, position)}${edit.afterHtml}${document.html.slice(position + current.length)}`;
    }
    edit.status = 'accepted';
    document.updatedAt = now();
    this.addHistory(document, 'accepted', edit.title);
    return publicDocument(document);
  }

  rejectEdit(documentId: string, editId: string) {
    const document = this.getDocument(documentId);
    const edit = document.pendingEdits.get(editId);
    if (!edit || edit.status !== 'pending') throw new Error(`Pending edit not found: ${editId}`);
    edit.status = 'rejected';
    document.updatedAt = now();
    this.addHistory(document, 'rejected', edit.title);
    return publicDocument(document);
  }

  history(id: string) {
    return this.getDocument(id).history;
  }

  async parseBrief(text: string, fileName?: string) {
    const { parseAssignment } = await import('../ai/flows/parse-assignment');
    return parseAssignment({ text, fileName });
  }

  insertMath(id: string, tex: string, display = false) {
    const document = this.getDocument(id);
    const safeTex = escapeHtml(tex.trim());
    if (!safeTex) throw new Error('tex is required');
    const node = display
      ? `<div class="studio-math-block" data-tex="${safeTex}" data-display="1">\\[${safeTex}\\]</div>`
      : `<span class="studio-math-inline" data-tex="${safeTex}" data-display="0">\\(${safeTex}\\)</span>`;
    return this.replaceContent(id, `${document.html}${node}`, 'inserted', display ? 'Inserted display equation' : 'Inserted inline equation');
  }

  insertTable(id: string, rows = 3, columns = 3) {
    const document = this.getDocument(id);
    const rowCount = Math.min(Math.max(Math.floor(rows), 1), 20);
    const columnCount = Math.min(Math.max(Math.floor(columns), 1), 12);
    const markup = Array.from({ length: rowCount }, (_, row) => {
      const cells = Array.from({ length: columnCount }, (_, column) => {
        const tag = row === 0 ? 'th' : 'td';
        const value = row === 0 ? `Column ${column + 1}` : '&nbsp;';
        return `<${tag} class="studio-${tag === 'th' ? 'th' : 'td'}">${value}</${tag}>`;
      }).join('');
      return `<tr>${cells}</tr>`;
    }).join('');
    return this.replaceContent(id, `${document.html}<table class="studio-table"><tbody>${markup}</tbody></table><p><br></p>`, 'inserted', `Inserted ${rowCount} × ${columnCount} table`);
  }

  private addHistory(document: StudioDocument, type: HistoryEntry['type'], label: string) {
    document.history.push({ id: uid('evt'), type, label, at: now() });
    if (document.history.length > 40) document.history.shift();
  }
}

export type ProposalInput = {
  documentId: string;
  title: string;
  summary: string;
  mode: PendingEdit['mode'];
  beforeHtml: string;
  afterHtml: string;
  selectionHint?: string;
};

export const docsWorkspace = new DocsStudioWorkspace();

export function createAssignmentContext(brief?: AssignmentBrief) {
  if (!brief) return '';
  return [
    `Title: ${brief.title}`,
    brief.course ? `Course: ${brief.course}` : '',
    brief.objectives.length ? `Objectives: ${brief.objectives.join('; ')}` : '',
    brief.tasks.length ? `Tasks: ${brief.tasks.map((task) => task.title).join('; ')}` : '',
    brief.constraints.length ? `Constraints: ${brief.constraints.join('; ')}` : '',
    brief.instructions ? `Instructions: ${brief.instructions.slice(0, 5000)}` : '',
  ]
    .filter(Boolean)
    .join('\n');
}

export async function readSse(response: Response) {
  if (!response.ok || !response.body) {
    throw new Error(`Docs Studio API request failed: ${response.status} ${response.statusText}`);
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  const events: any[] = [];
  let buffer = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const chunks = buffer.split(/\r?\n\r?\n/);
    buffer = chunks.pop() || '';
    for (const chunk of chunks) {
      const line = chunk.split(/\r?\n/).find((entry) => entry.startsWith('data:'));
      if (!line) continue;
      const payload = line.slice(5).trim();
      if (!payload || payload === '[DONE]') continue;
      try {
        events.push(JSON.parse(payload));
      } catch {
        // Ignore partial SSE frames; the API emits JSON per data frame.
      }
    }
  }
  return events;
}

export async function callDocsStudioApi(path: string, body: unknown) {
  const base = (process.env.DOCS_STUDIO_URL || 'http://localhost:9003').replace(/\/$/, '');
  return fetch(`${base}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export function stripMarkdownFences(value: string) {
  return value.trim().replace(/^```(?:html)?\s*/i, '').replace(/\s*```$/i, '').trim();
}
