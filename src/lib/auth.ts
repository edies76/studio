import NextAuth from 'next-auth';
import Google from 'next-auth/providers/google';
import type { NextAuthConfig } from 'next-auth';

/**
 * Optional Google auth (Auth.js). Guest mode is the default:
 * - FORCE_AUTH != '1' → always allow userId "local-guest" without session
 * - Google login is opt-in when AUTH_GOOGLE_* + AUTH_SECRET are set
 */
export const authConfig = {
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID || process.env.GOOGLE_CLIENT_ID || '',
      clientSecret: process.env.AUTH_GOOGLE_SECRET || process.env.GOOGLE_CLIENT_SECRET || '',
      allowDangerousEmailAccountLinking: true,
    }),
  ],
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
  secret: process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET,
} satisfies NextAuthConfig;

export const { handlers, auth, signIn, signOut } = NextAuth(authConfig);

export function isAuthConfigured(): boolean {
  const id = process.env.AUTH_GOOGLE_ID || process.env.GOOGLE_CLIENT_ID;
  const secret = process.env.AUTH_GOOGLE_SECRET || process.env.GOOGLE_CLIENT_SECRET;
  return Boolean(id && secret && (process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET));
}

/** Stable user id for storage: session user id or local-dev guest */
export async function requireUserId(): Promise<{
  userId: string;
  guest: boolean;
  name?: string | null;
  email?: string | null;
  image?: string | null;
}> {
  const guest = {
    userId: 'local-guest',
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
