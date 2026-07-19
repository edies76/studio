import 'server-only';

import { createHash, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';

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
  if (!hasDynamo()) throw new Error('MCP credentials require DynamoDB in the hosted workspace.');
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
  if (!hasDynamo() || !token.startsWith('dsm_')) return null;
  const db = await client();
  const { GetCommand, PutCommand } = await import('@aws-sdk/lib-dynamodb');
  const tokenHash = hash(token);
  const result = await db.send(new GetCommand({ TableName: table(), Key: { pk: `MCP_TOKEN#${tokenHash}`, sk: 'KEY' } }));
  const item = result.Item as Record<string, unknown> | undefined;
  if (!item) return null;
  if (!timingSafeEqual(Buffer.from(tokenHash), Buffer.from(String(item.pk || '').replace('MCP_TOKEN#', '')))) return null;
  const principal = { id: String(item.id), userId: String(item.userId), label: String(item.label || 'External agent'), permissions: 'all' as const };
  void db.send(new PutCommand({ TableName: table(), Item: { ...item, lastUsedAt: Date.now() } }));
  return principal;
}
