import { NextRequest, NextResponse } from 'next/server';
import { parseAssignment } from '@/ai/flows/parse-assignment';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const text = typeof body.text === 'string' ? body.text.trim() : '';
    if (text.length < 20) {
      return NextResponse.json({ error: 'El brief debe tener al menos 20 caracteres.' }, { status: 400 });
    }
    const brief = await parseAssignment({
      text: text.slice(0, 30000),
      fileName: typeof body.fileName === 'string' ? body.fileName.slice(0, 120) : undefined,
    });
    brief.references = Array.isArray(body.references)
      ? body.references
          .filter((reference: any) => reference && typeof reference.name === 'string')
          .slice(0, 12)
          .map((reference: any) => ({
            name: reference.name.slice(0, 160),
            mimeType: typeof reference.mimeType === 'string' ? reference.mimeType.slice(0, 120) : undefined,
            size: Number.isFinite(reference.size) ? Math.max(0, Math.floor(reference.size)) : undefined,
          }))
      : [];
    return NextResponse.json({ brief });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'No se pudo analizar el brief.' }, { status: 500 });
  }
}
