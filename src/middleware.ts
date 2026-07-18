import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Soft gate: if AUTH is configured and FORCE_AUTH=1, protect /home and editor.
 * Default: allow guest local mode so dev works without Google OAuth.
 */
export function middleware(req: NextRequest) {
  const force = process.env.FORCE_AUTH === '1';
  if (!force) return NextResponse.next();

  const hasGoogle =
    (process.env.AUTH_GOOGLE_ID || process.env.GOOGLE_CLIENT_ID) &&
    (process.env.AUTH_GOOGLE_SECRET || process.env.GOOGLE_CLIENT_SECRET);
  if (!hasGoogle) return NextResponse.next();

  const path = req.nextUrl.pathname;
  const isProtected =
    path.startsWith('/home') ||
    path === '/' ||
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
  matcher: ['/home', '/', '/api/docs/:path*'],
};
