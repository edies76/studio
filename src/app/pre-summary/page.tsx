'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  ChevronRight,
  FileUp,
  Layers3,
  MousePointer2,
  PenLine,
  ScanSearch,
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
import SignalField from '@/components/signal-field';

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

export default function PreSummaryPage() {
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

  const readFileText = async (file: File): Promise<string> => {
    if (file.type.startsWith('image/')) {
      const formData = new FormData();
      formData.append('file', file);
      const response = await fetch('/api/analyze-image', { method: 'POST', body: formData });
      if (!response.ok) throw new Error('Image analysis failed');
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
        title: 'Brief loaded',
        description: `${brief.title} · ${brief.tasks.length} tasks · ${brief.rubric.length} criteria`,
      });
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Could not read brief', description: error?.message });
    } finally {
      setParsing(false);
    }
  };

  const loadGaussExample = async () => {
    setParsing(true);
    try {
      setBriefText(GAUSS_TALLER_RAW);
      setBriefName('colgii17_t2_tra.docx');
      const brief = await parseAssignment({ text: GAUSS_TALLER_RAW, fileName: 'gauss-taller.docx' });
      sessionStorage.setItem('studioAssignment', JSON.stringify(brief));
      setTopic(
        'Write the complete report for the Gaussian elimination workshop: three systems, charts, numpy, and APA conclusions.',
      );
      toast({ title: 'Sample brief loaded' });
    } finally {
      setParsing(false);
    }
  };

  const openStudio = async () => {
    if (!topic.trim() && !briefText && files.length === 0) {
      toast({ variant: 'destructive', title: 'Add a topic or attach a brief to begin' });
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
        const brief = await parseAssignment({ text: briefText, fileName: briefName || 'brief' });
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
      const query = encodeURIComponent(topic.trim() || 'Create a document from this brief.');
      router.push(`/?topic=${query}`);
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error preparing workspace', description: error?.message });
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
    <div className="landing-page">
      <div className="landing-noise" aria-hidden="true" />

      <header className="landing-nav">
        <a className="landing-brand" href="#top" aria-label="Docs Studio home">
          <BrandMark size={34} />
          <span className="landing-brand__name">Docs Studio</span>
          <span className="landing-brand__descriptor">Write from the brief</span>
        </a>

        <nav className="landing-nav__links" aria-label="Page sections">
          <a href="#method">Method</a>
          <a href="#canvas">Canvas</a>
          <a href="#context">Context</a>
        </nav>

        <button type="button" className="landing-nav__cta" onClick={focusTopic}>
          Begin a document
          <ArrowUpRight size={15} strokeWidth={1.8} />
        </button>
      </header>

      <main id="top">
        <section className="landing-hero" aria-labelledby="hero-heading">
          <div className="landing-wrap landing-hero__grid">
            <div className="landing-hero__copy">
              <Reveal>
                <div className="landing-eyebrow">
                  <span className="landing-eyebrow__mark" aria-hidden="true" />
                  Documents, with a signal
                </div>
              </Reveal>

              <Reveal delay={60}>
                <h1 id="hero-heading">
                  Make the blank
                  <br />
                  <span className="landing-heading-accent">page useful.</span>
                </h1>
              </Reveal>

              <Reveal delay={120}>
                <p className="landing-hero__lede">
                  Docs Studio turns a topic or professor&apos;s brief into a document you can shape, review, and export.
                </p>
              </Reveal>

              <Reveal delay={180}>
                <div className="landing-start-card" id="start">
                  <div className="landing-start-card__topline">
                    <span>Start with what you have</span>
                    <span className="landing-start-card__state" aria-live="polite">
                      {parsing ? 'Preparing workspace' : 'Ready when you are'}
                    </span>
                  </div>

                  <label htmlFor="topic" className="sr-only">
                    Topic or instruction
                  </label>
                  <textarea
                    ref={topicRef}
                    id="topic"
                    value={topic}
                    onChange={(event) => setTopic(event.target.value)}
                    rows={3}
                    placeholder="Describe the document you need..."
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
                      <strong>Attach a brief</strong>
                      <span>DOCX, PDF, TXT, or an image</span>
                    </div>
                    <button
                      type="button"
                      className="landing-text-button"
                      onClick={() => briefInputRef.current?.click()}
                      disabled={parsing}
                    >
                      Choose file
                      <ChevronRight size={14} strokeWidth={1.8} />
                    </button>
                  </div>

                  <div className="landing-start-card__actions">
                    <button type="button" className="landing-primary-button" onClick={openStudio} disabled={parsing}>
                      {parsing ? 'Preparing...' : 'Begin a document'}
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
                      Try the sample brief
                    </button>
                  </div>

                  {briefName && (
                    <div className="landing-file-chip">
                      <Check size={13} strokeWidth={2} />
                      <span>{briefName}</span>
                      <button
                        type="button"
                        aria-label={`Remove ${briefName}`}
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
                      <span>{files.length} context file{files.length > 1 ? 's' : ''} attached</span>
                      <button
                        type="button"
                        aria-label="Remove context files"
                        onClick={() => setFiles([])}
                      >
                        <X size={13} strokeWidth={1.8} />
                      </button>
                    </div>
                  )}

                  <button
                    type="button"
                    className="landing-add-context"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    + Add extra context files
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
                    onChange={(event) => setFiles((current) => [...current, ...Array.from(event.target.files || [])])}
                  />
                </div>
              </Reveal>
            </div>

            <Reveal className="landing-hero__visual" delay={120}>
              <div className="signal-frame">
                <SignalField />
                <div className="signal-frame__topline">
                  <span>Interactive field</span>
                  <span>Pointer responsive</span>
                </div>
                <div className="signal-frame__caption">
                  <div>
                    <span className="signal-frame__caption-label">Structure, before polish</span>
                    <strong>Ideas become visible when they have a shape.</strong>
                  </div>
                  <MousePointer2 size={17} strokeWidth={1.45} aria-hidden="true" />
                </div>
                <div className="signal-frame__legend" aria-label="Document transformation stages">
                  <span><i className="signal-legend__line signal-legend__line--acid" />Topic</span>
                  <span><i className="signal-legend__line signal-legend__line--coral" />Structure</span>
                  <span><i className="signal-legend__line signal-legend__line--white" />Voice</span>
                </div>
              </div>
            </Reveal>
          </div>

          <div className="landing-hero__edge-label" aria-hidden="true">
            <span>01</span>
            <span>START ANYWHERE</span>
          </div>
        </section>

        <section id="method" className="landing-section landing-method" aria-labelledby="method-heading">
          <div className="landing-wrap">
            <Reveal>
              <SectionRule>From the first sentence to the final file</SectionRule>
            </Reveal>
            <Reveal delay={70}>
              <div className="landing-section-heading landing-section-heading--wide">
                <h2 id="method-heading">Structure appears before the prose.</h2>
                <p>
                  The work stays legible from the first prompt to the last export. You can always see what changed and why.
                </p>
              </div>
            </Reveal>

            <div className="method-rail" role="list">
              {[
                {
                  title: 'Capture',
                  text: 'Paste a topic, drop a brief, or start empty. Context is optional.',
                  icon: ScanSearch,
                },
                {
                  title: 'Shape',
                  text: 'A first draft arrives in the canvas, section by section.',
                  icon: Layers3,
                },
                {
                  title: 'Direct',
                  text: 'Ask for a rewrite, then accept or reject the exact change.',
                  icon: PenLine,
                },
                {
                  title: 'Export',
                  text: 'Take the finished document to PDF or Word when it is ready.',
                  icon: ArrowUpRight,
                },
              ].map(({ title, text, icon: Icon }, index) => (
                <Reveal key={title} delay={index * 70} className="method-item" >
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

        <section id="canvas" className="landing-section landing-canvas-story" aria-labelledby="canvas-heading">
          <div className="landing-wrap landing-canvas-story__grid">
            <Reveal className="landing-canvas-story__copy">
              <div className="landing-micro-label">The canvas is the source of truth</div>
              <h2 id="canvas-heading">Every suggestion has a paper trail.</h2>
              <p>
                The document stays in view while the conversation works beside it. Drafts land in the canvas. Rewrites arrive as visible proposals.
              </p>
              <a className="landing-inline-link" href="#context">
                See what stays under your control
                <ArrowUpRight size={15} strokeWidth={1.8} />
              </a>
            </Reveal>

            <Reveal className="landing-paper-shell" delay={120}>
              <div className="landing-paper-shell__bar">
                <span className="landing-paper-shell__title">Untitled document</span>
                <span className="landing-paper-shell__status">Review mode</span>
              </div>
              <article className="landing-paper">
                <div className="landing-paper__margin" aria-hidden="true">
                  <span>R</span>
                  <span>01</span>
                </div>
                <div className="landing-paper__content">
                  <span className="landing-paper__kicker">Working draft</span>
                  <h3>The impact of clear structure</h3>
                  <p>
                    A useful document does not hide its logic. It lets the reader feel the order of the argument before asking them to carry its weight.
                  </p>
                  <p>
                    In this canvas, the model can suggest a stronger turn. The author still decides whether that turn belongs.
                  </p>
                  <div className="landing-paper__proposal">
                    <div className="landing-paper__proposal-line" aria-hidden="true" />
                    <div>
                      <span>Proposed rewrite</span>
                      <strong>Make the next sentence do less work.</strong>
                    </div>
                    <Check size={16} strokeWidth={1.75} aria-label="Proposal can be accepted" />
                  </div>
                  <p className="landing-paper__faded">
                    The result is a draft that can be challenged, edited, and made yours.
                  </p>
                </div>
              </article>
            </Reveal>
          </div>
        </section>

        <section id="context" className="landing-section landing-context" aria-labelledby="context-heading">
          <div className="landing-wrap landing-context__grid">
            <Reveal className="landing-context__visual">
              <div className="context-orbit landing-scroll-lift" aria-hidden="true">
                <div className="context-orbit__ring context-orbit__ring--outer" />
                <div className="context-orbit__ring context-orbit__ring--inner" />
                <div className="context-orbit__core">
                  <FileUp size={21} strokeWidth={1.45} />
                  <span>your context</span>
                </div>
                <span className="context-orbit__tag context-orbit__tag--docx">DOCX</span>
                <span className="context-orbit__tag context-orbit__tag--pdf">PDF</span>
                <span className="context-orbit__tag context-orbit__tag--txt">TXT</span>
                <span className="context-orbit__tag context-orbit__tag--image">IMAGE</span>
              </div>
            </Reveal>

            <Reveal className="landing-context__copy" delay={100}>
              <SectionRule>Bring the messy part</SectionRule>
              <h2 id="context-heading">The brief can stay imperfect.</h2>
              <p>
                Attach the rubric, source file, or screenshot. The topic can stay short. Docs Studio uses the context you already have without making you format it first.
              </p>
              <div className="context-list">
                <div>
                  <Check size={14} strokeWidth={2} />
                  <span>Optional professor brief parsing</span>
                </div>
                <div>
                  <Check size={14} strokeWidth={2} />
                  <span>Math-aware document editing</span>
                </div>
                <div>
                  <Check size={14} strokeWidth={2} />
                  <span>PDF and Word export</span>
                </div>
              </div>
              <button type="button" className="landing-secondary-button" onClick={focusTopic}>
                Bring in a brief
                <ArrowRight size={15} strokeWidth={1.8} />
              </button>
            </Reveal>
          </div>
        </section>

        <section className="landing-section landing-principles" aria-labelledby="principles-heading">
          <div className="landing-wrap">
            <Reveal>
              <div className="landing-section-heading landing-section-heading--compact">
                <h2 id="principles-heading">The useful parts are visible.</h2>
                <p>Small decisions add up to a document that feels like work, not a black box.</p>
              </div>
            </Reveal>

            <div className="principles-grid">
              <Reveal className="principle-card principle-card--large">
                <div className="principle-card__number">01</div>
                <div>
                  <h3>Direct edits</h3>
                  <p>No silent rewrites. Proposed changes stay visible until you accept them.</p>
                </div>
                <div className="principle-card__line" aria-hidden="true" />
              </Reveal>
              <Reveal className="principle-card principle-card--small" delay={80}>
                <div className="principle-card__icon" aria-hidden="true"><MousePointer2 size={18} strokeWidth={1.5} /></div>
                <h3>Human control</h3>
                <p>The prompt starts the work. Your judgment finishes it.</p>
              </Reveal>
              <Reveal className="principle-card principle-card--tall" delay={140}>
                <div className="principle-card__icon" aria-hidden="true"><Sparkles size={18} strokeWidth={1.5} /></div>
                <h3>Math that survives export</h3>
                <p>Keep formulas legible as the document moves from canvas to final file.</p>
                <span className="principle-card__formula" aria-hidden="true">∑ f(x) → PDF</span>
              </Reveal>
            </div>
          </div>
        </section>

        <section className="landing-final" aria-labelledby="final-heading">
          <div className="landing-final__grid" aria-hidden="true" />
          <div className="landing-wrap landing-final__content">
            <Reveal>
              <span className="landing-final__label">No perfect starting point required</span>
              <h2 id="final-heading">Start with one clear sentence.</h2>
              <p>A title, a question, or a professor&apos;s brief is enough to begin.</p>
              <button type="button" className="landing-primary-button landing-primary-button--large" onClick={focusTopic}>
                Begin a document
                <span aria-hidden="true"><ArrowUpRight size={17} strokeWidth={1.8} /></span>
              </button>
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
          <span>Write from the brief. Keep the decision.</span>
          <a href="#top">Back to top <ArrowUpRight size={13} strokeWidth={1.7} /></a>
        </div>
      </footer>
    </div>
  );
}
