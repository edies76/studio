'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import BrandMark from '@/components/brand-mark';
import LocaleSwitch from '@/components/locale-switch';
import { useLocale } from '@/lib/i18n/locale-context';
import { cn } from '@/lib/utils';

/**
 * Top chrome:
 * - LEFT (outside the pill): logo + DocsS wordmark.
 *   On scroll-down "S" expands to "Studio"; scroll-up closes it.
 * - RIGHT: slim pill head with ONLY section links + locale + CTA.
 *   The pill is width:fit-content — not a full-width bar.
 */
export default function LandingNav() {
  const { t } = useLocale();
  const [studioOpen, setStudioOpen] = useState(false);

  useEffect(() => {
    let lastY = window.scrollY;
    let open = false;

    const onScroll = () => {
      const y = window.scrollY;
      const goingDown = y > lastY;
      const goingUp = y < lastY;

      if (goingDown && y > 48 && !open) {
        open = true;
        setStudioOpen(true);
      }
      if ((goingUp && y < 80 && open) || y < 12) {
        open = false;
        setStudioOpen(false);
      }
      lastY = y;
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <div className="landing-top">
      {/* Brand stays LEFT, outside the reduced head */}
      <Link
        href="/"
        className={cn('landing-brand-lockup', studioOpen && 'is-open')}
        aria-label="Docs Studio"
      >
        <BrandMark size={36} className="landing-brand-lockup__mark" />
        <span className={cn('landing-wordmark', studioOpen && 'is-open')}>
          <span className="landing-wordmark__docs">Docs</span>
          <span className="landing-wordmark__s" aria-hidden="true">
            S
          </span>
          <span className="landing-wordmark__studio" aria-hidden={!studioOpen}>
            tudio
          </span>
        </span>
      </Link>

      {/* Slim head = right options only, hug content width */}
      <header className="landing-nav landing-nav--slim" role="navigation">
        <nav className="landing-nav__links" aria-label="Sections">
          <a href="#producto">{t('nav.what')}</a>
          <a href="#canvas">{t('nav.canvas')}</a>
          <a href="#control">{t('nav.control')}</a>
          <Link href="/mcp">{t('nav.mcp')}</Link>
        </nav>
        <LocaleSwitch />
        <Link className="landing-nav__save" href="/login?callbackUrl=%2Fhome">
          {t('nav.save')}
        </Link>
        <Link className="landing-nav__cta" href="/studio">
          {t('nav.open')} <span aria-hidden="true">↗</span>
        </Link>
      </header>
    </div>
  );
}
