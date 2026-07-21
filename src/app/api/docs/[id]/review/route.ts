import { NextRequest, NextResponse } from 'next/server';
import { requireUserId } from '@/lib/auth';
import { getDocument, saveDocument } from '@/lib/doc-store';
import { reviewAssignment } from '@/lib/assignment-review';

export const runtime = 'nodejs';
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUserId(); const { id } = await params; const doc = await getDocument(user.userId, id);
    if (!doc) return NextResponse.json({ error: 'not_found' }, { status: 404 });
    return NextResponse.json({ review: reviewAssignment(doc.brief, doc.html, doc.model, doc.revision) });
  } catch (error: any) { return NextResponse.json({ error: error?.message || 'review_failed' }, { status: 500 }); }
}

export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUserId();
    const { id } = await params;
    const doc = await getDocument(user.userId, id);
    if (!doc) return NextResponse.json({ error: 'not_found' }, { status: 404 });
    const review = reviewAssignment(doc.brief, doc.html, doc.model, doc.revision);
    if (!review) return NextResponse.json({ review: null });
    const saved = await saveDocument(user.userId, id, { delivery: review.snapshot }, doc.revision);
    return NextResponse.json({ review, delivery: saved?.delivery || review.snapshot, revision: saved?.revision || doc.revision });
  } catch (error: any) {
    if (error?.code === 'DOCUMENT_CONFLICT') return NextResponse.json({ error: 'conflict' }, { status: 409 });
    return NextResponse.json({ error: error?.message || 'review_refresh_failed' }, { status: 500 });
  }
}
