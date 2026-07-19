import { NextResponse } from 'next/server';
import { createVersion, listVersions, restoreVersion } from '@/lib/doc-store';
import { requireUserId } from '@/lib/auth';
import type { StudioDocumentModel } from '@/lib/studio-document';

type Params = { params: Promise<{ id: string }> };

function authError(error: unknown) {
  return error instanceof Error && (error.message === 'UNAUTHORIZED' || error.message === 'GUEST_ID_MISSING');
}

export async function GET(_request: Request, { params }: Params) {
  try {
    const { userId } = await requireUserId();
    const { id } = await params;
    return NextResponse.json({ versions: await listVersions(userId, id) });
  } catch (error) {
    return authError(error)
      ? NextResponse.json({ error: 'unauthorized' }, { status: 401 })
      : NextResponse.json({ error: 'versions failed' }, { status: 500 });
  }
}

export async function POST(request: Request, { params }: Params) {
  try {
    const { userId } = await requireUserId();
    const { id } = await params;
    const body = (await request.json().catch(() => ({}))) as { label?: string; source?: 'agent' | 'manual' | 'restore' | 'system'; html?: string; model?: StudioDocumentModel };
    const version = await createVersion(userId, id, body);
    return version ? NextResponse.json({ version }) : NextResponse.json({ error: 'Document not found' }, { status: 404 });
  } catch (error) {
    return authError(error)
      ? NextResponse.json({ error: 'unauthorized' }, { status: 401 })
      : NextResponse.json({ error: 'version creation failed' }, { status: 500 });
  }
}

export async function PUT(request: Request, { params }: Params) {
  try {
    const { userId } = await requireUserId();
    const { id } = await params;
    const body = (await request.json()) as { versionId?: string };
    if (!body.versionId) return NextResponse.json({ error: 'versionId is required' }, { status: 400 });
    const doc = await restoreVersion(userId, id, body.versionId);
    return doc ? NextResponse.json({ doc }) : NextResponse.json({ error: 'Version not found' }, { status: 404 });
  } catch (error) {
    return authError(error)
      ? NextResponse.json({ error: 'unauthorized' }, { status: 401 })
      : NextResponse.json({ error: 'version restore failed' }, { status: 500 });
  }
}
