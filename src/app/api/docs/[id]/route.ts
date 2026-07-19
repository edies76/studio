import { NextRequest, NextResponse } from 'next/server';
import { requireUserId } from '@/lib/auth';
import {
  appendChat,
  deleteDocument,
  DocumentConflictError,
  getDocument,
  saveDocument,
  type ChatTurn,
} from '@/lib/doc-store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const user = await requireUserId();
    const doc = await getDocument(user.userId, id);
    if (!doc) return NextResponse.json({ error: 'not_found' }, { status: 404 });
    return NextResponse.json({ doc });
  } catch (e: any) {
    if (e?.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }
    return NextResponse.json({ error: e?.message || 'get failed' }, { status: 500 });
  }
}

/** Autosave / full save */
export async function PUT(req: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const user = await requireUserId();
    const body = await req.json().catch(() => ({}));
    const doc = await saveDocument(user.userId, id, {
      title: body.title,
      html: body.html,
      paperSize: body.paperSize,
      chat: body.chat as ChatTurn[] | undefined,
    }, typeof body.revision === 'number' ? body.revision : undefined);
    if (!doc) return NextResponse.json({ error: 'not_found' }, { status: 404 });
    return NextResponse.json({
      doc: {
        id: doc.id,
        title: doc.title,
        updatedAt: doc.updatedAt,
        revision: doc.revision,
        preview: doc.preview,
      },
    });
  } catch (e: any) {
    if (e instanceof DocumentConflictError || e?.code === 'DOCUMENT_CONFLICT') {
      return NextResponse.json({
        error: 'conflict',
        latest: {
          title: e.latest.title,
          html: e.latest.html,
          updatedAt: e.latest.updatedAt,
          revision: e.latest.revision,
        },
      }, { status: 409 });
    }
    if (e?.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }
    return NextResponse.json({ error: e?.message || 'save failed' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const user = await requireUserId();
    const body = await req.json().catch(() => ({}));
    if (body.chatTurn) {
      const doc = await appendChat(user.userId, id, [body.chatTurn as ChatTurn]);
      if (!doc) return NextResponse.json({ error: 'not_found' }, { status: 404 });
      return NextResponse.json({ ok: true, chatLength: doc.chat.length });
    }
    if (Array.isArray(body.chatTurns)) {
      const doc = await appendChat(user.userId, id, body.chatTurns as ChatTurn[]);
      if (!doc) return NextResponse.json({ error: 'not_found' }, { status: 404 });
      return NextResponse.json({ ok: true, chatLength: doc.chat.length });
    }
    return NextResponse.json({ error: 'nothing_to_patch' }, { status: 400 });
  } catch (e: any) {
    if (e?.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }
    return NextResponse.json({ error: e?.message || 'patch failed' }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const user = await requireUserId();
    await deleteDocument(user.userId, id);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    if (e?.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }
    return NextResponse.json({ error: e?.message || 'delete failed' }, { status: 500 });
  }
}
