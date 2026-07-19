import { NextRequest, NextResponse } from 'next/server';
import { requireUserId } from '@/lib/auth';
import { getDocument } from '@/lib/doc-store';
import { reviewAssignment } from '@/lib/assignment-review';

export const runtime = 'nodejs';
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUserId(); const { id } = await params; const doc = await getDocument(user.userId, id);
    if (!doc) return NextResponse.json({ error: 'not_found' }, { status: 404 });
    return NextResponse.json({ review: reviewAssignment(doc.brief, doc.html) });
  } catch (error: any) { return NextResponse.json({ error: error?.message || 'review_failed' }, { status: 500 }); }
}
