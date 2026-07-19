'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession, signIn, signOut } from 'next-auth/react';
import {
  ArrowUpRight,
  FilePlus2,
  FileText,
  Loader2,
  LogIn,
  LogOut,
  Sparkles,
  Trash2,
  Upload,
} from 'lucide-react';
import BrandMark from '@/components/brand-mark';
import LocaleSwitch from '@/components/locale-switch';
import { useLocale } from '@/lib/i18n/locale-context';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

type DocItem = {
  id: string;
  title: string;
  preview: string;
  updatedAt: number;
  createdAt: number;
};

function formatRelative(ts: number, locale: string) {
  const d = Date.now() - ts;
  const m = Math.floor(d / 60000);
  if (locale === 'es') {
    if (m < 1) return 'Ahora';
    if (m < 60) return `Hace ${m} min`;
    const h = Math.floor(m / 60);
    if (h < 24) return `Hace ${h} h`;
    const days = Math.floor(h / 24);
    if (days < 14) return `Hace ${days} d`;
  } else {
    if (m < 1) return 'Just now';
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    const days = Math.floor(h / 24);
    if (days < 14) return `${days}d ago`;
  }
  return new Date(ts).toLocaleDateString(locale === 'es' ? 'es' : 'en');
}

/**
 * Reading this as: product library (Docs-like) for academic users,
 * calm Linear-style language, sans type, one primary action.
 */
export default function HomePage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const { toast } = useToast();
  const { t, locale } = useLocale();
  const [docs, setDocs] = useState<DocItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [guest, setGuest] = useState(true);
  const [userLabel, setUserLabel] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/docs');
      if (res.status === 401) {
        toast({
          title: locale === 'es' ? 'Sesion requerida' : 'Sign-in required',
          description:
            locale === 'es'
              ? 'El servidor tiene FORCE_AUTH activo.'
              : 'Server has FORCE_AUTH enabled.',
        });
        return;
      }
      const data = await res.json();
      setDocs(data.docs || []);
      setGuest(Boolean(data.user?.guest ?? true));
      setUserLabel(
        data.user?.guest
          ? locale === 'es'
            ? 'Guest'
            : 'Guest'
          : data.user?.name || data.user?.email || 'User',
      );
    } catch {
      toast({
        variant: 'destructive',
        title: locale === 'es' ? 'No se pudieron cargar los documentos' : 'Could not load documents',
      });
    } finally {
      setLoading(false);
    }
  }, [locale, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const createDoc = async (title = 'Untitled') => {
    setCreating(true);
    try {
      const res = await fetch('/api/docs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, html: '<p><br></p>' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'create failed');
      router.push(`/studio/doc/${data.doc.id}`);
    } catch (e: any) {
      toast({
        variant: 'destructive',
        title: locale === 'es' ? 'No se pudo crear' : 'Could not create',
        description: e?.message,
      });
    } finally {
      setCreating(false);
    }
  };

  const removeDoc = async (id: string) => {
    const ok =
      typeof window !== 'undefined' &&
      window.confirm(locale === 'es' ? 'Eliminar este documento?' : 'Delete this document?');
    if (!ok) return;
    try {
      const res = await fetch(`/api/docs/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('delete failed');
      setDocs((d) => d.filter((x) => x.id !== id));
    } catch {
      toast({
        variant: 'destructive',
        title: locale === 'es' ? 'No se pudo eliminar' : 'Could not delete',
      });
    }
  };

  return (
    <div className="home-lib min-h-[100dvh] overflow-y-auto bg-[#f6f5f2] text-neutral-900">
      <header className="sticky top-0 z-20 border-b border-black/[0.06] bg-[#f6f5f2]/85 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-[1080px] items-center justify-between px-5 sm:px-8">
          <a href="/" className="flex items-center gap-2.5 no-underline">
            <BrandMark size={26} />
            <span className="text-[14px] font-semibold tracking-tight text-neutral-900">
              Docs<span className="text-[#8b4a34]">S</span>
            </span>
          </a>
          <div className="flex items-center gap-2">
            <LocaleSwitch />
            {status === 'authenticated' && session?.user ? (
              <>
                {session.user.image && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={session.user.image}
                    alt=""
                    className="h-8 w-8 rounded-full border border-neutral-200"
                  />
                )}
                <span className="hidden max-w-[140px] truncate text-[12px] text-neutral-500 sm:inline">
                  {session.user.name || session.user.email}
                </span>
                <button
                  type="button"
                  onClick={() => signOut({ callbackUrl: '/login' })}
                  className="flex h-9 items-center gap-1.5 rounded-full border border-neutral-200 bg-white px-3 text-[12px] font-medium text-neutral-700 shadow-sm hover:bg-neutral-50"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  {t('home.signOut')}
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => signIn('google', { callbackUrl: '/home' })}
                className="flex h-9 items-center gap-1.5 rounded-full border border-neutral-200 bg-white px-3.5 text-[12px] font-semibold text-neutral-800 shadow-sm hover:bg-neutral-50"
              >
                <LogIn className="h-3.5 w-3.5" />
                {t('home.google')}
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1080px] px-5 pb-20 pt-12 sm:px-8">
        {/* Page title — product UI, not marketing serif */}
        <div className="mb-10 flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="font-[family-name:var(--font-display)] text-[1.75rem] font-semibold tracking-[-0.03em] text-neutral-900 sm:text-[2rem]">
              {t('home.title')}
            </h1>
            <p className="mt-1.5 text-[13px] text-neutral-500">
              {guest ? t('home.guest') : userLabel}
            </p>
          </div>
          <button
            type="button"
            disabled={creating}
            onClick={() => void createDoc()}
            className={cn(
              'inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-neutral-900 px-5',
              'text-[13px] font-semibold text-white transition hover:bg-neutral-800',
              'disabled:opacity-50',
            )}
          >
            {creating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <FilePlus2 className="h-4 w-4" />
            )}
            {t('home.new')}
          </button>
        </div>

        {/* Three real entry actions (replace the old triplicate blanks) */}
        <div className="mb-12 grid gap-3 sm:grid-cols-3">
          <button
            type="button"
            disabled={creating}
            onClick={() => void createDoc()}
            className="group flex items-start gap-4 rounded-2xl border border-neutral-200/90 bg-white p-5 text-left shadow-[0_1px_2px_rgba(0,0,0,0.03)] transition hover:border-neutral-300 hover:shadow-md disabled:opacity-60"
          >
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-neutral-900 text-white">
              {creating ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <FilePlus2 className="h-5 w-5" strokeWidth={1.75} />
              )}
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-1.5 text-[14px] font-semibold text-neutral-900">
                {t('home.blank')}
                <ArrowUpRight className="h-3.5 w-3.5 opacity-0 transition group-hover:opacity-50" />
              </span>
              <span className="mt-1 block text-[12.5px] leading-relaxed text-neutral-500">
                {t('home.blankSub')}
              </span>
            </span>
          </button>
          <button
            type="button"
            onClick={() => router.push('/')}
            className="group flex items-start gap-4 rounded-2xl border border-neutral-200/90 bg-white p-5 text-left shadow-[0_1px_2px_rgba(0,0,0,0.03)] transition hover:border-neutral-300 hover:shadow-md"
          >
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#f0ebe4] text-[#8b4a34]">
              <Sparkles className="h-5 w-5" strokeWidth={1.75} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-1.5 text-[14px] font-semibold text-neutral-900">
                {t('home.fromGuide')}
                <ArrowUpRight className="h-3.5 w-3.5 opacity-0 transition group-hover:opacity-50" />
              </span>
              <span className="mt-1 block text-[12.5px] leading-relaxed text-neutral-500">
                {t('home.fromGuideSub')}
              </span>
            </span>
          </button>
          <button
            type="button"
            onClick={() => router.push('/studio')}
            className="group flex items-start gap-4 rounded-2xl border border-neutral-200/90 bg-white p-5 text-left shadow-[0_1px_2px_rgba(0,0,0,0.03)] transition hover:border-neutral-300 hover:shadow-md"
          >
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-neutral-100 text-neutral-700">
              <Upload className="h-5 w-5" strokeWidth={1.75} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-1.5 text-[14px] font-semibold text-neutral-900">
                {t('home.openStudio')}
                <ArrowUpRight className="h-3.5 w-3.5 opacity-0 transition group-hover:opacity-50" />
              </span>
              <span className="mt-1 block text-[12.5px] leading-relaxed text-neutral-500">
                {t('home.openStudioSub')}
              </span>
            </span>
          </button>
        </div>

        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-[12px] font-semibold uppercase tracking-[0.08em] text-neutral-400">
            {t('home.recent')}
          </h2>
          {loading && <Loader2 className="h-3.5 w-3.5 animate-spin text-neutral-400" />}
          {!loading && docs.length > 0 && (
            <span className="font-mono text-[11px] text-neutral-400">{docs.length}</span>
          )}
        </div>

        {!loading && docs.length === 0 && (
          <div className="flex flex-col items-center rounded-2xl border border-dashed border-neutral-200 bg-white/60 px-6 py-16 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-neutral-100 text-neutral-400">
              <FileText className="h-5 w-5" strokeWidth={1.5} />
            </span>
            <p className="mt-4 text-[15px] font-semibold tracking-tight text-neutral-800">
              {t('home.empty')}
            </p>
            <p className="mt-1.5 max-w-xs text-[13px] leading-relaxed text-neutral-500">
              {t('home.emptySub')}
            </p>
            <button
              type="button"
              disabled={creating}
              onClick={() => void createDoc()}
              className="mt-6 inline-flex h-10 items-center gap-2 rounded-xl bg-neutral-900 px-4 text-[13px] font-semibold text-white hover:bg-neutral-800 disabled:opacity-50"
            >
              {creating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <FilePlus2 className="h-4 w-4" />
              )}
              {t('home.new')}
            </button>
          </div>
        )}

        {docs.length > 0 && (
          <ul className="grid gap-2 sm:grid-cols-2">
            {docs.map((d) => (
              <li key={d.id}>
                <div className="group flex items-stretch overflow-hidden rounded-2xl border border-neutral-200/90 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.03)] transition hover:border-neutral-300 hover:shadow-md">
                  <button
                    type="button"
                    onClick={() => router.push(`/studio/doc/${d.id}`)}
                    className="flex min-w-0 flex-1 items-start gap-3.5 p-4 text-left"
                  >
                    <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#f0ebe4] text-[#6b5344]">
                      <FileText className="h-4 w-4" strokeWidth={1.75} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[14px] font-semibold tracking-tight text-neutral-900">
                        {d.title || 'Untitled'}
                      </span>
                      <span className="mt-0.5 line-clamp-2 block text-[12px] leading-snug text-neutral-500">
                        {d.preview || (locale === 'es' ? 'Documento vacio' : 'Empty document')}
                      </span>
                      <span className="mt-2 block font-mono text-[10px] uppercase tracking-wide text-neutral-400">
                        {formatRelative(d.updatedAt, locale)}
                      </span>
                    </span>
                  </button>
                  <button
                    type="button"
                    title={locale === 'es' ? 'Eliminar' : 'Delete'}
                    onClick={() => void removeDoc(d.id)}
                    className="flex w-11 shrink-0 items-center justify-center border-l border-neutral-100 text-neutral-300 transition hover:bg-red-50 hover:text-red-600"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
