import { NextRequest, NextResponse } from 'next/server';
import { getDocument, saveDocument } from '@/lib/doc-store';
import { verifyOfficeToken } from '@/lib/onlyoffice-token';
import { writeSourceDocx } from '@/lib/source-docx-store';

type Params = { params: Promise<{ id: string }> };
export const runtime = 'nodejs';

/** OnlyOffice posts the saved OOXML file here. It must always return error:0. */
export async function POST(request: NextRequest, { params }: Params) {
  const { id } = await params;
  const token = verifyOfficeToken(request.nextUrl.searchParams.get('officeToken'));
  if (!token || token.documentId !== id) return NextResponse.json({ error: 1 }, { status: 403 });
  try {
    const body = await request.json() as { status?: number; url?: string };
    if (![2, 6].includes(Number(body.status)) || !body.url) return NextResponse.json({ error: 0 });
    const document = await getDocument(token.userId, id);
    if (!document?.sourceDocx) return NextResponse.json({ error: 1 }, { status: 404 });
    const response = await fetch(body.url);
    if (!response.ok) throw new Error(`OnlyOffice save download failed: ${response.status}`);
    const bytes = new Uint8Array(await response.arrayBuffer());
    await writeSourceDocx(token.userId, id, bytes);
    await saveDocument(token.userId, id, {
      sourceDocx: { ...document.sourceDocx, size: bytes.byteLength, updatedAt: Date.now() },
    });
    return NextResponse.json({ error: 0 });
  } catch {
    return NextResponse.json({ error: 1 });
  }
}
