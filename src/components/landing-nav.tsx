'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import BrandMark from '@/components/brand-mark';
import LocaleSwitch from '@/components/locale-switch';
import { useLocale } from '@/lib/i18n/locale-context';
import { cn } from '@/lib/utils';

/**
 * Header: logo + DocsS wordmark (studio expands on scroll-down) left;
 * section links + EN/ES + CTA right.
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
    <header className="landing-nav landing-nav--slim">
      <Link
        href="/"
        className={cn('landing-brand-lockup', studioOpen && 'is-open')}
        aria-label="Docs Studio"
      >
        <BrandMark size={32} className="landing-brand-lockup__mark" />
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

      <div className="landing-nav__right">
        <nav className="landing-nav__links" aria-label="Sections">
          <a href="#producto">{t('nav.what')}</a>
          <a href="#canvas">{t('nav.canvas')}</a>
          <a href="#control">{t('nav.control')}</a>
          <Link href="/mcp">{t('nav.mcp')}</Link>
        </nav>
        <LocaleSwitch />
        <Link className="landing-nav__cta" href="/studio">
          {t('nav.open')} <span aria-hidden="true">↗</span>
        </Link>
      </div>
    </header>
  );
}
