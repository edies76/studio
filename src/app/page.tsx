import Link from 'next/link';
import DocumentCanvasPreview from '@/components/document-canvas-preview';
import LandingNav from '@/components/landing-nav';

const capabilities = [
  [
    '01',
    'La guía entra en contexto',
    'El parser identifica tareas, objetivos, restricciones y rúbrica para que el documento no empiece a ciegas.',
  ],
  [
    '02',
    'El lienzo conserva el trabajo',
    'Un canvas paginado Letter/Legal reúne texto, tablas, ecuaciones, imágenes, márgenes y zoom.',
  ],
  [
    '03',
    'La IA propone cambios',
    'El agente puede leer bloques y preparar ediciones específicas. Vos decidís qué entra al documento.',
  ],
  [
    '04',
    'El archivo sale completo',
    'MathJax, tablas editables, imágenes y exportación DOCX/PDF forman parte del mismo flujo.',
  ],
];

const reviewSteps = [
  ['Leer', 'El agente conoce el HTML actual y sus bloques antes de tocar una parte.'],
  ['Proponer', 'Una reescritura llega como cambio visible, con contexto y contenido anterior.'],
  ['Decidir', 'Aceptar o rechazar es una operación explícita, no una promesa del copy.'],
];

export const metadata = {
  title: 'Docs Studio | Del brief al documento',
  description:
    'Workspace académico: brief, canvas paginado, propuestas con Accept/Reject y export DOCX/PDF.',
};

/**
 * Product landing. Brand is felt in the wordmark, not explained in body copy.
 * Domain wordplay stays off the page — humans notice over-explanation instantly.
 */
export default function HomePage() {
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
                Del brief al documento
              </div>
              <h1 id="home-hero-heading">
                El trabajo no termina en el chat.
                <br />
                <span className="landing-heading-accent">Termina en el archivo.</span>
              </h1>
              <p className="landing-hero__lede">
                Un workspace académico: traé la guía del taller, trabajá en un lienzo paginado y
                dejá que el copilot proponga. Vos aceptás o rechazás. Exportás cuando el archivo
                está listo para entregar.
              </p>

              <div className="landing-hero__facts" aria-label="Qué ofrece el producto">
                <div>
                  <span>Contexto</span>
                  <strong>Brief + rúbrica</strong>
                </div>
                <div>
                  <span>Superficie</span>
                  <strong>Canvas Letter / Legal</strong>
                </div>
                <div>
                  <span>Decisión</span>
                  <strong>Proponer → revisar</strong>
                </div>
              </div>

              <div className="home-landing__actions">
                <Link className="landing-primary-button" href="/studio">
                  Ver el workspace <span aria-hidden="true">↗</span>
                </Link>
                <Link className="home-landing__text-link" href="#producto">
                  Conocer el producto <span>↓</span>
                </Link>
              </div>
            </div>

            <div className="landing-hero__visual">
              <div className="document-frame">
                <DocumentCanvasPreview />
              </div>
              <p className="home-landing__visual-note">
                Una superficie de trabajo: contexto a la izquierda, documento a la derecha.
              </p>
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
              <span>Qué hace de verdad</span>
              <span className="section-rule__line" aria-hidden="true" />
            </div>
            <div className="home-landing__section-heading">
              <h2 id="product-heading">Un documento con memoria del encargo.</h2>
              <p>
                La diferencia no es generar más texto. Es mantener visibles las condiciones que
                hacen que ese texto sirva: la guía, el formato, la estructura y la revisión.
              </p>
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
              <p className="landing-micro-label">La fuente de verdad</p>
              <h2 id="canvas-heading">El canvas no ilustra el trabajo. Es el trabajo.</h2>
              <p>
                El editor mantiene el documento en primer plano mientras el agente ayuda al
                costado. Podés editar texto, tablas, ecuaciones e imágenes y conservar la
                composición que vas a exportar.
              </p>
              <Link className="landing-inline-link" href="/studio">
                Entrar al editor <span>↗</span>
              </Link>
            </div>

            <div
              className="home-landing__paper-preview"
              aria-label="Vista del documento y una propuesta del agente"
            >
              <div className="home-landing__paper-bar">
                <span>working document</span>
                <span>review mode</span>
              </div>
              <div className="home-landing__paper-body">
                <span>DOCUMENT / 01</span>
                <h3>La estructura antes que el acabado.</h3>
                <p>
                  El documento conserva títulos, operaciones, ecuaciones y conclusiones en la
                  misma superficie.
                </p>
                <div className="home-landing__proposal">
                  <i />
                  <div>
                    <small>CAMBIO PROPUESTO</small>
                    <strong>Convertir el resultado en un paso numerado.</strong>
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
              <span>El límite importante</span>
              <span className="section-rule__line" aria-hidden="true" />
            </div>
            <div className="home-landing__section-heading home-landing__section-heading--control">
              <h2 id="control-heading">La IA puede avanzar sin borrar tu decisión.</h2>
              <p>
                El agente no tiene que fingir que el documento ya está listo. Lee, propone y deja
                el cambio en un estado que podés inspeccionar.
              </p>
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
              <p className="landing-micro-label">Para agentes externos</p>
              <h2 id="agent-heading">El mismo documento también tiene una superficie MCP.</h2>
              <p>
                Un agente externo puede leer, buscar, validar, redactar, proponer cambios,
                insertar primitivas del documento y exportar. El endpoint remoto usa autenticación
                Bearer y separa cada workspace.
              </p>
              <Link className="landing-inline-link" href="/mcp">
                Leer la superficie MCP <span>↗</span>
              </Link>
            </div>
          </div>
        </section>

        <section className="landing-final home-landing__final" aria-labelledby="home-final-heading">
          <div className="landing-wrap">
            <span className="landing-final__label">Sin brief perfecto</span>
            <h2 id="home-final-heading">Contexto adentro. Documento afuera.</h2>
            <p>
              Un lugar para transformar una guía imperfecta en un archivo que podés leer, editar y
              entregar.
            </p>
            <Link className="landing-primary-button landing-primary-button--large" href="/studio">
              Abrir el workspace <span aria-hidden="true">↗</span>
            </Link>
          </div>
        </section>
      </main>

      <footer className="landing-footer">
        <div className="landing-wrap landing-footer__inner">
          <span className="landing-footer__mark" aria-hidden="true">
            Docs<span className="landing-wordmark__s">S</span>
          </span>
          <span>Workspace académico · el archivo es la verdad</span>
          <Link href="/mcp">MCP / agent surface ↗</Link>
        </div>
      </footer>
    </div>
  );
}
