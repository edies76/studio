import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Soft gate: if AUTH is configured and FORCE_AUTH=1, protect /home and /studio.
 * Landing `/` stays public. Default: guest local mode without OAuth.
 */
export function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname;

  // Legacy query routes → canonical paths
  if (path === '/' || path === '/studio') {
    const doc = req.nextUrl.searchParams.get('doc');
    const topic = req.nextUrl.searchParams.get('topic');
    if (doc && doc !== 'new') {
      const url = req.nextUrl.clone();
      url.pathname = `/studio/doc/${doc}`;
      url.searchParams.delete('doc');
      return NextResponse.redirect(url);
    }
    if (path === '/' && topic) {
      const url = req.nextUrl.clone();
      url.pathname = '/studio';
      return NextResponse.redirect(url);
    }
  }

  const force = process.env.FORCE_AUTH === '1';
  if (!force) return NextResponse.next();

  const hasGoogle =
    (process.env.AUTH_GOOGLE_ID || process.env.GOOGLE_CLIENT_ID) &&
    (process.env.AUTH_GOOGLE_SECRET || process.env.GOOGLE_CLIENT_SECRET);
  if (!hasGoogle) return NextResponse.next();

  const isProtected =
    path.startsWith('/home') ||
    path.startsWith('/studio') ||
    path.startsWith('/api/docs');

  if (!isProtected) return NextResponse.next();
  if (path.startsWith('/login') || path.startsWith('/api/auth')) {
    return NextResponse.next();
  }

  const token =
    req.cookies.get('authjs.session-token') ||
    req.cookies.get('__Secure-authjs.session-token') ||
    req.cookies.get('next-auth.session-token');

  if (!token) {
    if (path.startsWith('/api/')) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('callbackUrl', path);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/',
    '/home',
    '/home/:path*',
    '/studio',
    '/studio/:path*',
    '/api/docs/:path*',
    '/pre-summary',
  ],
};
