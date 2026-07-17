'use client';

import { cn } from '@/lib/utils';

/** Favicon mark (document sheet) — use across chrome, never on loading screen */
export default function BrandMark({
  className,
  size = 36,
}: {
  className?: string;
  size?: number;
}) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 32 32"
      width={size}
      height={size}
      className={cn('shrink-0', className)}
      aria-hidden
    >
      <rect width="32" height="32" rx="8" fill="#171717" />
      <rect x="8" y="7" width="16" height="18" rx="1.5" fill="#fff" />
      <path
        d="M11 12h10M11 16h10M11 20h6"
        stroke="#171717"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}
