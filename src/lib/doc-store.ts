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

export type StudioDocument = {
  id: string;
  userId: string;
  title: string;
  html: string;
  paperSize: 'letter' | 'legal';
  brief?: AssignmentBrief;
  history: StoredHistoryEntry[];
  pendingEdits: StoredPendingEdit[];
  preview?: string;
  createdAt: number;
  updatedAt: number;
  chat: ChatTurn[];
};

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
    paperSize: it.paperSize === 'legal' ? 'legal' : 'letter',
    brief: it.brief as AssignmentBrief | undefined,
    history: Array.isArray(it.history) ? (it.history as StoredHistoryEntry[]) : [],
    pendingEdits: Array.isArray(it.pendingEdits) ? (it.pendingEdits as StoredPendingEdit[]) : [],
    preview: String(it.preview || ''),
    createdAt: Number(it.createdAt || 0),
    updatedAt: Number(it.updatedAt || 0),
    chat: Array.isArray(it.chat) ? (it.chat as ChatTurn[]) : [],
  };
}

async function dynamoSave(doc: StudioDocument): Promise<StudioDocument> {
  const { PutCommand } = await import('@aws-sdk/lib-dynamodb');
  const db = await dynamoClient();
  await db.send(
    new PutCommand({
      TableName: table(),
      Item: {
        pk: `USER#${doc.userId}`,
        sk: `DOC#${doc.id}`,
        docId: doc.id,
        userId: doc.userId,
        title: doc.title,
        html: doc.html,
        paperSize: doc.paperSize,
        brief: doc.brief,
        history: doc.history || [],
        pendingEdits: doc.pendingEdits || [],
        preview: doc.preview || previewFromHtml(doc.html),
        createdAt: doc.createdAt,
        updatedAt: doc.updatedAt,
        chat: doc.chat || [],
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
  opts?: { title?: string; html?: string; paperSize?: 'letter' | 'legal'; brief?: AssignmentBrief },
): Promise<StudioDocument> {
  const now = Date.now();
  const doc: StudioDocument = {
    id: randomUUID(),
    userId,
    title: opts?.title || 'Untitled',
    html: opts?.html || '<p><br></p>',
    paperSize: opts?.paperSize === 'legal' ? 'legal' : 'letter',
    brief: opts?.brief,
    history: [],
    pendingEdits: [],
    preview: previewFromHtml(opts?.html || ''),
    createdAt: now,
    updatedAt: now,
    chat: [],
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
    paperSize?: 'letter' | 'legal';
    brief?: AssignmentBrief;
    history?: StoredHistoryEntry[];
    pendingEdits?: StoredPendingEdit[];
    chat?: ChatTurn[];
  },
): Promise<StudioDocument | null> {
  const existing = await getDocument(userId, id);
  if (!existing) return null;
  const next: StudioDocument = {
    ...existing,
    title: patch.title ?? existing.title,
    html: patch.html ?? existing.html,
    paperSize: patch.paperSize ?? existing.paperSize ?? 'letter',
    brief: patch.brief ?? existing.brief,
    history: patch.history ?? existing.history ?? [],
    pendingEdits: patch.pendingEdits ?? existing.pendingEdits ?? [],
    chat: patch.chat ?? existing.chat,
    updatedAt: Date.now(),
  };
  next.preview = previewFromHtml(next.html);
  if (useDynamo()) return dynamoSave(next);
  return localSave(next);
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
  return saveDocument(userId, id, {
    chat: [...(existing.chat || []), ...turns].slice(-200),
  });
}

export function storageBackend(): 'dynamodb' | 'local' {
  return useDynamo() ? 'dynamodb' : 'local';
}
