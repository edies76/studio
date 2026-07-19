'use client';

import { useLocale } from '@/lib/i18n/locale-context';
import { cn } from '@/lib/utils';

export default function LocaleSwitch({ className }: { className?: string }) {
  const { locale, setLocale, t } = useLocale();

  return (
    <div
      className={cn(
        'inline-flex items-center rounded-full border border-neutral-200/80 bg-white/90 p-0.5 text-[11px] font-semibold shadow-sm',
        className,
      )}
      role="group"
      aria-label="Language"
    >
      <button
        type="button"
        onClick={() => setLocale('en')}
        className={cn(
          'rounded-full px-2.5 py-1 transition',
          locale === 'en' ? 'bg-neutral-900 text-white' : 'text-neutral-500 hover:text-neutral-800',
        )}
      >
        {t('lang.en')}
      </button>
      <button
        type="button"
        onClick={() => setLocale('es')}
        className={cn(
          'rounded-full px-2.5 py-1 transition',
          locale === 'es' ? 'bg-neutral-900 text-white' : 'text-neutral-500 hover:text-neutral-800',
        )}
      >
        {t('lang.es')}
      </button>
    </div>
  );
}
