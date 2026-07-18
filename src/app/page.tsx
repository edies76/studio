'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowRight,
  ArrowUpRight,
  BookMarked,
  Check,
  ChevronRight,
  FileUp,
  GraduationCap,
  Layers3,
  PenLine,
  ScanSearch,
  Sigma,
  Sparkles,
  UploadCloud,
  X,
} from 'lucide-react';
import * as mammoth from 'mammoth';
import { useToast } from '@/hooks/use-toast';
import { parseAssignment } from '@/ai/flows/parse-assignment';
import { GAUSS_TALLER_RAW } from '@/lib/gauss-solver';
import { cn } from '@/lib/utils';
import BrandMark from '@/components/brand-mark';
import DocumentCanvasPreview from '@/components/document-canvas-preview';

type RevealProps = {
  children: React.ReactNode;
  className?: string;
  delay?: number;
};

function Reveal({ children, className, delay = 0 }: RevealProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.12 },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={cn('landing-reveal', visible && 'is-visible', className)}
      style={{ '--reveal-delay': `${delay}ms` } as React.CSSProperties}
    >
      {children}
    </div>
  );
}

function SectionRule({ children }: { children: React.ReactNode }) {
  return (
    <div className="section-rule">
      <span>{children}</span>
      <span className="section-rule__line" aria-hidden="true" />
    </div>
  );
}

/**
 * Product promise landing (`/`).
 * Real loop: brief/topic → /studio paper canvas → tools (normas + MATH-SAFE) → Accept/Reject → export.
 * Not a generic chat product page.
 */
export default function LandingPage() {
  const [topic, setTopic] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [briefText, setBriefText] = useState('');
  const [briefName, setBriefName] = useState<string | null>(null);
  const [parsing, setParsing] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const briefInputRef = useRef<HTMLInputElement>(null);
  const topicRef = useRef<HTMLTextAreaElement>(null);
  const { toast } = useToast();

  const focusTopic = useCallback(() => {
    document.getElementById('start')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    window.setTimeout(() => topicRef.current?.focus(), 420);
  }, []);

  const openBlankStudio = useCallback(() => {
    sessionStorage.removeItem('studioAssignment');
    sessionStorage.removeItem('studioBriefRaw');
    sessionStorage.removeItem('studioBriefActive');
    sessionStorage.removeItem('uploadedDocumentContent');
    router.push('/studio');
  }, [router]);

  const readFileText = async (file: File): Promise<string> => {
    if (file.type.startsWith('image/')) {
      const formData = new FormData();
      formData.append('file', file);
      const response = await fetch('/api/analyze-image', { method: 'POST', body: formData });
      if (!response.ok) throw new Error('No se pudo analizar la imagen');
      const result = await response.json();
      return result.description as string;
    }
    if (file.name.endsWith('.docx')) {
      const buf = await file.arrayBuffer();
      const result = await mammoth.extractRawText({ arrayBuffer: buf });
      return result.value;
    }
    if (file.name.endsWith('.pdf')) {
      const arrayBuffer = await file.arrayBuffer();
      const pdfjs = await import('pdfjs-dist');
      pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js';
      const pdf = await pdfjs.getDocument(arrayBuffer).promise;
      let text = '';
      for (let i = 1; i <= pdf.numPages; i += 1) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        text += content.items.map((item: any) => item.str).join(' ') + '\n';
      }
      return text;
    }
    return file.text();
  };

  const handleBriefFile = async (file: File) => {
    setParsing(true);
    try {
      const text = await readFileText(file);
      let enriched = text;
      if (/eliminaci[oó]n gaussiana|numpy\.linalg/i.test(text) && !/2x1|2x₁/i.test(text)) {
        enriched = `${text}\n\n${GAUSS_TALLER_RAW}`;
      }
      setBriefText(enriched);
      setBriefName(file.name);
      const brief = await parseAssignment({ text: enriched, fileName: file.name });
      sessionStorage.setItem('studioAssignment', JSON.stringify(brief));
      toast({
        title: 'Guía cargada',
        description: `${brief.title} · ${brief.tasks.length} tareas · ${brief.rubric.length} criterios`,
      });
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'No se pudo leer la guía',
        description: error?.message,
      });
    } finally {
      setParsing(false);
    }
  };

  const loadGaussExample = async () => {
    setParsing(true);
    try {
      setBriefText(GAUSS_TALLER_RAW);
      setBriefName('taller-gauss.docx');
      const brief = await parseAssignment({
        text: GAUSS_TALLER_RAW,
        fileName: 'gauss-taller.docx',
      });
      sessionStorage.setItem('studioAssignment', JSON.stringify(brief));
      setTopic(
        'Escribí el informe completo del taller de eliminación gaussiana: tres sistemas, gráficos, numpy y conclusiones en norma académica.',
      );
      toast({ title: 'Ejemplo de taller cargado' });
    } finally {
      setParsing(false);
    }
  };

  const openStudio = async () => {
    if (!topic.trim() && !briefText && files.length === 0) {
      toast({
        variant: 'destructive',
        title: 'Agregá un tema o una guía para empezar',
      });
      focusTopic();
      return;
    }

    setParsing(true);
    try {
      if (files.length) {
        const contents = await Promise.all(files.map(readFileText));
        sessionStorage.setItem('uploadedDocumentContent', contents.join('\n\n'));
      }
      if (briefText && !sessionStorage.getItem('studioAssignment')) {
        const brief = await parseAssignment({
          text: briefText,
          fileName: briefName || 'brief',
        });
        sessionStorage.setItem('studioAssignment', JSON.stringify(brief));
      }
      if (briefText) {
        sessionStorage.setItem('studioBriefRaw', briefText);
        sessionStorage.setItem('studioBriefActive', '1');
      } else {
        sessionStorage.removeItem('studioBriefActive');
        sessionStorage.removeItem('studioAssignment');
        sessionStorage.removeItem('studioBriefRaw');
      }
      const query = encodeURIComponent(
        topic.trim() || 'Creá un documento a partir de esta guía de taller.',
      );
      router.push(`/studio?topic=${query}`);
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error al preparar el workspace',
        description: error?.message,
      });
    } finally {
      setParsing(false);
    }
  };

  const onDrop = useCallback(async (event: React.DragEvent) => {
    event.preventDefault();
    setDragOver(false);
    const file = event.dataTransfer.files?.[0];
    if (file) await handleBriefFile(file);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="landing-page" data-theme="paper">
      <div className="landing-noise" aria-hidden="true" />

      <header className="landing-nav">
        <a className="landing-brand" href="#top" aria-label="Docs Studio">
          <BrandMark size={34} />
          <span className="landing-brand__name">Docs Studio</span>
          <span className="landing-brand__descriptor">Workspace académico</span>
        </a>

        <nav className="landing-nav__links" aria-label="Secciones">
          <a href="#promesa">Promesa</a>
          <a href="#flujo">Flujo</a>
          <a href="#real">Qué hace de verdad</a>
          <a href="/home">Biblioteca</a>
          <a href="/mcp">MCP</a>
        </nav>

        <button type="button" className="landing-nav__cta" onClick={focusTopic}>
          Empezar documento
          <ArrowUpRight size={15} strokeWidth={1.8} />
        </button>
      </header>

      <main id="top">
        {/* HERO */}
        <section className="landing-hero" aria-labelledby="hero-heading">
          <div className="landing-wrap landing-hero__grid">
            <div className="landing-hero__copy">
              <Reveal>
                <div className="landing-eyebrow">
                  <span className="landing-eyebrow__mark" aria-hidden="true" />
                  Docs Studio · no es un chat genérico
                </div>
              </Reveal>

              <Reveal delay={60}>
                <h1 id="hero-heading">
                  Workspace académico.
                  <br />
                  <span className="landing-heading-accent">El papel es la verdad.</span>
                </h1>
              </Reveal>

              <Reveal delay={120}>
                <p className="landing-hero__lede">
                  Traé la guía del profesor, un tema o un .docx. Trabajás sobre un lienzo tipo Word
                  (páginas Letter/Legal), con un agente que propone cambios, aplica normas APA/IEEE y
                  edita ecuaciones sin romper el LaTeX. Vos aceptás o rechazás cada propuesta.
                </p>
              </Reveal>

              <Reveal delay={150}>
                <div className="landing-hero__facts" aria-label="Promesa del producto">
                  <div>
                    <span>Fuente de verdad</span>
                    <strong>Papel, no el chat</strong>
                  </div>
                  <div>
                    <span>Normas reales</span>
                    <strong>APA · IEEE · MLA</strong>
                  </div>
                  <div>
                    <span>Matemáticas</span>
                    <strong>MATH-SAFE</strong>
                  </div>
                </div>
              </Reveal>

              <Reveal delay={180}>
                <div className="landing-start-card" id="start">
                  <div className="landing-start-card__topline">
                    <span>Tema, guía de taller o archivo</span>
                    <span className="landing-start-card__state" aria-live="polite">
                      {parsing ? 'Preparando workspace…' : 'Cada cambio lo decidís vos'}
                    </span>
                  </div>

                  <label htmlFor="topic" className="sr-only">
                    Tema o instrucción
                  </label>
                  <textarea
                    ref={topicRef}
                    id="topic"
                    value={topic}
                    onChange={(event) => setTopic(event.target.value)}
                    rows={3}
                    placeholder="Ej: Informe del taller de álgebra lineal, tres sistemas, conclusiones APA…"
                    className="landing-topic-input"
                  />

                  <div
                    className={cn('landing-upload-zone', dragOver && 'is-dragging')}
                    onDragOver={(event) => {
                      event.preventDefault();
                      setDragOver(true);
                    }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={onDrop}
                  >
                    <div className="landing-upload-zone__icon" aria-hidden="true">
                      <UploadCloud size={17} strokeWidth={1.6} />
                    </div>
                    <div className="landing-upload-zone__copy">
                      <strong>Adjuntá la guía</strong>
                      <span>DOCX, PDF, TXT o imagen del enunciado</span>
                    </div>
                    <button
                      type="button"
                      className="landing-text-button"
                      onClick={() => briefInputRef.current?.click()}
                      disabled={parsing}
                    >
                      Elegir archivo
                      <ChevronRight size={14} strokeWidth={1.8} />
                    </button>
                  </div>

                  <div className="landing-start-card__actions">
                    <button
                      type="button"
                      className="landing-primary-button"
                      onClick={openStudio}
                      disabled={parsing}
                    >
                      {parsing ? 'Preparando…' : 'Abrir en el workspace'}
                      <span aria-hidden="true">
                        <ArrowRight size={16} strokeWidth={1.8} />
                      </span>
                    </button>
                    <button
                      type="button"
                      className="landing-quiet-button"
                      onClick={loadGaussExample}
                      disabled={parsing}
                    >
                      <Sparkles size={14} strokeWidth={1.7} />
                      Ejemplo: taller Gauss
                    </button>
                  </div>

                  {briefName && (
                    <div className="landing-file-chip">
                      <Check size={13} strokeWidth={2} />
                      <span>{briefName}</span>
                      <button
                        type="button"
                        aria-label={`Quitar ${briefName}`}
                        onClick={() => {
                          setBriefName(null);
                          setBriefText('');
                          sessionStorage.removeItem('studioAssignment');
                        }}
                      >
                        <X size={13} strokeWidth={1.8} />
                      </button>
                    </div>
                  )}

                  {files.length > 0 && (
                    <div className="landing-file-chip landing-file-chip--muted">
                      <FileUp size={13} strokeWidth={1.8} />
                      <span>
                        {files.length} archivo{files.length > 1 ? 's' : ''} de contexto
                      </span>
                      <button type="button" aria-label="Quitar archivos" onClick={() => setFiles([])}>
                        <X size={13} strokeWidth={1.8} />
                      </button>
                    </div>
                  )}

                  <button
                    type="button"
                    className="landing-add-context"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    + Añadir contexto extra
                  </button>

                  <button type="button" className="landing-blank-button" onClick={openBlankStudio}>
                    Documento en blanco en /studio
                    <ArrowUpRight size={13} strokeWidth={1.8} />
                  </button>

                  <input
                    ref={briefInputRef}
                    type="file"
                    className="sr-only"
                    accept=".docx,.pdf,.txt,.md"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file) void handleBriefFile(file);
                    }}
                  />
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    className="sr-only"
                    accept=".txt,.md,.html,.docx,.pdf,image/*"
                    onChange={(event) =>
                      setFiles((current) => [...current, ...Array.from(event.target.files || [])])
                    }
                  />
                </div>
              </Reveal>
            </div>

            <Reveal className="landing-hero__visual" delay={120}>
              <div className="document-frame">
                <DocumentCanvasPreview />
              </div>
            </Reveal>
          </div>

          <div className="landing-hero__edge-label" aria-hidden="true">
            <span>01</span>
            <span>WORKSPACE · NO CHAT</span>
          </div>
        </section>

        {/* PROMESA */}
        <section id="promesa" className="landing-section landing-method" aria-labelledby="promesa-heading">
          <div className="landing-wrap">
            <Reveal>
              <SectionRule>La promesa del producto</SectionRule>
            </Reveal>
            <Reveal delay={70}>
              <div className="landing-section-heading landing-section-heading--wide">
                <h2 id="promesa-heading">
                  Workspace académico, no un chat genérico.
                </h2>
                <p>
                  El chat es un copiloto al costado. Lo que importa es el documento en el lienzo:
                  tipografía, tablas, ecuaciones MathJax, normas de estilo y export a PDF/Word.
                  La IA no reescribe en silencio: propone; vos aceptás o rechazás.
                </p>
              </div>
            </Reveal>

            <div className="principles-grid" style={{ marginTop: '2rem' }}>
              {[
                {
                  n: '01',
                  title: 'Papel = fuente de verdad',
                  text: 'Lienzo Letter/Legal con márgenes, zoom, historial y toolbar. El transcript del chat no es el entregable.',
                },
                {
                  n: '02',
                  title: 'Normas con niveles reales',
                  text: 'Tools → Aplicar normas: APA (máximo rigor) → IEEE → MLA → Simple → Mínimo. Brief completo al agente, no un slogan.',
                },
                {
                  n: '03',
                  title: 'MATH-SAFE de verdad',
                  text: 'list_equations / edit_equation / insert_equation. Si un rewrite pierde LaTeX, el servidor lo restaura. Logs solo en el server.',
                },
              ].map((card, i) => (
                <Reveal key={card.n} delay={i * 70} className="principle-card principle-card--small">
                  <div className="principle-card__number">{card.n}</div>
                  <h3>{card.title}</h3>
                  <p>{card.text}</p>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* FLUJO DE RUTAS */}
        <section id="flujo" className="landing-section landing-canvas-story" aria-labelledby="flujo-heading">
          <div className="landing-wrap">
            <Reveal>
              <SectionRule>Mapa de la app</SectionRule>
            </Reveal>
            <Reveal delay={60}>
              <div className="landing-section-heading landing-section-heading--wide">
                <h2 id="flujo-heading">Un flujo claro, sin páginas engañosas.</h2>
                <p>
                  Cada ruta tiene un rol. No hay “home” que sea a la vez marketing y editor.
                </p>
              </div>
            </Reveal>

            <div className="method-rail" role="list" style={{ marginTop: '1.5rem' }}>
              {[
                {
                  path: '/',
                  title: 'Landing',
                  text: 'Promesa del producto + arranque con tema o guía de taller. Estás aquí.',
                  icon: ScanSearch,
                },
                {
                  path: '/home',
                  title: 'Biblioteca',
                  text: 'Tus documentos recientes, crear en blanco, abrir o borrar. Login Google opcional.',
                  icon: Layers3,
                },
                {
                  path: '/studio',
                  title: 'Workspace',
                  text: 'Lienzo + agente + Tools (normas, improve…) + Accept/Reject + export PDF/DOCX.',
                  icon: PenLine,
                },
                {
                  path: '/login',
                  title: 'Cuenta',
                  text: 'Google OAuth para guardar en la nube; sin cuenta = modo local en el servidor.',
                  icon: GraduationCap,
                },
              ].map(({ path, title, text, icon: Icon }, index) => (
                <Reveal key={path} delay={index * 70} className="method-item">
                  <div className="method-item__icon" aria-hidden="true">
                    <Icon size={18} strokeWidth={1.55} />
                  </div>
                  <div className="method-item__body">
                    <span className="method-item__index">{path}</span>
                    <h3>{title}</h3>
                    <p>{text}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* QUÉ HACE DE VERDAD */}
        <section id="real" className="landing-section landing-context" aria-labelledby="real-heading">
          <div className="landing-wrap landing-context__grid">
            <Reveal className="landing-context__visual">
              <div className="landing-paper-shell">
                <div className="landing-paper-shell__bar">
                  <span className="landing-paper-shell__title">taller-gauss.docx</span>
                  <span className="landing-paper-shell__status">MATH-SAFE · on</span>
                </div>
                <article className="landing-paper">
                  <div className="landing-paper__margin" aria-hidden="true">
                    <span>R</span>
                    <span>01</span>
                  </div>
                  <div className="landing-paper__content">
                    <span className="landing-paper__kicker">En el lienzo</span>
                    <h3>Eliminación gaussiana</h3>
                    <p>
                      El agente inventaría la ecuación #0, la edita con{' '}
                      <code style={{ fontSize: '0.85em' }}>edit_equation</code> y propone el
                      cambio. El LaTeX no se convierte en basura de chat.
                    </p>
                    <div className="landing-paper__proposal">
                      <div className="landing-paper__proposal-line" aria-hidden="true" />
                      <div>
                        <span>Propuesta</span>
                        <strong>Ecuación #0 · Aceptar / Rechazar</strong>
                      </div>
                      <Check size={16} strokeWidth={1.75} aria-hidden="true" />
                    </div>
                    <p className="landing-paper__faded">
                      Tools → Aplicar normas → APA aplica brief de rigor; Min solo limpia lo obvio.
                    </p>
                  </div>
                </article>
              </div>
            </Reveal>

            <Reveal className="landing-context__copy" delay={100}>
              <SectionRule>Capacidades reales (no marketing)</SectionRule>
              <h2 id="real-heading">Lo que el producto ya hace.</h2>
              <div className="context-list">
                <div>
                  <BookMarked size={14} strokeWidth={2} />
                  <span>
                    <strong>Aplicar normas</strong> — APA, IEEE, MLA, Simple, Mínimo (de más exigente a más breve)
                  </span>
                </div>
                <div>
                  <Sigma size={14} strokeWidth={2} />
                  <span>
                    <strong>Ecuaciones</strong> — MathJax, hosts <code>data-tex</code>, tools del agente + protector server-side
                  </span>
                </div>
                <div>
                  <Check size={14} strokeWidth={2} />
                  <span>
                    <strong>Diff Accept/Reject</strong> — ningún cambio de IA se aplica sin tu OK
                  </span>
                </div>
                <div>
                  <FileUp size={14} strokeWidth={2} />
                  <span>
                    <strong>Import .docx</strong> y export PDF / Word desde el editor
                  </span>
                </div>
                <div>
                  <ScanSearch size={14} strokeWidth={2} />
                  <span>
                    <strong>Parser de guía</strong> — tareas, rúbrica y objetivos del taller en contexto del agente
                  </span>
                </div>
                <div>
                  <Layers3 size={14} strokeWidth={2} />
                  <span>
                    <strong>/home</strong> — biblioteca con autosave (local o cuenta Google)
                  </span>
                </div>
              </div>
              <p style={{ marginTop: '1rem', fontSize: '0.92rem', opacity: 0.85 }}>
                Lo que <em>no</em> prometemos: magia de “un prompt y listo el paper perfecto”, ni
                sincronizar el MCP con la pestaña del navegador sin bridge explícito.
              </p>
              <button type="button" className="landing-secondary-button" onClick={focusTopic}>
                Empezar con mi guía
                <ArrowRight size={15} strokeWidth={1.8} />
              </button>
            </Reveal>
          </div>
        </section>

        {/* METHOD STEPS */}
        <section id="method" className="landing-section landing-principles" aria-labelledby="method-heading">
          <div className="landing-wrap">
            <Reveal>
              <div className="landing-section-heading landing-section-heading--compact">
                <h2 id="method-heading">De la guía al entregable.</h2>
                <p>
                  Cuatro pasos reales del loop de Docs Studio — el mismo en la UI y en MCP.
                </p>
              </div>
            </Reveal>

            <div className="method-rail" role="list">
              {[
                {
                  title: 'Capturar',
                  text: 'Tema, DOCX/PDF de la guía, o imagen del enunciado. El parser saca tareas y rúbrica.',
                  icon: ScanSearch,
                },
                {
                  title: 'Borrador en papel',
                  text: 'El primer draft se streamé al lienzo paginado — no a un bubble de chat.',
                  icon: Layers3,
                },
                {
                  title: 'Dirigir',
                  text: 'Selección + Tools (Improve, Normas APA…) o chat. Propuestas con Accept/Reject.',
                  icon: PenLine,
                },
                {
                  title: 'Entregar',
                  text: 'Márgenes, tablas, ecuaciones legibles → export PDF o .docx del servidor.',
                  icon: ArrowUpRight,
                },
              ].map(({ title, text, icon: Icon }, index) => (
                <Reveal key={title} delay={index * 70} className="method-item">
                  <div className="method-item__icon" aria-hidden="true">
                    <Icon size={18} strokeWidth={1.55} />
                  </div>
                  <div className="method-item__body">
                    <span className="method-item__index">{String(index + 1).padStart(2, '0')}</span>
                    <h3>{title}</h3>
                    <p>{text}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        <section className="landing-final" aria-labelledby="final-heading">
          <div className="landing-final__grid" aria-hidden="true" />
          <div className="landing-wrap landing-final__content">
            <Reveal>
              <span className="landing-final__label">La promesa, en una línea</span>
              <h2 id="final-heading">Workspace académico. El papel es la verdad.</h2>
              <p>
                Traé la guía imperfecta. Trabajá en el lienzo. Que la IA proponga; que vos decidas.
                Exportá cuando el documento esté listo para entregar.
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  className="landing-primary-button landing-primary-button--large"
                  onClick={focusTopic}
                >
                  Empezar documento
                  <span aria-hidden="true">
                    <ArrowUpRight size={17} strokeWidth={1.8} />
                  </span>
                </button>
                <button
                  type="button"
                  className="landing-quiet-button"
                  onClick={() => router.push('/home')}
                  style={{ alignSelf: 'center' }}
                >
                  Ir a la biblioteca
                </button>
              </div>
            </Reveal>
          </div>
        </section>
      </main>

      <footer className="landing-footer">
        <div className="landing-wrap landing-footer__inner">
          <div className="landing-brand landing-brand--footer">
            <BrandMark size={28} />
            <span className="landing-brand__name">Docs Studio</span>
          </div>
          <span>Workspace académico · no un chat genérico</span>
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
            <a href="/studio">/studio</a>
            <a href="/home">/home</a>
            <a href="/mcp">/mcp</a>
            <a href="#top">
              Arriba <ArrowUpRight size={13} strokeWidth={1.7} />
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
