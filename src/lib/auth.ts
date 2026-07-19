import NextAuth from 'next-auth';
import Google from 'next-auth/providers/google';
import type { NextAuthConfig } from 'next-auth';
import { cookies, headers } from 'next/headers';

/**
 * Optional Google auth (Auth.js). Guest mode is the default:
 * - FORCE_AUTH != '1' → always allow userId "local-guest" without session
 * - Google login is opt-in when AUTH_GOOGLE_* + AUTH_SECRET are set
 */
const googleClientId = process.env.AUTH_GOOGLE_ID || process.env.GOOGLE_CLIENT_ID;
const googleClientSecret = process.env.AUTH_GOOGLE_SECRET || process.env.GOOGLE_CLIENT_SECRET;
const authSecret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;
const authConfigured = Boolean(googleClientId && googleClientSecret && authSecret);

export const authConfig = {
  // Guest mode must never instantiate a Google provider with empty
  // credentials. Auth.js otherwise responds from /api/auth/session with an
  // HTML 500 page, which clients then fail to parse as JSON.
  providers: authConfigured
    ? [
        Google({
          clientId: googleClientId!,
          clientSecret: googleClientSecret!,
          allowDangerousEmailAccountLinking: true,
        }),
      ]
    : [],
  pages: {
    signIn: '/login',
  },
  callbacks: {
    async jwt({ token, account, profile }: any) {
      if (account && profile) {
        token.sub = profile.sub || token.sub;
        token.picture = profile.picture || token.picture;
        token.name = profile.name || token.name;
        token.email = profile.email || token.email;
      }
      return token;
    },
    async session({ session, token }: any) {
      if (session.user) {
        session.user.id = (token.sub as string) || session.user.email || 'anonymous';
        if (token.picture) session.user.image = token.picture as string;
      }
      return session;
    },
  },
  trustHost: true,
  secret: authSecret,
} satisfies NextAuthConfig;

export const { handlers, auth, signIn, signOut } = NextAuth(authConfig);

export function isAuthConfigured(): boolean {
  return authConfigured;
}

/** Stable user id for storage: session user id or isolated browser guest. */
export async function requireUserId(): Promise<{
  userId: string;
  guest: boolean;
  name?: string | null;
  email?: string | null;
  image?: string | null;
}> {
  const guestCookie =
    (await cookies()).get('docs-guest-id')?.value ||
    (await headers()).get('x-docs-guest-id') ||
    undefined;
  const guest = {
    // Keep the old fallback for direct server calls that predate the cookie;
    // browser requests receive the cookie from middleware before storage.
    userId: guestCookie ? `guest-${guestCookie}` : 'local-guest',
    guest: true as const,
    name: 'Invitado local',
    email: null as string | null,
    image: null as string | null,
  };

  if (!isAuthConfigured()) return guest;

  const session = await auth();
  if (!session?.user?.id) {
    // Dev-friendly: guest allowed unless FORCE_AUTH=1
    if (process.env.FORCE_AUTH === '1') throw new Error('UNAUTHORIZED');
    return guest;
  }
  return {
    userId: session.user.id,
    guest: false,
    name: session.user.name,
    email: session.user.email,
    image: session.user.image,
  };
}
