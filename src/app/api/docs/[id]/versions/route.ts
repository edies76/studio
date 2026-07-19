import { NextResponse } from 'next/server';
import { createVersion, listVersions, restoreVersion } from '@/lib/doc-store';
import { requireUserId } from '@/lib/auth';

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  const { userId } = await requireUserId();
  const { id } = await params;
  return NextResponse.json({ versions: await listVersions(userId, id) });
}

export async function POST(request: Request, { params }: Params) {
  const { userId } = await requireUserId();
  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) as { label?: string; source?: 'agent' | 'manual' | 'restore' | 'system'; html?: string };
  const version = await createVersion(userId, id, body);
  return version ? NextResponse.json({ version }) : NextResponse.json({ error: 'Document not found' }, { status: 404 });
}

export async function PUT(request: Request, { params }: Params) {
  const { userId } = await requireUserId();
  const { id } = await params;
  const body = (await request.json()) as { versionId?: string };
  if (!body.versionId) return NextResponse.json({ error: 'versionId is required' }, { status: 400 });
  const doc = await restoreVersion(userId, id, body.versionId);
  return doc ? NextResponse.json({ doc }) : NextResponse.json({ error: 'Version not found' }, { status: 404 });
}
