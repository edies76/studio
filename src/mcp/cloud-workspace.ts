import type { AssignmentBrief, DeliveryAgentUpdate, DeliverySnapshot } from '@/lib/assignment-types';
import {
  createDocument as createStoredDocument,
  deleteDocument as deleteStoredDocument,
  getDocument as getStoredDocument,
  listDocuments as listStoredDocuments,
  saveDocument as saveStoredDocument,
  createVersion as createStoredVersion,
  listVersions as listStoredVersions,
  restoreVersion as restoreStoredVersion,
  type StudioDocument,
  type StoredHistoryEntry,
  type StoredPendingEdit,
} from '@/lib/doc-store';
import { extractDocumentBlocks } from './core';
import { replaceFragmentInDocumentHtml } from '@/lib/doc-tools';
import { sanitizeDocumentHtml } from '@/lib/math-html';
import { replaceTableCell } from '@/lib/table-tools';
import { reviewAssignment } from '@/lib/assignment-review';

export type CloudDocumentInput = {
  title?: string;
  html?: string;
  paperSize?: 'letter' | 'legal' | 'a4';
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
  document.paperSize = document.paperSize === 'legal' || document.paperSize === 'a4' ? document.paperSize : 'letter';
  document.history = Array.isArray(document.history) ? document.history : [];
  document.pendingEdits = Array.isArray(document.pendingEdits) ? document.pendingEdits : [];
  document.versions = Array.isArray(document.versions) ? document.versions : [];
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
    versionCount: doc.versions.length,
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
    delivery: doc.delivery,
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

  async findInDocument(id: string, query: string, maxResults = 20) {
    const document = await this.getDocument(id);
    const needle = query.trim().toLowerCase();
    if (!needle) throw new Error('query is required');
    return extractDocumentBlocks(document.html)
      .filter((block) => `${block.tag} ${block.preview}`.toLowerCase().includes(needle))
      .slice(0, Math.min(Math.max(maxResults, 1), 100));
  }

  async checkDocument(id: string) {
    const document = await this.getDocument(id);
    const blocks = extractDocumentBlocks(document.html);
    const issues: { code: string; severity: 'error' | 'warning'; message: string }[] = [];
    if (!plainText(document.html)) issues.push({ code: 'empty', severity: 'error', message: 'The document has no readable text.' });
    if (!/<h1\b/i.test(document.html)) issues.push({ code: 'missing_h1', severity: 'warning', message: 'No h1 heading was found.' });
    if (/<img\b/i.test(document.html) && /<img\b(?![^>]*\balt\s*=)/i.test(document.html)) {
      issues.push({ code: 'image_alt', severity: 'warning', message: 'At least one image is missing alt text.' });
    }
    if (/<table\b/i.test(document.html) && !/<th\b/i.test(document.html)) {
      issues.push({ code: 'table_header', severity: 'warning', message: 'A table has no header cells.' });
    }
    if (document.pendingEdits.some((edit) => edit.status === 'pending')) {
      issues.push({ code: 'pending_edits', severity: 'warning', message: 'There are proposals waiting for review.' });
    }
    return {
      documentId: document.id,
      title: document.title,
      ok: !issues.some((issue) => issue.severity === 'error'),
      wordCount: plainText(document.html).split(/\s+/).filter(Boolean).length,
      blockCount: blocks.length,
      pendingEditCount: document.pendingEdits.filter((edit) => edit.status === 'pending').length,
      issues,
    };
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
    document.delivery = undefined;
    document.updatedAt = Date.now();
    this.addHistory(document, 'edited', `Attached brief: ${brief.title}`);
    return publicCloudDocument(await this.save(document));
  }

  async reviewDelivery(id: string, refresh = true) {
    const document = await this.getDocument(id);
    const review = reviewAssignment(document.brief, document.html, document.model, document.revision);
    if (!review) return null;
    if (!refresh) return review.snapshot;
    document.delivery = review.snapshot;
    const saved = await this.save(document);
    return saved.delivery || review.snapshot;
  }

  async updateDelivery(id: string, update: DeliveryAgentUpdate) {
    const document = await this.getDocument(id);
    const review = reviewAssignment(document.brief, document.html, document.model, document.revision);
    if (!review) throw new Error('No assignment brief is attached to this document.');
    const valid = new Map(review.snapshot.requirements.map((item) => [item.id, item]));
    const items = update.items.slice(0, 16).flatMap((item) => {
      const requirement = valid.get(item.id);
      if (!requirement) return [];
      const status = item.status === 'done' && !requirement.covered ? 'needs_review' : item.status;
      return [{ ...item, status }];
    });
    review.snapshot.lastAgentUpdate = { summary: update.summary.slice(0, 480), items, at: update.at || Date.now() };
    document.delivery = review.snapshot;
    const saved = await this.save(document);
    return saved.delivery || review.snapshot;
  }

  async submissionCheck(id: string) {
    const document = await this.getDocument(id);
    const review = reviewAssignment(document.brief, document.html, document.model, document.revision);
    const pendingEdits = document.pendingEdits.filter((edit) => edit.status === 'pending').length;
    const blockers = [...(review?.blockers || [])];
    const warnings = [...(review?.warnings || [])];
    if (!plainText(document.html)) blockers.push('The document has no readable text.');
    if (pendingEdits) warnings.push(`${pendingEdits} proposal(s) still need review.`);
    return { status: blockers.length ? 'not_ready' : warnings.length || review?.readiness === 'warnings' ? 'warnings' : review ? 'ready' : 'not_ready', blockers, warnings, coveragePercent: review?.coveragePercent || 0, review };
  }

  async replaceContent(id: string, html: string, type: StoredHistoryEntry['type'], label: string) {
    const document = await this.getDocument(id);
    document.html = sanitizeDocumentHtml(html);
    document.updatedAt = Date.now();
    this.addHistory(document, type, label);
    const saved = await this.save(document);
    await createStoredVersion(this.userId, id, { label, source: type === 'accepted' ? 'agent' : 'manual', html: saved.html });
    return publicCloudDocument(await this.getDocument(id));
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

  async setPaperSize(id: string, paperSize: 'letter' | 'legal' | 'a4') {
    const document = await this.getDocument(id);
    document.paperSize = paperSize === 'legal' || paperSize === 'a4' ? paperSize : 'letter';
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

  async proposeBlockEdit(input: {
    documentId: string;
    blockIndex: number;
    title: string;
    summary: string;
    afterHtml: string;
  }) {
    const document = await this.getDocument(input.documentId);
    const blocks = extractDocumentBlocks(document.html);
    const block = blocks[input.blockIndex];
    if (!block) throw new Error(`blockIndex ${input.blockIndex} is out of range (0..${Math.max(0, blocks.length - 1)})`);
    const afterHtml = sanitizeDocumentHtml(input.afterHtml);
    const replacement = extractDocumentBlocks(afterHtml);
    if (replacement.length !== 1 || replacement[0].tag !== block.tag) {
      throw new Error(`Replacement must contain exactly one <${block.tag}> block.`);
    }
    return this.proposeEdit({
      documentId: input.documentId,
      title: input.title,
      summary: input.summary,
      mode: 'replace_block',
      beforeHtml: block.html,
      afterHtml,
      selectionHint: block.preview,
    });
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
      const spliced = replaceFragmentInDocumentHtml(document.html, {
        afterHtml: edit.afterHtml,
        beforeHtml: edit.beforeHtml,
        selectionHint: edit.selectionHint,
      });
      if (!spliced) throw new Error('The proposed selection is no longer present in the document.');
      document.html = spliced;
    }
    edit.status = 'accepted';
    document.updatedAt = Date.now();
    this.addHistory(document, 'accepted', edit.title);
    const saved = await this.save(document);
    await createStoredVersion(this.userId, documentId, { label: edit.title, source: 'agent', html: saved.html });
    return publicCloudDocument(await this.getDocument(documentId));
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

  async editTableCell(id: string, input: { tableIndex: number; rowIndex: number; columnIndex: number; content: string }) {
    const document = await this.getDocument(id);
    const changed = replaceTableCell(document.html, input);
    if (!changed) throw new Error('tableIndex, rowIndex or columnIndex is out of range');
    return this.replaceContent(id, changed.html, 'edited', `Edited table ${input.tableIndex + 1}, cell ${input.rowIndex + 1}:${input.columnIndex + 1}`);
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

  async insertHtml(id: string, html: string) {
    const fragment = sanitizeDocumentHtml(html.trim());
    if (!fragment) throw new Error('html is required');
    const document = await this.getDocument(id);
    return this.replaceContent(id, `${document.html}${fragment}`, 'inserted', 'Inserted HTML fragment');
  }

  async history(id: string) {
    return (await this.getDocument(id)).history;
  }

  async versions(id: string) {
    return listStoredVersions(this.userId, id);
  }

  async restoreVersion(id: string, versionId: string) {
    const restored = await restoreStoredVersion(this.userId, id, versionId);
    if (!restored) throw new Error(`Version not found: ${versionId}`);
    return publicCloudDocument(restored);
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
      delivery: document.delivery,
      history: document.history,
      pendingEdits: document.pendingEdits,
      chat: document.chat,
    });
    if (!saved) throw new Error(`Document not found: ${document.id}`);
    return normalize(saved);
  }
}
