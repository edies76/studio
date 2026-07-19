'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

/**
 * Minimal landing chrome:
 * - Left: wordmark Docs + S (studio expands on scroll-down once, collapses on scroll-up)
 * - Right: section links + CTA only
 * No logo mark, no domain slogans in the bar.
 */
export default function LandingNav() {
  const [studioOpen, setStudioOpen] = useState(false);

  useEffect(() => {
    let lastY = window.scrollY;
    let open = false;

    const onScroll = () => {
      const y = window.scrollY;
      const goingDown = y > lastY;
      const goingUp = y < lastY;

      // Trigger open once past a small threshold while scrolling down
      if (goingDown && y > 48 && !open) {
        open = true;
        setStudioOpen(true);
      }
      // Close when user scrolls back toward the top
      if (goingUp && y < 80 && open) {
        open = false;
        setStudioOpen(false);
      }
      // Also close fully at top
      if (y < 12 && open) {
        open = false;
        setStudioOpen(false);
      }

      lastY = y;
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header className="landing-nav landing-nav--slim">
      <Link
        href="/"
        className={cn('landing-wordmark', studioOpen && 'is-open')}
        aria-label="Docs Studio"
      >
        <span className="landing-wordmark__docs">Docs</span>
        <span className="landing-wordmark__s" aria-hidden="true">
          S
        </span>
        <span
          className="landing-wordmark__studio"
          aria-hidden={!studioOpen}
        >
          tudio
        </span>
      </Link>

      <div className="landing-nav__right">
        <nav className="landing-nav__links" aria-label="Secciones">
          <a href="#producto">Qué es</a>
          <a href="#canvas">El lienzo</a>
          <a href="#control">Control</a>
          <Link href="/mcp">MCP</Link>
        </nav>
        <Link className="landing-nav__cta" href="/studio">
          Abrir el workspace <span aria-hidden="true">↗</span>
        </Link>
      </div>
    </header>
  );
}
