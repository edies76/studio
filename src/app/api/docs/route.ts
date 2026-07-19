import { NextRequest, NextResponse } from 'next/server';
import { requireUserId } from '@/lib/auth';
import { createDocument, listDocuments, storageBackend } from '@/lib/doc-store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const user = await requireUserId();
    const docs = await listDocuments(user.userId);
    return NextResponse.json({
      docs,
      backend: storageBackend(),
      user: {
        id: user.userId,
        guest: user.guest,
        name: user.name,
        email: user.email,
        image: user.image,
      },
    });
  } catch (e: any) {
    if (e?.message === 'UNAUTHORIZED' || e?.message === 'GUEST_ID_MISSING') {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }
    return NextResponse.json({ error: e?.message || 'list failed' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireUserId();
    const body = await req.json().catch(() => ({}));
    const doc = await createDocument(user.userId, {
      title: body.title || 'Untitled',
      html: body.html || '<p><br></p>',
      paperSize: body.paperSize,
      brief: body.brief,
    });
    return NextResponse.json({ doc });
  } catch (e: any) {
    if (e?.message === 'UNAUTHORIZED' || e?.message === 'GUEST_ID_MISSING') {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }
    return NextResponse.json({ error: e?.message || 'create failed' }, { status: 500 });
  }
}
