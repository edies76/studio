'use client';

import Link from 'next/link';
import DocumentCanvasPreview from '@/components/document-canvas-preview';
import LandingNav from '@/components/landing-nav';
import { useLocale } from '@/lib/i18n/locale-context';

export default function LandingPageClient() {
  const { t } = useLocale();

  const capabilities = [
    ['01', t('cap.1.t'), t('cap.1.b')],
    ['02', t('cap.2.t'), t('cap.2.b')],
    ['03', t('cap.3.t'), t('cap.3.b')],
    ['04', t('cap.4.t'), t('cap.4.b')],
  ] as const;

  const reviewSteps = [
    [t('control.s1.t'), t('control.s1.b')],
    [t('control.s2.t'), t('control.s2.b')],
    [t('control.s3.t'), t('control.s3.b')],
  ] as const;

  return (
    <div className="landing-page" data-theme="paper">
      <div className="landing-noise" aria-hidden="true" />

      <LandingNav />

      <main>
        <section className="landing-hero" aria-labelledby="home-hero-heading">
          <div className="landing-wrap landing-hero__grid">
            <div className="landing-hero__copy">
              <div className="landing-eyebrow">
                <span className="landing-eyebrow__mark" aria-hidden="true" />
                {t('hero.eyebrow')}
              </div>
              <h1 id="home-hero-heading">
                {t('hero.title1')}
                <br />
                <span className="landing-heading-accent">{t('hero.title2')}</span>
              </h1>
              <p className="landing-hero__lede">{t('hero.lede')}</p>
              <p className="home-landing__positioning">{t('hero.positioning')}</p>

              <div className="landing-hero__facts">
                <div>
                  <span>{t('hero.fact1k')}</span>
                  <strong>{t('hero.fact1v')}</strong>
                </div>
                <div>
                  <span>{t('hero.fact2k')}</span>
                  <strong>{t('hero.fact2v')}</strong>
                </div>
                <div>
                  <span>{t('hero.fact3k')}</span>
                  <strong>{t('hero.fact3v')}</strong>
                </div>
              </div>

              <div className="home-landing__actions">
                <Link className="landing-primary-button" href="/home">
                  {t('hero.cta')} <span aria-hidden="true">↗</span>
                </Link>
                <Link className="home-landing__text-link" href="#producto">
                  {t('hero.more')} <span>↓</span>
                </Link>
              </div>
            </div>

            <div className="landing-hero__visual">
              <div className="document-frame">
                <DocumentCanvasPreview />
              </div>
              <p className="home-landing__visual-note">{t('hero.visualNote')}</p>
            </div>
          </div>

          <div className="landing-hero__edge-label" aria-hidden="true">
            <span>01</span>
            <span>DOCUMENT WORKSPACE</span>
          </div>
        </section>

        <section
          id="producto"
          className="landing-section home-landing__product"
          aria-labelledby="product-heading"
        >
          <div className="landing-wrap">
            <div className="section-rule">
              <span>{t('product.rule')}</span>
              <span className="section-rule__line" aria-hidden="true" />
            </div>
            <div className="home-landing__section-heading">
              <h2 id="product-heading">{t('product.h2')}</h2>
              <p>{t('product.p')}</p>
            </div>

            <div className="home-landing__capabilities">
              {capabilities.map(([number, title, body]) => (
                <article key={number}>
                  <span>{number}</span>
                  <h3>{title}</h3>
                  <p>{body}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section
          id="canvas"
          className="landing-section home-landing__canvas"
          aria-labelledby="canvas-heading"
        >
          <div className="landing-wrap home-landing__canvas-grid">
            <div>
              <p className="landing-micro-label">{t('canvas.label')}</p>
              <h2 id="canvas-heading">{t('canvas.h2')}</h2>
              <p>{t('canvas.p')}</p>
              <Link className="landing-inline-link" href="/home">
                {t('canvas.enter')} <span>↗</span>
              </Link>
            </div>

            <div className="home-landing__paper-preview">
              <div className="home-landing__paper-bar">
                <span>working document</span>
                <span>review mode</span>
              </div>
              <div className="home-landing__paper-body">
                <span>DOCUMENT / 01</span>
                <h3>Structure before polish.</h3>
                <p>Headings, steps, equations, and conclusions stay on one surface.</p>
                <div className="home-landing__proposal">
                  <i />
                  <div>
                    <small>PROPOSED CHANGE</small>
                    <strong>Turn the result into a numbered step.</strong>
                  </div>
                  <b>✓</b>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section
          id="control"
          className="landing-section home-landing__control"
          aria-labelledby="control-heading"
        >
          <div className="landing-wrap">
            <div className="section-rule">
              <span>{t('control.rule')}</span>
              <span className="section-rule__line" aria-hidden="true" />
            </div>
            <div className="home-landing__section-heading home-landing__section-heading--control">
              <h2 id="control-heading">{t('control.h2')}</h2>
              <p>{t('control.p')}</p>
            </div>
            <div className="home-landing__review-rail">
              {reviewSteps.map(([title, body], index) => (
                <div key={title}>
                  <span>0{index + 1}</span>
                  <h3>{title}</h3>
                  <p>{body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="landing-section home-landing__agent" aria-labelledby="agent-heading">
          <div className="landing-wrap home-landing__agent-grid">
            <div className="home-landing__agent-mark">
              <span>DS</span>
              <i />
              <i />
              <i />
            </div>
            <div>
              <p className="landing-micro-label">{t('agent.label')}</p>
              <h2 id="agent-heading">{t('agent.h2')}</h2>
              <p>{t('agent.p')}</p>
              <Link className="landing-inline-link" href="/mcp">
                {t('agent.link')} <span>↗</span>
              </Link>
            </div>
          </div>
        </section>

        <section className="landing-section home-landing__usecases" aria-labelledby="usecases-heading">
          <div className="landing-wrap home-landing__usecases-grid">
            <div className="home-landing__usecases-intro">
              <p className="landing-micro-label">WHEN A DOCUMENT HAS A JOB</p>
              <h2 id="usecases-heading">More focused than a general editor.</h2>
              <p>A blank page is fine when the rules are in your head. Docs is for the moments when they live in a rubric, a brief, a template, or a regulated process—and cannot be lost halfway through the draft.</p>
              <div className="home-landing__usecases-proof"><span>YOU BRING</span><strong>Rules, source files, and a repeatable structure.</strong><span>DOCS KEEPS</span><strong>The document tied to all of it.</strong></div>
              <Link className="landing-primary-button" href="/usecases">See concrete use cases <span aria-hidden="true">↗</span></Link>
            </div>
            <div className="home-landing__usecases-list" aria-label="Examples of documents Docs Studio is made for">
              {[
                ['01', 'University report', 'A professor’s rubric becomes the required structure, not a PDF you forget to reopen.', 'Rubric · sources · final report'],
                ['02', 'Client proposal', 'Scope, exclusions, and brand language stay attached while the team revises the draft.', 'Brief · proposal · review'],
                ['03', 'Technical procedure', 'Mandatory evidence and approval steps remain visible until the document is complete.', 'Requirements · procedure · audit'],
                ['04', 'Academic starter', 'Choose a report, lab, problem set, case study, proposal, or data analysis shape before the agent begins.', 'Template · guide · agent plan · review'],
              ].map(([number, title, body, flow]) => (
                <article key={number} className="home-landing__usecase-row">
                  <span>{number}</span>
                  <div><strong>{title}</strong><p>{body}</p><small>{flow}</small></div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="landing-final home-landing__final" aria-labelledby="home-final-heading">
          <div className="landing-wrap">
            <span className="landing-final__label">{t('final.label')}</span>
            <h2 id="home-final-heading">{t('final.h2')}</h2>
            <p>{t('final.p')}</p>
            <Link className="landing-primary-button landing-primary-button--large" href="/home">
              {t('final.cta')} <span aria-hidden="true">↗</span>
            </Link>
          </div>
        </section>
      </main>

      <footer className="landing-footer">
        <div className="landing-wrap landing-footer__inner">
          <span className="landing-footer__mark" aria-hidden="true">Docs</span>
          <span>{t('footer.tag')}</span>
          <Link href="/mcp">MCP / agent surface ↗</Link>
        </div>
      </footer>
    </div>
  );
}
