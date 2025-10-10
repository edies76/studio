import type {Metadata} from 'next';
import './globals.css';
import { cn } from "@/lib/utils"
import { Toaster } from "@/components/ui/toaster"

export const metadata: Metadata = {
  title: 'bamba',
  description: 'Generate, format, and enhance documents with AI.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning className="dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&family=Playfair+Display:wght@700&display=swap" rel="stylesheet" />
        <script id="MathJax-script" async src="https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-mml-chtml.js"></script>
      </head>
      <body className={cn("font-sans antialiased")}>
        {children}
        <Toaster />
      </body>
    </html>
  );
}
