/**
 * High-fidelity DOCX → editable HTML import.
 * Mammoth cannot run a full Word layout engine, but we map styles, tables,
 * images and common Spanish/APA heading names so import ≠ plain paste.
 */

import mammoth from 'mammoth';
import { sanitizeDocumentHtml } from '@/lib/math-html';

export type DocxImportResult = {
  html: string;
  titleHint: string;
  warnings: string[];
  /** Short user-facing summary (no OOXML schema noise) */
  userSummary: string;
};

/** Map common Word / Spanish / academic styles → semantic HTML */
const STYLE_MAP = [
  "p[style-name='Title'] => h1.doc-title:fresh",
  "p[style-name='Subtitle'] => h2.doc-subtitle:fresh",
  "p[style-name='Heading 1'] => h1:fresh",
  "p[style-name='Heading 2'] => h2:fresh",
  "p[style-name='Heading 3'] => h3:fresh",
  "p[style-name='Heading 4'] => h4:fresh",
  "p[style-name='heading 1'] => h1:fresh",
  "p[style-name='heading 2'] => h2:fresh",
  "p[style-name='heading 3'] => h3:fresh",
  "p[style-name='Título'] => h1:fresh",
  "p[style-name='Título 1'] => h1:fresh",
  "p[style-name='Título 2'] => h2:fresh",
  "p[style-name='Título 3'] => h3:fresh",
  "p[style-name='Titulo'] => h1:fresh",
  "p[style-name='Titulo 1'] => h1:fresh",
  "p[style-name='Titulo 2'] => h2:fresh",
  "p[style-name='Titulo 3'] => h3:fresh",
  // Custom academic (colgii / campus styles)
  "p[style-name='Título Apartado 1_sin nivel'] => h2:fresh",
  "p[style-name='Título Apartado 1'] => h2:fresh",
  "p[style-name='Título Apartado 2'] => h3:fresh",
  "p[style-name='Título Apartado 3'] => h3:fresh",
  "p[style-name='TtuloApartado1sinnivel'] => h2:fresh",
  "p[style-name='TtuloApartado3'] => h3:fresh",
  "p[style-name='Quote'] => blockquote:fresh",
  "p[style-name='Intense Quote'] => blockquote:fresh",
  "p[style-name='List Paragraph'] => p:fresh",
  "r[style-name='Strong'] => strong",
  "r[style-name='Emphasis'] => em",
  "r[style-name='Código'] => code",
  "r[style-name='Code'] => code",
  "table => table.studio-table:fresh",
];

function humanizeWarning(msg: string): string | null {
  if (!msg) return null;
  // Office Math — expected limit of mammoth
  if (/oMath|officeDocument\/2006\/math/i.test(msg)) {
    return 'Fórmulas de Word (OMML) no se importan como LaTeX; revisá ecuaciones a mano.';
  }
  // Unrecognised style — extract name
  const style = msg.match(/Unrecognised paragraph style:\s*'([^']+)'/i);
  if (style) {
    return `Estilo de párrafo no mapeado: «${style[1]}» (se importó como texto normal).`;
  }
  if (/unrecognised element/i.test(msg)) {
    return null; // drop noisy raw OOXML element dumps
  }
  // Keep short useful messages
  if (msg.length > 140) return msg.slice(0, 137) + '…';
  return msg;
}

/** Promote bold-only short paragraphs to headings when style was lost */
function promoteLikelyHeadings(html: string): string {
  if (typeof document === 'undefined') return html;
  const host = document.createElement('div');
  host.innerHTML = html;
  Array.from(host.children).forEach((node) => {
    if (node.nodeName !== 'P') return;
    const p = node as HTMLElement;
    const text = (p.textContent || '').trim();
    if (!text || text.length > 90) return;
    // All-strong / all-bold short line → h2
    const onlyStrong =
      p.children.length === 1 &&
      ['STRONG', 'B'].includes(p.children[0].tagName) &&
      (p.children[0].textContent || '').trim() === text;
    const looksNumbered = /^\d+(\.\d+)*\.?\s+\S/.test(text);
    if (onlyStrong || (looksNumbered && text.length < 70 && !text.includes('.'))) {
      const h = document.createElement(looksNumbered && /^\d+\.\d+/.test(text) ? 'h3' : 'h2');
      h.innerHTML = p.innerHTML;
      p.replaceWith(h);
    }
  });
  return host.innerHTML;
}

/** Keep useful inline styles; drop Word junk (mso-*, theme colors as raw) */
function cleanInlineStyles(html: string): string {
  if (typeof document === 'undefined') return html;
  const host = document.createElement('div');
  host.innerHTML = html;
  host.querySelectorAll<HTMLElement>('[style]').forEach((el) => {
    const s = el.getAttribute('style') || '';
    const keep: string[] = [];
    s.split(';').forEach((part) => {
      const [rawK, ...rest] = part.split(':');
      if (!rawK || !rest.length) return;
      const k = rawK.trim().toLowerCase();
      const v = rest.join(':').trim();
      if (!v) return;
      if (k.startsWith('mso-')) return;
      if (
        k === 'font-family' ||
        k === 'font-size' ||
        k === 'font-weight' ||
        k === 'font-style' ||
        k === 'text-align' ||
        k === 'color' ||
        k === 'background-color' ||
        k === 'background' ||
        k === 'text-decoration' ||
        k === 'vertical-align' ||
        k === 'width' ||
        k === 'min-width'
      ) {
        keep.push(`${k}: ${v}`);
      }
    });
    if (keep.length) el.setAttribute('style', keep.join('; '));
    else el.removeAttribute('style');
  });
  // Ensure tables have studio class
  host.querySelectorAll('table').forEach((t) => {
    t.classList.add('studio-table');
  });
  host.querySelectorAll('th').forEach((t) => t.classList.add('studio-th'));
  host.querySelectorAll('td').forEach((t) => t.classList.add('studio-td'));
  return host.innerHTML;
}

function extractTitleHint(html: string, fileName: string): string {
  if (typeof document !== 'undefined') {
    const host = document.createElement('div');
    host.innerHTML = html;
    const h = host.querySelector('h1, h2, .doc-title');
    const t = (h?.textContent || '').trim();
    if (t && t.length < 100) return t;
  }
  return fileName.replace(/\.docx$/i, '').trim() || 'Documento importado';
}

/**
 * Convert a .docx ArrayBuffer into editor-ready HTML.
 */
export async function importDocxToHtml(
  buffer: ArrayBuffer,
  fileName = 'documento.docx',
): Promise<DocxImportResult> {
  const result = await mammoth.convertToHtml(
    { arrayBuffer: buffer },
    {
      styleMap: STYLE_MAP,
      includeDefaultStyleMap: true,
      convertImage: mammoth.images.imgElement((image) =>
        image.read('base64').then((base64) => ({
          src: `data:${image.contentType};base64,${base64}`,
        })),
      ),
    },
  );

  let html = result.value || '<p><br></p>';
  html = cleanInlineStyles(html);
  html = promoteLikelyHeadings(html);
  html = sanitizeDocumentHtml(html);

  // Ensure at least one block
  if (!html.replace(/<[^>]+>/g, '').trim()) {
    html = '<p><br></p>';
  }

  const rawWarnings = (result.messages || []).map((m) => String(m.message || m.type || ''));
  const warnings = Array.from(
    new Set(rawWarnings.map(humanizeWarning).filter(Boolean) as string[]),
  );

  const titleHint = extractTitleHint(html, fileName);
  const userSummary =
    warnings.length === 0
      ? `Importado «${titleHint}» con formato (estilos, tablas, imágenes).`
      : `Importado «${titleHint}» con ${warnings.length} aviso(s): ${warnings.slice(0, 2).join(' · ')}`;

  return { html, titleHint, warnings, userSummary };
}
