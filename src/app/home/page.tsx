'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession, signIn, signOut } from 'next-auth/react';
import {
  FilePlus2,
  FileText,
  Loader2,
  LogIn,
  LogOut,
  MoreHorizontal,
  Trash2,
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

function formatRelative(ts: number) {
  const d = Date.now() - ts;
  const m = Math.floor(d / 60000);
  if (m < 1) return 'Ahora';
  if (m < 60) return `Hace ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `Hace ${h} h`;
  const days = Math.floor(h / 24);
  if (days < 14) return `Hace ${days} d`;
  return new Date(ts).toLocaleDateString();
}

export default function HomePage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const { toast } = useToast();
  const { t } = useLocale();
  const [docs, setDocs] = useState<DocItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [guest, setGuest] = useState(true);
  const [userLabel, setUserLabel] = useState('Invitado local');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/docs');
      // Guest is always allowed unless FORCE_AUTH=1 on server
      if (res.status === 401) {
        toast({
          title: 'Sesión requerida',
          description: 'El servidor está en FORCE_AUTH. Entrá con Google o desactivá FORCE_AUTH.',
        });
        return;
      }
      const data = await res.json();
      setDocs(data.docs || []);
      setGuest(Boolean(data.user?.guest ?? true));
      setUserLabel(
        data.user?.guest
          ? 'Invitado (sin cuenta)'
          : data.user?.name || data.user?.email || 'Usuario',
      );
    } catch {
      toast({ variant: 'destructive', title: 'No se pudieron cargar los documentos' });
    } finally {
      setLoading(false);
    }
  }, [router, toast]);

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
        title: 'No se pudo crear',
        description: e?.message,
      });
    } finally {
      setCreating(false);
    }
  };

  const removeDoc = async (id: string) => {
    if (!confirm('¿Eliminar este documento?')) return;
    try {
      const res = await fetch(`/api/docs/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('delete failed');
      setDocs((d) => d.filter((x) => x.id !== id));
    } catch {
      toast({ variant: 'destructive', title: 'No se pudo eliminar' });
    }
  };

  return (
    <div className="min-h-[100dvh] overflow-y-auto bg-[#f7f6f3] text-neutral-900">
      {/* Top bar — minimal Docs-like */}
      <header className="sticky top-0 z-20 border-b border-neutral-200/80 bg-[#f7f6f3]/90 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4 sm:px-6">
          <a href="/" className="flex items-center gap-2.5 no-underline">
            <BrandMark size={28} />
            <span className="text-[15px] font-semibold tracking-tight text-neutral-900">
              Docs Studio
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
                className="flex h-9 items-center gap-1.5 rounded-full bg-neutral-900 px-3.5 text-[12px] font-semibold text-white shadow-sm hover:bg-neutral-800"
              >
                <LogIn className="h-3.5 w-3.5" />
                {t('home.google')}
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
        <div className="mb-8 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-neutral-400">
              {t('home.library')}
            </p>
            <h1 className="mt-1 text-[28px] font-semibold tracking-tight text-neutral-900">
              {t('home.title')}
            </h1>
            <p className="mt-1 text-[13px] text-neutral-500">
              {guest ? t('home.guest') : userLabel}
            </p>
          </div>
          <button
            type="button"
            disabled={creating}
            onClick={() => void createDoc()}
            className={cn(
              'mt-4 inline-flex h-11 items-center justify-center gap-2 rounded-full bg-neutral-900 px-5',
              'text-[13px] font-semibold text-white shadow-md transition hover:bg-neutral-800',
              'disabled:opacity-50 sm:mt-0',
            )}
          >
            {creating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <FilePlus2 className="h-4 w-4" />
            )}
            {t('home.blank')}
          </button>
        </div>

        {/* Quick start cards */}
        <div className="mb-10 grid gap-3 sm:grid-cols-3">
          <button
            type="button"
            onClick={() => void createDoc('Untitled')}
            className="group flex flex-col items-start rounded-2xl border border-dashed border-neutral-300 bg-white/70 p-5 text-left transition hover:border-neutral-400 hover:bg-white hover:shadow-sm"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-neutral-100 text-neutral-700 group-hover:bg-neutral-900 group-hover:text-white">
              <FilePlus2 className="h-5 w-5" />
            </span>
            <span className="mt-3 text-[14px] font-semibold">{t('home.blank')}</span>
            <span className="mt-0.5 text-[12px] text-neutral-500">/studio</span>
          </button>
          <button
            type="button"
            onClick={() => router.push('/')}
            className="group flex flex-col items-start rounded-2xl border border-neutral-200 bg-white p-5 text-left shadow-sm transition hover:shadow-md"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-neutral-100 text-neutral-700">
              <FileText className="h-5 w-5" />
            </span>
            <span className="mt-3 text-[14px] font-semibold">{t('home.fromGuide')}</span>
            <span className="mt-0.5 text-[12px] text-neutral-500">{t('home.fromGuideSub')}</span>
          </button>
          <a
            href="/studio"
            onClick={(e) => {
              e.preventDefault();
              void createDoc('Import / edit');
            }}
            className="group flex flex-col items-start rounded-2xl border border-neutral-200 bg-white p-5 text-left shadow-sm transition hover:shadow-md"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-neutral-100 text-neutral-700">
              <MoreHorizontal className="h-5 w-5" />
            </span>
            <span className="mt-3 text-[14px] font-semibold">{t('home.openStudio')}</span>
            <span className="mt-0.5 text-[12px] text-neutral-500">{t('home.openStudioSub')}</span>
          </a>
        </div>

        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-[13px] font-semibold text-neutral-700">{t('home.recent')}</h2>
          {loading && <Loader2 className="h-3.5 w-3.5 animate-spin text-neutral-400" />}
        </div>

        {!loading && docs.length === 0 && (
          <div className="rounded-2xl border border-neutral-200 bg-white px-6 py-14 text-center shadow-sm">
            <FileText className="mx-auto h-8 w-8 text-neutral-300" />
            <p className="mt-3 text-[14px] font-medium text-neutral-700">{t('home.empty')}</p>
            <p className="mt-1 text-[12px] text-neutral-500">{t('home.emptySub')}</p>
          </div>
        )}

        <ul className="divide-y divide-neutral-100 overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
          {docs.map((d) => (
            <li key={d.id}>
              <div className="flex items-center gap-3 px-4 py-3.5 transition hover:bg-neutral-50/80 sm:px-5">
                <button
                  type="button"
                  onClick={() => router.push(`/studio/doc/${d.id}`)}
                  className="flex min-w-0 flex-1 items-start gap-3 text-left"
                >
                  <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-neutral-100 text-neutral-600">
                    <FileText className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14px] font-semibold text-neutral-900">
                      {d.title || 'Untitled'}
                    </span>
                    <span className="mt-0.5 block truncate text-[12px] text-neutral-500">
                      {d.preview || 'Documento vacío'}
                    </span>
                  </span>
                  <span className="hidden shrink-0 text-[11px] text-neutral-400 sm:block">
                    {formatRelative(d.updatedAt)}
                  </span>
                </button>
                <button
                  type="button"
                  title="Eliminar"
                  onClick={() => void removeDoc(d.id)}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-neutral-400 hover:bg-red-50 hover:text-red-600"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      </main>
    </div>
  );
}
