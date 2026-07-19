import { handlers, isAuthConfigured } from '@/lib/auth';
import type { NextRequest } from 'next/server';

// Guest mode is intentionally auth-free. Returning a valid session JSON keeps
// Auth.js clients from attempting to parse an HTML 500 page when Google OAuth
// credentials are not configured.
export async function GET(request: NextRequest) {
  if (!isAuthConfigured()) {
    if (new URL(request.url).pathname.endsWith('/session')) {
      return Response.json({ user: null, expires: null });
    }
    return Response.json({ error: 'auth_not_configured' }, { status: 404 });
  }
  return handlers.GET(request);
}

export async function POST(request: NextRequest) {
  if (!isAuthConfigured()) {
    return Response.json({ error: 'auth_not_configured' }, { status: 404 });
  }
  return handlers.POST(request);
}
