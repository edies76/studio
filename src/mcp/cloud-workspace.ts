import type { AssignmentBrief } from '@/lib/assignment-types';
import {
  createDocument as createStoredDocument,
  deleteDocument as deleteStoredDocument,
  getDocument as getStoredDocument,
  listDocuments as listStoredDocuments,
  saveDocument as saveStoredDocument,
  type StudioDocument,
  type StoredHistoryEntry,
  type StoredPendingEdit,
} from '@/lib/doc-store';
import { extractDocumentBlocks } from './core';
import { sanitizeDocumentHtml } from '@/lib/math-html';

export type CloudDocumentInput = {
  title?: string;
  html?: string;
  paperSize?: 'letter' | 'legal';
  brief?: AssignmentBrief;
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
      .replace(/<br\s*\/?\s*>/gi, '\n')
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

function normalize(document: StudioDocument): StudioDocument {
  document.paperSize = document.paperSize === 'legal' ? 'legal' : 'letter';
  document.history = Array.isArray(document.history) ? document.history : [];
  document.pendingEdits = Array.isArray(document.pendingEdits) ? document.pendingEdits : [];
  return document;
}

export function publicCloudDocument(document: StudioDocument) {
  const doc = normalize(document);
  const text = plainText(doc.html);
  return {
    id: doc.id,
    title: doc.title,
    paperSize: doc.paperSize,
    html: doc.html,
    text,
    wordCount: text.split(/\s+/).filter(Boolean).length,
    blocks: extractDocumentBlocks(doc.html).map(({ index, tag, preview }) => ({ index, tag, preview })),
    pendingEdits: doc.pendingEdits.filter((edit) => edit.status === 'pending'),
    createdAt: new Date(doc.createdAt).toISOString(),
    updatedAt: new Date(doc.updatedAt).toISOString(),
    brief: doc.brief
      ? {
          title: doc.brief.title,
          course: doc.brief.course,
          objectives: doc.brief.objectives,
          instructions: doc.brief.instructions,
          tasks: doc.brief.tasks,
          constraints: doc.brief.constraints,
          learningOutcome: doc.brief.learningOutcome,
          rubric: doc.brief.rubric,
        }
      : undefined,
  };
}

export class CloudDocsStudioWorkspace {
  constructor(private readonly userId: string) {}

  async createDocument(input: CloudDocumentInput = {}) {
    const doc = await createStoredDocument(this.userId, {
      title: input.title,
      html: sanitizeDocumentHtml(input.html || '<p><br></p>'),
      paperSize: input.paperSize,
      brief: input.brief,
    });
    this.addHistory(doc, 'created', 'Created document');
    return publicCloudDocument(await this.save(doc));
  }

  async listDocuments() {
    return listStoredDocuments(this.userId);
  }

  async deleteDocument(id: string) {
    await this.getDocument(id);
    await deleteStoredDocument(this.userId, id);
    return { id, deleted: true };
  }

  async getDocument(id: string) {
    const document = await getStoredDocument(this.userId, id);
    if (!document) throw new Error(`Document not found: ${id}`);
    return normalize(document);
  }

  async readDocument(id: string) {
    return publicCloudDocument(await this.getDocument(id));
  }

  async setBrief(id: string, brief: AssignmentBrief) {
    const document = await this.getDocument(id);
    document.brief = brief;
    document.updatedAt = Date.now();
    this.addHistory(document, 'edited', `Attached brief: ${brief.title}`);
    return publicCloudDocument(await this.save(document));
  }

  async replaceContent(id: string, html: string, type: StoredHistoryEntry['type'], label: string) {
    const document = await this.getDocument(id);
    document.html = sanitizeDocumentHtml(html);
    document.updatedAt = Date.now();
    this.addHistory(document, type, label);
    return publicCloudDocument(await this.save(document));
  }

  async updateTitle(id: string, title: string) {
    const document = await this.getDocument(id);
    const nextTitle = title.trim().slice(0, 160);
    if (!nextTitle) throw new Error('title is required');
    document.title = nextTitle;
    document.updatedAt = Date.now();
    this.addHistory(document, 'edited', `Renamed document to ${nextTitle}`);
    return publicCloudDocument(await this.save(document));
  }

  async setPaperSize(id: string, paperSize: 'letter' | 'legal') {
    const document = await this.getDocument(id);
    document.paperSize = paperSize === 'legal' ? 'legal' : 'letter';
    document.updatedAt = Date.now();
    this.addHistory(document, 'edited', `Set paper size to ${document.paperSize}`);
    return publicCloudDocument(await this.save(document));
  }

  async proposeEdit(input: {
    documentId: string;
    title: string;
    summary: string;
    mode: StoredPendingEdit['mode'];
    beforeHtml: string;
    afterHtml: string;
    selectionHint?: string;
  }) {
    const document = await this.getDocument(input.documentId);
    const edit: StoredPendingEdit = {
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
    document.pendingEdits.push(edit);
    document.updatedAt = Date.now();
    this.addHistory(document, 'proposed', `${edit.title} · pending review`);
    await this.save(document);
    return edit;
  }

  async acceptEdit(documentId: string, editId: string) {
    const document = await this.getDocument(documentId);
    const edit = document.pendingEdits.find((candidate) => candidate.id === editId);
    if (!edit || edit.status !== 'pending') throw new Error(`Pending edit not found: ${editId}`);

    if (edit.mode === 'replace_document') {
      if (edit.beforeHtml && document.html !== edit.beforeHtml) {
        throw new Error('Document changed since this proposal. Read it again and create a fresh proposal.');
      }
      document.html = edit.afterHtml;
    } else {
      const current = edit.beforeHtml || document.html;
      const position = document.html.indexOf(current);
      if (position < 0) throw new Error('The proposed selection is no longer present in the document.');
      document.html = `${document.html.slice(0, position)}${edit.afterHtml}${document.html.slice(position + current.length)}`;
    }
    edit.status = 'accepted';
    document.updatedAt = Date.now();
    this.addHistory(document, 'accepted', edit.title);
    return publicCloudDocument(await this.save(document));
  }

  async rejectEdit(documentId: string, editId: string) {
    const document = await this.getDocument(documentId);
    const edit = document.pendingEdits.find((candidate) => candidate.id === editId);
    if (!edit || edit.status !== 'pending') throw new Error(`Pending edit not found: ${editId}`);
    edit.status = 'rejected';
    document.updatedAt = Date.now();
    this.addHistory(document, 'rejected', edit.title);
    return publicCloudDocument(await this.save(document));
  }

  async insertMath(id: string, tex: string, display = false) {
    const safeTex = escapeHtml(tex.trim());
    if (!safeTex) throw new Error('tex is required');
    const document = await this.getDocument(id);
    const node = display
      ? `<div class="studio-math-block" data-tex="${safeTex}" data-display="1">\\[${safeTex}\\]</div>`
      : `<span class="studio-math-inline" data-tex="${safeTex}" data-display="0">\\(${safeTex}\\)</span>`;
    return this.replaceContent(id, `${document.html}${node}`, 'inserted', display ? 'Inserted display equation' : 'Inserted inline equation');
  }

  async insertTable(id: string, rows = 3, columns = 3) {
    const document = await this.getDocument(id);
    const rowCount = Math.min(Math.max(Math.floor(rows), 1), 20);
    const columnCount = Math.min(Math.max(Math.floor(columns), 1), 12);
    const markup = Array.from({ length: rowCount }, (_, row) => {
      const cells = Array.from({ length: columnCount }, (_, column) => {
        const tag = row === 0 ? 'th' : 'td';
        const value = row === 0 ? `Column ${column + 1}` : '&nbsp;';
        return `<${tag} class="studio-${tag}">${value}</${tag}>`;
      }).join('');
      return `<tr>${cells}</tr>`;
    }).join('');
    return this.replaceContent(
      id,
      `${document.html}<table class="studio-table"><tbody>${markup}</tbody></table><p><br></p>`,
      'inserted',
      `Inserted ${rowCount} × ${columnCount} table`,
    );
  }

  async insertImage(id: string, input: { src: string; alt?: string; width?: number; wrap?: string; left?: number; top?: number }) {
    const source = input.src.trim();
    if (!/^(https?:\/\/|data:image\/)/i.test(source)) {
      throw new Error('src must be an https URL or a data:image URL');
    }
    const width = Math.min(Math.max(Number(input.width) || 640, 40), 2400);
    const wrap = ['inline', 'left', 'right', 'center', 'break', 'behind'].includes(input.wrap || '') ? input.wrap : 'break';
    const alignment = wrap === 'center' ? 'margin:0.85em auto' : wrap === 'left' ? 'margin:0.25em 1.1em 0.6em 0' : wrap === 'right' ? 'margin:0.25em 0 0.6em 1.1em' : wrap === 'inline' ? 'margin:0 0.3em' : 'margin:0.85em 0';
    const position = wrap === 'behind'
      ? `position:absolute;left:${Math.max(0, Number(input.left) || 0)}px;top:${Math.max(0, Number(input.top) || 0)}px;z-index:0;margin:0`
      : '';
    const image = `<img src="${escapeHtml(source)}" alt="${escapeHtml(input.alt || 'Inserted image')}" data-studio-image="1" data-studio-wrap="${wrap}" style="width:${width}px;max-width:100%;height:auto;display:${wrap === 'inline' ? 'inline-block' : 'block'};${alignment};${position}">`;
    const document = await this.getDocument(id);
    return this.replaceContent(id, `${document.html}<p>${image}</p><p><br></p>`, 'inserted', `Inserted image · ${wrap}`);
  }

  async insertPageBreak(id: string) {
    const document = await this.getDocument(id);
    return this.replaceContent(id, `${document.html}<div data-studio-break="1" style="break-before:page;page-break-before:always"></div><p><br></p>`, 'inserted', 'Inserted page break');
  }

  async history(id: string) {
    return (await this.getDocument(id)).history;
  }

  async parseBrief(text: string, fileName?: string) {
    const { parseAssignment } = await import('@/ai/flows/parse-assignment');
    return parseAssignment({ text, fileName });
  }

  private addHistory(document: StudioDocument, type: StoredHistoryEntry['type'], label: string) {
    document.history.push({ id: uid('evt'), type, label, at: now() });
    if (document.history.length > 40) document.history.shift();
  }

  private async save(document: StudioDocument) {
    const saved = await saveStoredDocument(this.userId, document.id, {
      title: document.title,
      html: document.html,
      paperSize: document.paperSize,
      brief: document.brief,
      history: document.history,
      pendingEdits: document.pendingEdits,
      chat: document.chat,
    });
    if (!saved) throw new Error(`Document not found: ${document.id}`);
    return normalize(saved);
  }
}
