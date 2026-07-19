/**
 * Multi-tenant document + chat storage.
 * - DynamoDB when AWS_REGION + DOCS_TABLE (and credentials) are set
 * - Local JSON files under .data/ for offline/dev (free, no AWS)
 */

import 'server-only';
import { promises as fs } from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import type { AssignmentBrief } from './assignment-types';
import { modelToHtml, type StudioDocumentModel } from './studio-document';

export type StoredHistoryEntry = {
  id: string;
  type: 'created' | 'drafted' | 'edited' | 'proposed' | 'accepted' | 'rejected' | 'inserted' | 'exported';
  label: string;
  at: string;
};

export type StoredPendingEdit = {
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

export type ChatTurn = {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  at: number;
};

export type DocumentVersion = {
  id: string;
  label: string;
  html: string;
  model?: StudioDocumentModel;
  title: string;
  createdAt: number;
  source: 'agent' | 'manual' | 'restore' | 'system';
  parentId?: string;
};

export type StudioDocument = {
  id: string;
  userId: string;
  title: string;
  html: string;
  /** Native document source of truth. `html` remains a renderer-compatible projection. */
  model?: StudioDocumentModel;
  paperSize: 'letter' | 'legal' | 'a4';
  /** Original OOXML source retained for the high-fidelity office editor. */
  sourceDocx?: { fileName: string; size: number; updatedAt: number };
  brief?: AssignmentBrief;
  history: StoredHistoryEntry[];
  pendingEdits: StoredPendingEdit[];
  preview?: string;
  createdAt: number;
  updatedAt: number;
  /** Monotonic revision used to reject stale autosaves from another tab/client. */
  revision: number;
  chat: ChatTurn[];
  versions: DocumentVersion[];
};

export class DocumentConflictError extends Error {
  code = 'DOCUMENT_CONFLICT' as const;
  constructor(public readonly latest: StudioDocument) {
    super('This document changed somewhere else. Reload the latest revision before saving again.');
  }
}

export type DocListItem = {
  id: string;
  title: string;
  preview: string;
  updatedAt: number;
  createdAt: number;
};

/**
 * Use DynamoDB when table + region are set.
 * Credentials: explicit keys, AWS profile, Lambda, OR EC2/ECS instance role
 * (default SDK chain — do NOT require AWS_ACCESS_KEY_ID on EC2).
 */
function useDynamo(): boolean {
  if (process.env.DOCS_USE_LOCAL === '1') return false;
  return Boolean(process.env.AWS_REGION && process.env.DOCS_TABLE);
}

function dataDir() {
  return process.env.DOCS_DATA_DIR || path.join(process.cwd(), '.data', 'docs');
}

async function ensureDir() {
  await fs.mkdir(dataDir(), { recursive: true });
}

function userIndexPath(userId: string) {
  return path.join(dataDir(), `${safe(userId)}.index.json`);
}

function docPath(userId: string, id: string) {
  return path.join(dataDir(), safe(userId), `${safe(id)}.json`);
}

function safe(s: string) {
  return s.replace(/[^a-zA-Z0-9@._-]+/g, '_').slice(0, 120);
}

function previewFromHtml(html: string): string {
  return (html || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 160);
}

// —— Local adapter ——
async function localList(userId: string): Promise<DocListItem[]> {
  await ensureDir();
  try {
    const raw = await fs.readFile(userIndexPath(userId), 'utf8');
    const items = JSON.parse(raw) as DocListItem[];
    return items.sort((a, b) => b.updatedAt - a.updatedAt);
  } catch {
    return [];
  }
}

async function localWriteIndex(userId: string, items: DocListItem[]) {
  await ensureDir();
  await fs.writeFile(userIndexPath(userId), JSON.stringify(items, null, 0), 'utf8');
}

async function localGet(userId: string, id: string): Promise<StudioDocument | null> {
  try {
    const raw = await fs.readFile(docPath(userId, id), 'utf8');
    return JSON.parse(raw) as StudioDocument;
  } catch {
    return null;
  }
}

async function localSave(doc: StudioDocument): Promise<StudioDocument> {
  await ensureDir();
  await fs.mkdir(path.join(dataDir(), safe(doc.userId)), { recursive: true });
  await fs.writeFile(docPath(doc.userId, doc.id), JSON.stringify(doc), 'utf8');
  const index = await localList(doc.userId);
  const item: DocListItem = {
    id: doc.id,
    title: doc.title,
    preview: doc.preview || previewFromHtml(doc.html),
    updatedAt: doc.updatedAt,
    createdAt: doc.createdAt,
  };
  const next = [item, ...index.filter((i) => i.id !== doc.id)].sort(
    (a, b) => b.updatedAt - a.updatedAt,
  );
  await localWriteIndex(doc.userId, next);
  return doc;
}

async function localDelete(userId: string, id: string): Promise<void> {
  try {
    await fs.unlink(docPath(userId, id));
  } catch {
    /* ignore */
  }
  const index = await localList(userId);
  await localWriteIndex(
    userId,
    index.filter((i) => i.id !== id),
  );
}

// —— DynamoDB adapter ——
async function dynamoClient() {
  const { DynamoDBClient } = await import('@aws-sdk/client-dynamodb');
  const { DynamoDBDocumentClient } = await import('@aws-sdk/lib-dynamodb');
  const client = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-1' });
  return DynamoDBDocumentClient.from(client, {
    marshallOptions: { removeUndefinedValues: true },
  });
}

function table() {
  return process.env.DOCS_TABLE || 'docs-studio';
}

async function dynamoList(userId: string): Promise<DocListItem[]> {
  const { QueryCommand } = await import('@aws-sdk/lib-dynamodb');
  const db = await dynamoClient();
  const res = await db.send(
    new QueryCommand({
      TableName: table(),
      KeyConditionExpression: 'pk = :pk AND begins_with(sk, :sk)',
      ExpressionAttributeValues: {
        ':pk': `USER#${userId}`,
        ':sk': 'DOC#',
      },
      ScanIndexForward: false,
    }),
  );
  return (res.Items || [])
    .map((it: Record<string, unknown>) => ({
      id: String(it.docId),
      title: String(it.title || 'Untitled'),
      preview: String(it.preview || ''),
      updatedAt: Number(it.updatedAt || 0),
      createdAt: Number(it.createdAt || 0),
    }))
    .sort((a: DocListItem, b: DocListItem) => b.updatedAt - a.updatedAt);
}

async function dynamoGet(userId: string, id: string): Promise<StudioDocument | null> {
  const { GetCommand } = await import('@aws-sdk/lib-dynamodb');
  const db = await dynamoClient();
  const res = await db.send(
    new GetCommand({
      TableName: table(),
      Key: { pk: `USER#${userId}`, sk: `DOC#${id}` },
    }),
  );
  if (!res.Item) return null;
  const it = res.Item;
  return {
    id: String(it.docId),
    userId: String(it.userId),
    title: String(it.title || 'Untitled'),
    html: String(it.html || ''),
    model: it.model as StudioDocumentModel | undefined,
    paperSize: it.paperSize === 'legal' || it.paperSize === 'a4' ? it.paperSize : 'letter',
    sourceDocx: it.sourceDocx as StudioDocument['sourceDocx'] | undefined,
    brief: it.brief as AssignmentBrief | undefined,
    history: Array.isArray(it.history) ? (it.history as StoredHistoryEntry[]) : [],
    pendingEdits: Array.isArray(it.pendingEdits) ? (it.pendingEdits as StoredPendingEdit[]) : [],
    preview: String(it.preview || ''),
    createdAt: Number(it.createdAt || 0),
    updatedAt: Number(it.updatedAt || 0),
    revision: Number(it.revision || 1),
    chat: Array.isArray(it.chat) ? (it.chat as ChatTurn[]) : [],
    versions: Array.isArray(it.versions) ? (it.versions as DocumentVersion[]) : [],
  };
}

async function dynamoSave(doc: StudioDocument, expectedRevision?: number): Promise<StudioDocument> {
  const { PutCommand } = await import('@aws-sdk/lib-dynamodb');
  const db = await dynamoClient();
  await db.send(
    new PutCommand({
      TableName: table(),
      ...(typeof expectedRevision === 'number'
        ? {
            ConditionExpression: 'revision = :expectedRevision',
            ExpressionAttributeValues: { ':expectedRevision': expectedRevision },
          }
        : {}),
      Item: {
        pk: `USER#${doc.userId}`,
        sk: `DOC#${doc.id}`,
        docId: doc.id,
        userId: doc.userId,
        title: doc.title,
        html: doc.html,
        model: doc.model,
        paperSize: doc.paperSize,
        sourceDocx: doc.sourceDocx,
        brief: doc.brief,
        history: doc.history || [],
        pendingEdits: doc.pendingEdits || [],
        preview: doc.preview || previewFromHtml(doc.html),
        createdAt: doc.createdAt,
        updatedAt: doc.updatedAt,
        revision: doc.revision,
        chat: doc.chat || [],
        versions: doc.versions || [],
        gsi1pk: 'DOC',
        gsi1sk: doc.updatedAt,
      },
    }),
  );
  return doc;
}

async function dynamoDelete(userId: string, id: string): Promise<void> {
  const { DeleteCommand } = await import('@aws-sdk/lib-dynamodb');
  const db = await dynamoClient();
  await db.send(
    new DeleteCommand({
      TableName: table(),
      Key: { pk: `USER#${userId}`, sk: `DOC#${id}` },
    }),
  );
}

// —— Public API ——
export async function listDocuments(userId: string): Promise<DocListItem[]> {
  if (useDynamo()) return dynamoList(userId);
  return localList(userId);
}

export async function getDocument(userId: string, id: string): Promise<StudioDocument | null> {
  if (useDynamo()) return dynamoGet(userId, id);
  return localGet(userId, id);
}

export async function createDocument(
  userId: string,
  opts?: { title?: string; html?: string; model?: StudioDocumentModel; paperSize?: 'letter' | 'legal' | 'a4'; brief?: AssignmentBrief },
): Promise<StudioDocument> {
  const now = Date.now();
  const model = opts?.model;
  const html = model ? modelToHtml(model) : opts?.html || '<p><br></p>';
  const doc: StudioDocument = {
    id: randomUUID(),
    userId,
    title: opts?.title || 'Untitled',
    html,
    model,
    paperSize: opts?.paperSize === 'legal' || opts?.paperSize === 'a4' ? opts.paperSize : 'letter',
    brief: opts?.brief,
    history: [],
    pendingEdits: [],
    preview: previewFromHtml(html),
    createdAt: now,
    updatedAt: now,
    revision: 1,
    chat: [],
    versions: [],
  };
  if (useDynamo()) return dynamoSave(doc);
  return localSave(doc);
}

export async function saveDocument(
  userId: string,
  id: string,
  patch: {
    title?: string;
    html?: string;
    model?: StudioDocumentModel;
    paperSize?: 'letter' | 'legal' | 'a4';
    sourceDocx?: StudioDocument['sourceDocx'];
    brief?: AssignmentBrief;
    history?: StoredHistoryEntry[];
    pendingEdits?: StoredPendingEdit[];
    chat?: ChatTurn[];
    versions?: DocumentVersion[];
  },
  expectedRevision?: number,
): Promise<StudioDocument | null> {
  const existing = await getDocument(userId, id);
  if (!existing) return null;
  if (typeof expectedRevision === 'number' && existing.revision !== expectedRevision) {
    throw new DocumentConflictError(existing);
  }
  const nextModel = patch.model ?? existing.model;
  const nextHtml = patch.model ? modelToHtml(patch.model) : patch.html ?? existing.html;
  const next: StudioDocument = {
    ...existing,
    title: patch.title ?? existing.title,
    html: nextHtml,
    model: nextModel,
    paperSize: patch.paperSize ?? existing.paperSize ?? 'letter',
    sourceDocx: patch.sourceDocx ?? existing.sourceDocx,
    brief: patch.brief ?? existing.brief,
    history: patch.history ?? existing.history ?? [],
    pendingEdits: patch.pendingEdits ?? existing.pendingEdits ?? [],
    chat: patch.chat ?? existing.chat,
    versions: patch.versions ?? existing.versions ?? [],
    updatedAt: Date.now(),
    revision: (existing.revision || 1) + 1,
  };
  next.preview = previewFromHtml(next.html);
  if (useDynamo()) {
    try {
      return await dynamoSave(next, existing.revision || 1);
    } catch (error: any) {
      if (error?.name === 'ConditionalCheckFailedException') {
        const latest = await getDocument(userId, id);
        if (latest) throw new DocumentConflictError(latest);
      }
      throw error;
    }
  }
  return localSave(next);
}

/**
 * Chat transcripts and immutable version snapshots are document metadata, not
 * canvas edits. They must not advance the revision used to reject stale HTML
 * autosaves, otherwise sending a chat message makes the next autosave look as
 * if another tab changed the document.
 */
async function saveDocumentMetadata(
  userId: string,
  id: string,
  patch: Pick<Partial<StudioDocument>, 'chat' | 'versions'>,
): Promise<StudioDocument | null> {
  const existing = await getDocument(userId, id);
  if (!existing) return null;
  const next: StudioDocument = {
    ...existing,
    chat: patch.chat ?? existing.chat,
    versions: patch.versions ?? existing.versions,
    updatedAt: Date.now(),
    // Intentionally preserve the content revision.
    revision: existing.revision,
  };
  if (useDynamo()) {
    try {
      return await dynamoSave(next, existing.revision);
    } catch (error: any) {
      if (error?.name === 'ConditionalCheckFailedException') {
        // Metadata is non-destructive; retry once against the latest document
        // so concurrent chat persistence does not drop a turn.
        const latest = await getDocument(userId, id);
        if (!latest) return null;
        return dynamoSave(
          {
            ...latest,
            chat: patch.chat ?? latest.chat,
            versions: patch.versions ?? latest.versions,
            updatedAt: Date.now(),
            revision: latest.revision,
          },
          latest.revision,
        );
      }
      throw error;
    }
  }
  return localSave(next);
}

export async function createVersion(
  userId: string,
  id: string,
  input: { label?: string; source?: DocumentVersion['source']; html?: string; model?: StudioDocumentModel },
): Promise<DocumentVersion | null> {
  const existing = await getDocument(userId, id);
  if (!existing) return null;
  const version: DocumentVersion = {
    id: randomUUID(),
    label: input.label || 'Cambio aceptado',
    html: input.html ?? existing.html,
    model: input.model ?? existing.model,
    title: existing.title,
    createdAt: Date.now(),
    source: input.source || 'agent',
    parentId: existing.versions?.[0]?.id,
  };
  await saveDocumentMetadata(userId, id, {
    versions: [version, ...(existing.versions || [])].slice(0, 100),
  });
  return version;
}

export async function listVersions(userId: string, id: string): Promise<DocumentVersion[]> {
  const doc = await getDocument(userId, id);
  return doc?.versions || [];
}

export async function restoreVersion(userId: string, id: string, versionId: string): Promise<StudioDocument | null> {
  const doc = await getDocument(userId, id);
  const version = doc?.versions?.find((item) => item.id === versionId);
  if (!doc || !version) return null;
  const restored = await saveDocument(userId, id, { html: version.html, model: version.model });
  if (!restored) return null;
  await createVersion(userId, id, { label: `Restaurado: ${version.label}`, source: 'restore', html: version.html, model: version.model });
  return getDocument(userId, id);
}

export async function deleteDocument(userId: string, id: string): Promise<void> {
  if (useDynamo()) return dynamoDelete(userId, id);
  return localDelete(userId, id);
}

export async function appendChat(
  userId: string,
  id: string,
  turns: ChatTurn[],
): Promise<StudioDocument | null> {
  const existing = await getDocument(userId, id);
  if (!existing) return null;
  return saveDocumentMetadata(userId, id, {
    chat: [...(existing.chat || []), ...turns].slice(-200),
  });
}

export function storageBackend(): 'dynamodb' | 'local' {
  return useDynamo() ? 'dynamodb' : 'local';
}
