'use client';

import { PACKAGE_VERSION } from '@/lib/constants';

/** Bottom-right version badge (same idea as Lunar). */
export default function VersionIndicator() {
  const version = PACKAGE_VERSION;
  if (!version) return null;

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
