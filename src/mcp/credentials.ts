import 'server-only';

import { createHash, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';

export type StoredMcpPrincipal = {
  id: string;
  userId: string;
  label: string;
  permissions: 'all';
};

type CredentialRecord = StoredMcpPrincipal & {
  tokenHash: string;
  createdAt: number;
  lastUsedAt?: number;
  revokedAt?: number;
};

function table() {
  return process.env.DOCS_TABLE || 'docs-studio';
}

function hasDynamo() {
  return process.env.DOCS_USE_LOCAL !== '1' && Boolean(process.env.AWS_REGION && process.env.DOCS_TABLE);
}

export function localMcpEnabled() {
  // Local development is self-contained; a production process must opt in
  // explicitly and otherwise never fall back to a filesystem workspace.
  return !hasDynamo() && (process.env.MCP_ALLOW_LOCAL === '1' || process.env.NODE_ENV !== 'production');
}

function localCredentialPath() {
  return path.join(process.env.DOCS_DATA_DIR || path.join(process.cwd(), '.data', 'docs'), 'mcp-credentials.json');
}

async function readLocalCredentials(): Promise<CredentialRecord[]> {
  try { return JSON.parse(await fs.readFile(localCredentialPath(), 'utf8')) as CredentialRecord[]; } catch { return []; }
}

async function writeLocalCredentials(records: CredentialRecord[]) {
  const target = localCredentialPath();
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, JSON.stringify(records), 'utf8');
}

function hash(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

async function client() {
  const { DynamoDBClient } = await import('@aws-sdk/client-dynamodb');
  const { DynamoDBDocumentClient } = await import('@aws-sdk/lib-dynamodb');
  return DynamoDBDocumentClient.from(new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-1' }), {
    marshallOptions: { removeUndefinedValues: true },
  });
}

/** Creates a full-access credential. The raw token is returned only once. */
export async function createMcpCredential(userId: string, label = 'External agent') {
  if (!hasDynamo() && !localMcpEnabled()) throw new Error('Set MCP_ALLOW_LOCAL=1 to create a local development credential.');
  const id = randomUUID();
  const token = `dsm_${randomBytes(32).toString('base64url')}`;
  const record: CredentialRecord = {
    id,
    userId,
    label: label.trim().slice(0, 80) || 'External agent',
    permissions: 'all',
    tokenHash: hash(token),
    createdAt: Date.now(),
  };
  if (localMcpEnabled()) {
    const records = await readLocalCredentials();
    records.push(record);
    await writeLocalCredentials(records);
    return { ...record, token };
  }
  const db = await client();
  const { PutCommand } = await import('@aws-sdk/lib-dynamodb');
  await db.send(new PutCommand({
    TableName: table(),
    Item: { pk: `USER#${userId}`, sk: `MCP_KEY#${id}`, entity: 'MCP_KEY', ...record },
  }));
  await db.send(new PutCommand({
    TableName: table(),
    Item: { pk: `MCP_TOKEN#${record.tokenHash}`, sk: 'KEY', entity: 'MCP_TOKEN', id, userId, label: record.label, permissions: 'all', createdAt: record.createdAt },
  }));
  return { ...record, token };
}

export async function listMcpCredentials(userId: string) {
  if (localMcpEnabled()) {
    return (await readLocalCredentials()).filter((item) => item.userId === userId).map(({ tokenHash: _tokenHash, ...item }) => item).sort((a, b) => b.createdAt - a.createdAt);
  }
  if (!hasDynamo()) return [] as Array<Omit<CredentialRecord, 'tokenHash'>>;
  const db = await client();
  const { QueryCommand } = await import('@aws-sdk/lib-dynamodb');
  const result = await db.send(new QueryCommand({
    TableName: table(),
    KeyConditionExpression: 'pk = :pk AND begins_with(sk, :prefix)',
    ExpressionAttributeValues: { ':pk': `USER#${userId}`, ':prefix': 'MCP_KEY#' },
  }));
  return (result.Items || []).map((item: Record<string, unknown>) => ({
    id: String(item.id), userId: String(item.userId), label: String(item.label || 'External agent'),
    permissions: 'all' as const, createdAt: Number(item.createdAt || 0),
    lastUsedAt: item.lastUsedAt ? Number(item.lastUsedAt) : undefined,
    revokedAt: item.revokedAt ? Number(item.revokedAt) : undefined,
  })).sort((a: { createdAt: number }, b: { createdAt: number }) => b.createdAt - a.createdAt);
}

export async function revokeMcpCredential(userId: string, id: string) {
  if (localMcpEnabled()) {
    const records = await readLocalCredentials();
    const record = records.find((item) => item.userId === userId && item.id === id);
    if (!record) throw new Error('Credential not found.');
    record.revokedAt = Date.now();
    await writeLocalCredentials(records);
    return;
  }
  if (!hasDynamo()) throw new Error('MCP credentials require DynamoDB in the hosted workspace.');
  const db = await client();
  const { GetCommand, PutCommand, DeleteCommand } = await import('@aws-sdk/lib-dynamodb');
  const existing = await db.send(new GetCommand({ TableName: table(), Key: { pk: `USER#${userId}`, sk: `MCP_KEY#${id}` } }));
  if (!existing.Item) throw new Error('Credential not found.');
  const record = existing.Item as CredentialRecord;
  await db.send(new PutCommand({ TableName: table(), Item: { ...record, revokedAt: Date.now() } }));
  await db.send(new DeleteCommand({ TableName: table(), Key: { pk: `MCP_TOKEN#${record.tokenHash}`, sk: 'KEY' } }));
}

export async function authenticateStoredMcpToken(token: string): Promise<StoredMcpPrincipal | null> {
  if (!token.startsWith('dsm_')) return null;
  const tokenHash = hash(token);
  if (localMcpEnabled()) {
    const records = await readLocalCredentials();
    const record = records.find((item) => !item.revokedAt && item.tokenHash === tokenHash);
    if (!record || !timingSafeEqual(Buffer.from(tokenHash), Buffer.from(record.tokenHash))) return null;
    record.lastUsedAt = Date.now();
    await writeLocalCredentials(records);
    return { id: record.id, userId: record.userId, label: record.label, permissions: 'all' };
  }
  if (!hasDynamo()) return null;
  const db = await client();
  const { GetCommand, PutCommand } = await import('@aws-sdk/lib-dynamodb');
  const result = await db.send(new GetCommand({ TableName: table(), Key: { pk: `MCP_TOKEN#${tokenHash}`, sk: 'KEY' } }));
  const item = result.Item as Record<string, unknown> | undefined;
  if (!item) return null;
  if (!timingSafeEqual(Buffer.from(tokenHash), Buffer.from(String(item.pk || '').replace('MCP_TOKEN#', '')))) return null;
  const principal = { id: String(item.id), userId: String(item.userId), label: String(item.label || 'External agent'), permissions: 'all' as const };
  void db.send(new PutCommand({ TableName: table(), Item: { ...item, lastUsedAt: Date.now() } }));
  return principal;
}
