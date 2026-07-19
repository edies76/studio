import 'server-only';

import { createHmac, timingSafeEqual } from 'crypto';

type Payload = { userId: string; documentId: string; expiresAt: number };

function secret() {
  return process.env.DOCS_SOURCE_SECRET || process.env.AUTH_SECRET || '';
}

export function issueOfficeToken(userId: string, documentId: string) {
  const key = secret();
  if (!key) throw new Error('DOCS_SOURCE_SECRET is required for OnlyOffice mode.');
  const payload: Payload = { userId, documentId, expiresAt: Date.now() + 1000 * 60 * 60 };
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = createHmac('sha256', key).update(encoded).digest('base64url');
  return `${encoded}.${signature}`;
}

export function verifyOfficeToken(token: string | null): Payload | null {
  const key = secret();
  if (!key || !token) return null;
  const [encoded, signature] = token.split('.');
  if (!encoded || !signature) return null;
  const expected = createHmac('sha256', key).update(encoded).digest('base64url');
  const a = Buffer.from(signature); const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as Payload;
    return payload.expiresAt > Date.now() ? payload : null;
  } catch {
    return null;
  }
}
