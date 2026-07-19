'use client';

import Link from 'next/link';
import AnimatedBrand from '@/components/animated-brand';
import LocaleSwitch from '@/components/locale-switch';
import { useLocale } from '@/lib/i18n/locale-context';

/**
 * Top chrome:
 * One compact header: Docs expands to Docs Studio while the page scrolls.
 */
export default function LandingNav() {
  const { t } = useLocale();
  return (
    <div className="landing-top">
      <header className="landing-nav landing-nav--full" role="navigation">
        <AnimatedBrand className="landing-brand-lockup" scrollRoot=".landing-page" size={30} />
        <nav className="landing-nav__links" aria-label="Sections">
          <a href="#producto">{t('nav.what')}</a>
          <a href="#canvas">{t('nav.canvas')}</a>
          <a href="#control">{t('nav.control')}</a>
          <Link href="/mcp">{t('nav.mcp')}</Link>
          <Link href="/usecases">{t('nav.usecases')}</Link>
          <Link href="/origin">{t('nav.origin')}</Link>
        </nav>
        <LocaleSwitch />
        <Link className="landing-nav__save" href="/login?callbackUrl=%2Fhome">
          {t('nav.save')}
        </Link>
        <Link className="landing-nav__cta" href="/home">
          {t('nav.open')} <span aria-hidden="true">↗</span>
        </Link>
      </header>
    </div>
  );
}
