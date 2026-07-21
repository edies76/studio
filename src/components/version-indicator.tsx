'use client';

import { PACKAGE_VERSION } from '@/lib/constants';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

/** Bottom-right version badge (same idea as Lunar). */
export default function VersionIndicator() {
  const pathname = usePathname();
  const version = PACKAGE_VERSION;
  const [mounted, setMounted] = useState(false);

  // The version is build metadata. Render it only after hydration so a stale
  // dev bundle cannot make the server and client disagree on the first render.
  useEffect(() => setMounted(true), []);

  if (!mounted || !version || pathname?.startsWith('/studio')) return null;

  return (
    <div
      className="pointer-events-none fixed bottom-4 right-4 z-[60] rounded px-2 py-1 font-mono text-[11px] opacity-50 transition-opacity hover:opacity-100"
      style={{
        backgroundColor: 'rgba(15, 23, 42, 0.82)',
        color: '#F5F2E0',
        backdropFilter: 'blur(8px)',
        border: '1px solid rgba(245, 242, 224, 0.12)',
      }}
      title={`Docs Studio v${version}`}
    >
      v{version}
    </div>
  );
}
