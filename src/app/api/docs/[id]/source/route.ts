import { NextRequest, NextResponse } from 'next/server';
import { getDocument, saveDocument } from '@/lib/doc-store';
import { requireUserId } from '@/lib/auth';
import { readSourceDocx, writeSourceDocx } from '@/lib/source-docx-store';
import { verifyOfficeToken } from '@/lib/onlyoffice-token';

type Params = { params: Promise<{ id: string }> };

export const runtime = 'nodejs';

export async function GET(request: NextRequest, { params }: Params) {
  const { id } = await params;
  const office = verifyOfficeToken(request.nextUrl.searchParams.get('officeToken'));
  const user = office && office.documentId === id ? { userId: office.userId } : await requireUserId();
  const doc = await getDocument(user.userId, id);
  if (!doc?.sourceDocx) return NextResponse.json({ error: 'source_not_found' }, { status: 404 });
  const source = await readSourceDocx(user.userId, id);
  if (!source) return NextResponse.json({ error: 'source_not_found' }, { status: 404 });
  return new NextResponse(source, {
    headers: {
      'content-type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'content-disposition': `inline; filename="${doc.sourceDocx.fileName.replace(/["\\]/g, '_')}"`,
      'cache-control': 'private, no-store',
    },
  });
}

export async function POST(request: NextRequest, { params }: Params) {
  try {
    const user = await requireUserId();
    const { id } = await params;
    const doc = await getDocument(user.userId, id);
    if (!doc) return NextResponse.json({ error: 'not_found' }, { status: 404 });
    const form = await request.formData();
    const file = form.get('file');
    if (!(file instanceof File) || !/\.docx$/i.test(file.name)) {
      return NextResponse.json({ error: 'A .docx file is required.' }, { status: 400 });
    }
    if (file.size > 25 * 1024 * 1024) return NextResponse.json({ error: 'Maximum .docx size is 25 MB.' }, { status: 413 });
    await writeSourceDocx(user.userId, id, new Uint8Array(await file.arrayBuffer()));
    const sourceDocx = { fileName: file.name.slice(0, 180), size: file.size, updatedAt: Date.now() };
    const saved = await saveDocument(user.userId, id, { sourceDocx });
    return NextResponse.json({ sourceDocx: saved?.sourceDocx });
  } catch (error: any) {
    const status = error?.message === 'UNAUTHORIZED' || error?.message === 'GUEST_ID_MISSING' ? 401 : 500;
    return NextResponse.json({ error: error?.message || 'source upload failed' }, { status });
  }
}
