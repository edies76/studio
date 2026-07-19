import { NextRequest, NextResponse } from 'next/server';
import { getDocument } from '@/lib/doc-store';
import { requireUserId } from '@/lib/auth';
import { issueOfficeToken } from '@/lib/onlyoffice-token';

type Params = { params: Promise<{ id: string }> };

export const runtime = 'nodejs';

export async function GET(request: NextRequest, { params }: Params) {
  try {
    const user = await requireUserId();
    const { id } = await params;
    const doc = await getDocument(user.userId, id);
    if (!doc?.sourceDocx) return NextResponse.json({ error: 'source_not_found' }, { status: 404 });
    const officeUrl = process.env.NEXT_PUBLIC_ONLYOFFICE_URL?.replace(/\/$/, '');
    if (!officeUrl) return NextResponse.json({ error: 'office_not_configured' }, { status: 503 });
    const origin = (process.env.DOCS_STUDIO_INTERNAL_URL || new URL(request.url).origin).replace(/\/$/, '');
    const token = issueOfficeToken(user.userId, id);
    const sourceUrl = `${origin}/api/docs/${id}/source?officeToken=${encodeURIComponent(token)}`;
    return NextResponse.json({
      officeUrl,
      config: {
        documentType: 'word',
        document: {
          fileType: 'docx',
          key: `${id}-${doc.sourceDocx.updatedAt}`,
          title: doc.sourceDocx.fileName,
          url: sourceUrl,
          permissions: { edit: true, download: true, print: true },
        },
        editorConfig: {
          mode: 'edit',
          lang: doc.brief?.language || 'es',
          callbackUrl: `${origin}/api/docs/${id}/office-callback?officeToken=${encodeURIComponent(token)}`,
          customization: { compactToolbar: false, forcesave: true },
          user: { id: user.userId.slice(0, 128), name: user.name || user.email || 'Docs Studio user' },
        },
      },
    });
  } catch (error: any) {
    const status = error?.message === 'UNAUTHORIZED' || error?.message === 'GUEST_ID_MISSING' ? 401 : 500;
    return NextResponse.json({ error: error?.message || 'office config failed' }, { status });
  }
}
