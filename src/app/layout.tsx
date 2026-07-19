import type { Metadata } from 'next';
import './globals.css';
import { cn } from '@/lib/utils';
import { Toaster } from '@/components/ui/toaster';
import Script from 'next/script';
import { IBM_Plex_Mono, Space_Grotesk } from 'next/font/google';
import AuthSessionProvider from '@/components/session-provider';
import { LocaleProvider } from '@/lib/i18n/locale-context';
import VersionIndicator from '@/components/version-indicator';

const displayFont = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-display',
  display: 'swap',
  weight: ['400', '500', '600', '700'],
});

const monoFont = IBM_Plex_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
  weight: ['400', '500', '600'],
});

export const metadata: Metadata = {
  title: 'Docs Studio | From brief to document',
  description:
    'Academic workspace: paper canvas, APA/IEEE norms, equations, Accept/Reject, PDF/Word export.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <Script src="/mathjax-config.js" strategy="beforeInteractive" />
        <Script
          id="MathJax-script"
          strategy="afterInteractive"
          src="https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-chtml.js"
        />
      </head>
      <body
        className={cn(
          displayFont.variable,
          monoFont.variable,
          'min-h-full bg-white text-neutral-900 antialiased',
        )}
      >
        <AuthSessionProvider>
          <LocaleProvider>
            {children}
            <VersionIndicator />
            <Toaster />
          </LocaleProvider>
        </AuthSessionProvider>
      </body>
    </html>
  );
}
