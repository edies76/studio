/**
 * High-fidelity DOCX → editable HTML import.
 * Mammoth cannot run a full Word layout engine, but we map styles, tables,
 * images and common Spanish/APA heading names so import ≠ plain paste.
 */

import mammoth from 'mammoth';
import JSZip from 'jszip';
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

// Mammoth already keeps semantic emphasis. Its document model also exposes
// direct point sizes, but does not emit them unless we map them explicitly.
// This covers normal Word authoring sizes without depending on a Word layout
// engine in the browser.
const FONT_SIZE_STYLE_MAP = Array.from({ length: 43 }, (_, index) => index + 6)
  .map((size) => `r[style-name='Docs Studio ${size}pt'] => span[style='font-size: ${size}pt']`);

function xmlDecode(value: string): string {
  return value
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

function xmlEscape(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Mammoth intentionally ignores OMML. Replacing each equation with its Word
 * text runs before conversion is deliberately conservative: formulas remain
 * editable and visible, even though advanced notation is not yet LaTeX.
 */
function ommlToEditableText(omml: string): string {
  const parts = Array.from(omml.matchAll(/<m:t\b[^>]*>([\s\S]*?)<\/m:t>/gi))
    .map((match) => xmlDecode(match[1] || ''));
  return parts.join('').replace(/\s+/g, ' ').trim() || 'Ecuación de Word';
}

async function prepareDocxBuffer(buffer: ArrayBuffer): Promise<{ buffer: ArrayBuffer; equationCount: number }> {
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(buffer);
  } catch {
    throw new Error(
      'Este archivo .doc usa el formato binario antiguo. Ábrelo en Word y guárdalo como .docx para importarlo; los .docx aunque terminen en .doc sí se detectan automáticamente.',
    );
  }

  const documentPart = zip.file('word/document.xml');
  const contentTypes = zip.file('[Content_Types].xml');
  if (!documentPart || !contentTypes) {
    throw new Error('El archivo no contiene un documento Word OOXML válido.');
  }

  let xml = await documentPart.async('string');
  const equations = Array.from(xml.matchAll(/<m:oMath\b[\s\S]*?<\/m:oMath>/gi));
  if (equations.length) {
    xml = xml.replace(/<m:oMath\b[\s\S]*?<\/m:oMath>/gi, (omml) => {
      const text = xmlEscape(ommlToEditableText(omml));
      return `<w:r><w:rPr><w:i/></w:rPr><w:t xml:space="preserve">${text}</w:t></w:r>`;
    });
    zip.file('word/document.xml', xml);
  }

  return {
    buffer: await zip.generateAsync({ type: 'arraybuffer' }),
    equationCount: equations.length,
  };
}

function preserveDirectFontSizes(element: any): any {
  const children = Array.isArray(element?.children)
    ? element.children.map(preserveDirectFontSizes)
    : element?.children;
  const next = children ? { ...element, children } : element;
  if (next?.type !== 'run' || !next.fontSize || next.styleName) return next;
  return { ...next, styleName: `Docs Studio ${Math.round(next.fontSize)}pt` };
}

function humanizeWarning(msg: string): string | null {
  if (!msg) return null;
  // Office Math — expected limit of mammoth
  if (/oMath|officeDocument\/2006\/math/i.test(msg)) {
    return 'Word equations (OMML) are not imported as LaTeX; review formulas manually.';
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
  return fileName.replace(/\.docx?$/i, '').trim() || 'Documento importado';
}

/**
 * Convert a .docx ArrayBuffer into editor-ready HTML.
 */
export async function importDocxToHtml(
  buffer: ArrayBuffer,
  fileName = 'documento.docx',
): Promise<DocxImportResult> {
  const prepared = await prepareDocxBuffer(buffer);
  const result = await mammoth.convertToHtml(
    { arrayBuffer: prepared.buffer },
    {
      styleMap: [...STYLE_MAP, ...FONT_SIZE_STYLE_MAP],
      includeDefaultStyleMap: true,
      transformDocument: preserveDirectFontSizes,
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
  if (prepared.equationCount) {
    warnings.unshift(
      `${prepared.equationCount} fórmula(s) de Word se importaron como texto editable; revisa la notación matemática compleja.`,
    );
  }

  const titleHint = extractTitleHint(html, fileName);
  const userSummary =
    warnings.length === 0
      ? `Importado «${titleHint}» con formato editable (estilos, listas, tablas e imágenes).`
      : `Importado «${titleHint}» con ${warnings.length} aviso(s): ${warnings.slice(0, 2).join(' · ')}`;

  return { html, titleHint, warnings, userSummary };
}
