'use client';

import { signIn } from 'next-auth/react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Suspense } from 'react';
import BrandMark from '@/components/brand-mark';
import LocaleSwitch from '@/components/locale-switch';
import { useLocale } from '@/lib/i18n/locale-context';
import { cn } from '@/lib/utils';

function LoginInner() {
  const params = useSearchParams();
  const router = useRouter();
  const { t } = useLocale();
  const callbackUrl = params.get('callbackUrl') || '/home';

  return (
    <div className="relative flex min-h-[100dvh] bg-[#f3f0ea]">
      {/* Left panel — editorial */}
      <div className="relative hidden w-[46%] flex-col justify-between overflow-hidden border-r border-neutral-200/80 bg-[#211b17] px-12 py-12 text-[#fff8f0] lg:flex">
        <div className="pointer-events-none absolute inset-0 opacity-40"
          style={{
            background:
              'radial-gradient(circle at 20% 20%, rgba(139,74,52,0.35), transparent 45%), radial-gradient(circle at 80% 80%, rgba(255,248,240,0.08), transparent 40%)',
          }}
        />
        <div className="relative z-10 flex items-center gap-3">
          <BrandMark size={36} />
          <span className="text-[15px] font-semibold tracking-tight">
            Docs<span className="text-[#d4a574]">S</span>
          </span>
        </div>
        <div className="relative z-10 max-w-sm">
          <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-white/45">
            Academic workspace
          </p>
          <h2 className="mt-4 text-[2.4rem] font-semibold leading-[1.1] tracking-tight">
            From brief
            <br />
            to file.
          </h2>
          <p className="mt-5 text-[14px] leading-relaxed text-white/55">
            Paginated canvas, reviewable AI edits, math that stays intact. Sign in only if you want
            your library across devices.
          </p>
        </div>
        <p className="relative z-10 text-[11px] text-white/35">docss.studio</p>
      </div>

      {/* Right panel — actions */}
      <div className="relative flex flex-1 flex-col">
        <div className="absolute right-5 top-5 z-10">
          <LocaleSwitch />
        </div>

        <div className="flex flex-1 flex-col items-center justify-center px-6 py-16">
          <div className="w-full max-w-[360px]">
            <div className="mb-10 text-center lg:text-left">
              <div className="mb-5 flex justify-center lg:hidden">
                <BrandMark size={40} />
              </div>
              <h1 className="text-[26px] font-semibold tracking-tight text-neutral-900">
                {t('login.title')}
              </h1>
              <p className="mt-2 text-[14px] leading-relaxed text-neutral-500">{t('login.lede')}</p>
            </div>

            <button
              type="button"
              onClick={() => signIn('google', { callbackUrl })}
              className={cn(
                'flex w-full items-center justify-center gap-3 rounded-2xl border border-neutral-200 bg-white px-4 py-3.5',
                'text-[14px] font-semibold text-neutral-900 shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition',
                'hover:border-neutral-300 hover:bg-neutral-50 hover:shadow-md active:scale-[0.99]',
              )}
            >
              <GoogleIcon />
              {t('login.google')}
            </button>

            <div className="my-6 flex items-center gap-3">
              <span className="h-px flex-1 bg-neutral-200" />
              <span className="text-[10px] font-medium uppercase tracking-[0.16em] text-neutral-400">
                or
              </span>
              <span className="h-px flex-1 bg-neutral-200" />
            </div>

            <button
              type="button"
              onClick={() => router.push(callbackUrl || '/home')}
              className={cn(
                'flex w-full items-center justify-center rounded-2xl bg-neutral-900 px-4 py-3.5',
                'text-[14px] font-semibold text-white transition',
                'hover:bg-neutral-800 active:scale-[0.99]',
              )}
            >
              {t('login.guest')}
            </button>

            <button
              type="button"
              onClick={() => router.push('/studio')}
              className="mt-4 w-full text-center text-[13px] font-medium text-neutral-500 transition hover:text-neutral-800"
            >
              {t('login.workspace')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </svg>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[100dvh] items-center justify-center bg-[#f3f0ea] text-sm text-neutral-500">
          Loading…
        </div>
      }
    >
      <LoginInner />
    </Suspense>
  );
}
