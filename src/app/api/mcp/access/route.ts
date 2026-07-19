import { NextRequest, NextResponse } from 'next/server';
import { isAuthConfigured, requireUserId } from '@/lib/auth';
import { createMcpCredential, listMcpCredentials, revokeMcpCredential } from '@/mcp/credentials';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function signedInUser() {
  if (!isAuthConfigured()) throw new Error('AUTH_NOT_CONFIGURED');
  const user = await requireUserId();
  if (user.guest) throw new Error('UNAUTHORIZED');
  return user;
}

export async function GET() {
  try {
    const user = await signedInUser();
    return NextResponse.json({ endpoint: `${process.env.DOCS_STUDIO_URL || 'https://docss.studio'}/api/mcp`, credentials: await listMcpCredentials(user.userId) });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message === 'AUTH_NOT_CONFIGURED' ? 'Google login is not configured.' : 'unauthorized' }, { status: 401 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await signedInUser();
    const body = await request.json().catch(() => ({}));
    const credential = await createMcpCredential(user.userId, body.label);
    return NextResponse.json({ endpoint: `${process.env.DOCS_STUDIO_URL || 'https://docss.studio'}/api/mcp`, credential }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'unauthorized' }, { status: error?.message === 'AUTH_NOT_CONFIGURED' || error?.message === 'UNAUTHORIZED' ? 401 : 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const user = await signedInUser();
    const id = new URL(request.url).searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });
    await revokeMcpCredential(user.userId, id);
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'unauthorized' }, { status: error?.message === 'AUTH_NOT_CONFIGURED' || error?.message === 'UNAUTHORIZED' ? 401 : 500 });
  }
}
