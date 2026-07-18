'use client';

import { signIn } from 'next-auth/react';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import BrandMark from '@/components/brand-mark';
import { cn } from '@/lib/utils';

function LoginInner() {
  const params = useSearchParams();
  const callbackUrl = params.get('callbackUrl') || '/home';
  const error = params.get('error');

  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-[#f7f6f3] px-4">
      <div className="w-full max-w-sm rounded-3xl border border-neutral-200/90 bg-white p-8 shadow-[0_20px_60px_rgba(0,0,0,0.06)]">
        <div className="mb-6 flex flex-col items-center text-center">
          <BrandMark size={44} />
          <h1 className="mt-4 text-[22px] font-semibold tracking-tight text-neutral-900">
            Docs Studio
          </h1>
          <p className="mt-1.5 text-[13px] leading-relaxed text-neutral-500">
            Entrá con Google para guardar documentos, chat y autosave en tu cuenta.
          </p>
        </div>

        {error && (
          <p className="mb-4 rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-center text-[12px] text-red-700">
            No se pudo iniciar sesión. Revisá las credenciales de Google OAuth.
          </p>
        )}

        <button
          type="button"
          onClick={() => signIn('google', { callbackUrl })}
          className={cn(
            'flex w-full items-center justify-center gap-3 rounded-full border border-neutral-200 bg-white px-4 py-3',
            'text-[14px] font-semibold text-neutral-800 shadow-sm transition',
            'hover:bg-neutral-50 hover:shadow-md active:scale-[0.99]',
          )}
        >
          <GoogleIcon />
          Continuar con Google
        </button>

        <p className="mt-5 text-center text-[11px] text-neutral-400">
          Solo Google. Sin contraseñas.
        </p>

        <a
          href="/home"
          className="mt-4 block text-center text-[12px] font-medium text-neutral-500 underline-offset-2 hover:text-neutral-800 hover:underline"
        >
          Seguir sin cuenta (modo local)
        </a>
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
        <div className="flex min-h-[100dvh] items-center justify-center bg-[#f7f6f3] text-sm text-neutral-500">
          Cargando…
        </div>
      }
    >
      <LoginInner />
    </Suspense>
  );
}
