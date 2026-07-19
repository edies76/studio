/**
 * High-fidelity DOCX → editable HTML import.
 * Mammoth cannot run a full Word layout engine, but we map styles, tables,
 * images and common Spanish/APA heading names so import ≠ plain paste.
 */

import mammoth from 'mammoth';
import JSZip from 'jszip';
import { sanitizeDocumentHtml } from '@/lib/math-html';
import type { PaperSize } from '@/lib/doc-tools';

export type DocxImportResult = {
  html: string;
  /** OOXML-first variant: preserves Word's direct visual formatting. */
  fidelityHtml?: string;
  /** Sheet family inferred from Word's section geometry. */
  paperSize?: PaperSize;
  titleHint: string;
  warnings: string[];
  /** Short user-facing summary (no OOXML schema noise) */
  userSummary: string;
};

type OoxmlStyle = { name?: string; basedOn?: string; css: string; paragraphCss: string; heading?: number };
type OoxmlListLevel = { ordered: boolean; start?: number; listStyle?: string };
type OoxmlTableStyle = { background?: string; firstRowBackground?: string };
export type WordImportProfile = { title: string; styles: string[]; tables: number; headings: number; source: 'docx-ooxml' };
const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const ooxmlChildren = (node: Element, name: string) => Array.from(node.children).filter((child) => child.localName === name) as Element[];
const ooxmlChild = (node: Element, name: string) => ooxmlChildren(node, name)[0] || null;
const wAttr = (node: Element | null, name: string) => node?.getAttributeNS(W, name) || node?.getAttribute(`w:${name}`) || node?.getAttribute(name) || '';
const escapeHtml = (value: string) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function ooxmlText(node: Element): string {
  return Array.from(node.querySelectorAll('t')).map((part) => part.textContent || '').join('');
}

function cssFromProperties(properties: Element | null): string {
  if (!properties) return '';
  const css: string[] = [];
  const color = wAttr(ooxmlChild(properties, 'color'), 'val');
  const size = Number(wAttr(ooxmlChild(properties, 'sz'), 'val'));
  const font = wAttr(ooxmlChild(properties, 'rFonts'), 'ascii') || wAttr(ooxmlChild(properties, 'rFonts'), 'hAnsi');
  const highlight = wAttr(ooxmlChild(properties, 'highlight'), 'val');
  if (color && color !== 'auto') css.push(`color:#${color}`);
  if (Number.isFinite(size) && size) css.push(`font-size:${size / 2}pt`);
  if (font) css.push(`font-family:${escapeHtml(font)}`);
  if (ooxmlChild(properties, 'b')) css.push('font-weight:700');
  if (ooxmlChild(properties, 'i')) css.push('font-style:italic');
  if (ooxmlChild(properties, 'u')) css.push('text-decoration:underline');
  if (highlight) css.push(`background-color:${highlight === 'yellow' ? '#fff59d' : highlight}`);
  return css.join(';');
}

function paragraphCss(properties: Element | null): string {
  // Word paragraphs do not get browser heading/p margins. Starting from zero
  // makes a fidelity paragraph a Word box, then OOXML spacing adds only what
  // the source explicitly asks for.
  const css: string[] = ['margin:0'];
  if (!properties) return css.join(';');
  const jc = wAttr(ooxmlChild(properties, 'jc'), 'val');
  const spacing = ooxmlChild(properties, 'spacing');
  const ind = ooxmlChild(properties, 'ind');
  const map: Record<string, string> = { both: 'justify', center: 'center', right: 'right', left: 'left' };
  if (map[jc]) css.push(`text-align:${map[jc]}`);
  const before = Number(wAttr(spacing, 'before')), after = Number(wAttr(spacing, 'after'));
  if (before) css.push(`margin-top:${before / 20}pt`);
  if (after) css.push(`margin-bottom:${after / 20}pt`);
  const line = Number(wAttr(spacing, 'line'));
  if (line) {
    const rule = wAttr(spacing, 'lineRule');
    // Word stores auto line spacing in 1/240ths of a line (360 = 1.5×).
    // Exact/atLeast values are twentieths of a point.
    css.push(
      rule === 'exact' || rule === 'atLeast'
        ? `line-height:${line / 20}pt`
        : `line-height:${line / 240}`,
    );
  }
  const left = Number(wAttr(ind, 'left') || wAttr(ind, 'start'));
  if (left) css.push(`margin-left:${left / 20}pt`);
  return css.join(';');
}

/** Direct OOXML reader for the fidelity path. It intentionally keeps Word's
 * visual properties rather than mapping custom styles into generic headings. */
export async function importDocxFidelityHtml(buffer: ArrayBuffer): Promise<string> {
  const zip = await JSZip.loadAsync(buffer);
  const readXml = async (path: string) => {
    const file = zip.file(path); if (!file) return null;
    return new DOMParser().parseFromString(await file.async('string'), 'application/xml');
  };
  const documentXml = await readXml('word/document.xml');
  if (!documentXml) throw new Error('No se encontró word/document.xml.');
  const documentRels = await readXml('word/_rels/document.xml.rels');
  const imageSources = new Map<string, string>();
  const mimeForImage = (path: string) => ({
    png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', bmp: 'image/bmp', svg: 'image/svg+xml', webp: 'image/webp',
  }[path.split('.').pop()?.toLowerCase() || ''] || 'application/octet-stream');
  await Promise.all(Array.from(documentRels?.querySelectorAll('Relationship') || []).map(async (relation) => {
    const id = relation.getAttribute('Id'); const target = relation.getAttribute('Target');
    if (!id || !target || !/\/image$/i.test(relation.getAttribute('Type') || '')) return;
    const path = target.startsWith('word/') ? target : `word/${target.replace(/^\.\//, '')}`;
    const file = zip.file(path);
    if (!file) return;
    imageSources.set(id, `data:${mimeForImage(path)};base64,${await file.async('base64')}`);
  }));
  const stylesXml = await readXml('word/styles.xml');
  const styles = new Map<string, OoxmlStyle>();
  const tableStyles = new Map<string, OoxmlTableStyle>();
  stylesXml?.querySelectorAll('style').forEach((style) => {
    const id = wAttr(style, 'styleId'); const name = wAttr(ooxmlChild(style, 'name'), 'val');
    const heading = /heading\s*(\d)|título apartado\s*(\d)/i.exec(name)?.slice(1).find(Boolean);
    styles.set(id, {
      name,
      basedOn: wAttr(ooxmlChild(style, 'basedOn'), 'val'),
      css: cssFromProperties(ooxmlChild(style, 'rPr')),
      paragraphCss: paragraphCss(ooxmlChild(style, 'pPr')),
      heading: heading ? Number(heading) : undefined,
    });
  });
  stylesXml?.querySelectorAll('style').forEach((style) => {
    if (wAttr(style, 'type') !== 'table') return;
    const readFill = (properties: Element | null) => {
      const fill = wAttr(ooxmlChild(properties || style, 'shd'), 'fill');
      return fill && fill !== 'auto' ? `#${fill}` : undefined;
    };
    const firstRow = Array.from(style.querySelectorAll('tblStylePr')).find((node) => wAttr(node, 'type') === 'firstRow');
    tableStyles.set(wAttr(style, 'styleId'), {
      background: readFill(ooxmlChild(style, 'tblPr')),
      firstRowBackground: firstRow ? readFill(ooxmlChild(firstRow, 'tcPr')) : undefined,
    });
  });
  const numbering = new Map<string, Map<number, OoxmlListLevel>>();
  const numberingXml = await readXml('word/numbering.xml');
  const abstractLevels = new Map<string, Map<number, OoxmlListLevel>>();
  numberingXml?.querySelectorAll('abstractNum').forEach((abstractNum) => {
    const levels = new Map<number, OoxmlListLevel>();
    ooxmlChildren(abstractNum, 'lvl').forEach((level) => {
      const ilvl = Number(wAttr(level, 'ilvl')) || 0;
      const format = wAttr(ooxmlChild(level, 'numFmt'), 'val');
      levels.set(ilvl, {
        ordered: !['bullet', 'none'].includes(format),
        start: Number(wAttr(ooxmlChild(level, 'start'), 'val')) || 1,
        listStyle: wAttr(ooxmlChild(level, 'lvlText'), 'val').includes('○') ? 'circle' : undefined,
      });
    });
    abstractLevels.set(wAttr(abstractNum, 'abstractNumId'), levels);
  });
  numberingXml?.querySelectorAll('num').forEach((num) => {
    const levels = abstractLevels.get(wAttr(ooxmlChild(num, 'abstractNumId'), 'val'));
    if (levels) numbering.set(wAttr(num, 'numId'), levels);
  });
  const defaultParagraphStyle = Array.from(styles.entries()).find(([id]) => id === 'Normal')?.[0] || '';
  const resolveStyle = (id: string): OoxmlStyle => {
    const own: OoxmlStyle = styles.get(id) || { css: '', paragraphCss: '' };
    const parent: OoxmlStyle = own.basedOn && own.basedOn !== id
      ? resolveStyle(own.basedOn)
      : id !== defaultParagraphStyle && defaultParagraphStyle
        ? resolveStyle(defaultParagraphStyle)
        : { css: '', paragraphCss: '' };
    return {
      ...parent,
      ...own,
      css: [parent.css, own.css].filter(Boolean).join(';'),
      paragraphCss: [parent.paragraphCss, own.paragraphCss].filter(Boolean).join(';'),
      heading: own.heading || parent.heading,
    };
  };
  const renderRun = (run: Element) => {
    const drawing = run.querySelector('drawing, pict');
    const blip = drawing?.querySelector('blip');
    const embed = blip?.getAttributeNS(R, 'embed') || blip?.getAttribute('r:embed') || '';
    const image = imageSources.get(embed);
    const text = ooxmlText(run);
    if (!text && !image) return '';
    const css = cssFromProperties(ooxmlChild(run, 'rPr'));
    return `${text ? `<span${css ? ` style="${css}"` : ''}>${escapeHtml(text)}</span>` : ''}${image ? `<img src="${image}" alt="Imagen importada de Word">` : ''}`;
  };
  const renderMath = (math: Element) => {
    const text = ooxmlText(math).replace(/\s+/g, ' ').trim();
    return text ? `<span class="docx-equation">${escapeHtml(text)}</span>` : '';
  };
  const renderInline = (paragraph: Element) => Array.from(paragraph.children).map((node) => {
    if (node.localName === 'r') return renderRun(node);
    if (node.localName === 'oMath' || node.localName === 'oMathPara') return renderMath(node);
    if (node.localName === 'hyperlink') return Array.from(node.children).filter((child) => child.localName === 'r').map(renderRun).join('');
    return '';
  }).join('');
  const listInfo = (paragraph: Element) => {
    const props = ooxmlChild(paragraph, 'pPr'); const numPr = ooxmlChild(props || paragraph, 'numPr');
    const numId = wAttr(ooxmlChild(numPr || paragraph, 'numId'), 'val');
    if (!numId) return null;
    const level = Number(wAttr(ooxmlChild(numPr || paragraph, 'ilvl'), 'val')) || 0;
    const config = numbering.get(numId)?.get(level) || numbering.get(numId)?.get(0);
    return config ? { numId, level, ...config } : null;
  };
  const renderParagraph = (paragraph: Element) => {
    const props = ooxmlChild(paragraph, 'pPr'); const styleId = wAttr(ooxmlChild(props || paragraph, 'pStyle'), 'val'); const style = resolveStyle(styleId || defaultParagraphStyle);
    const css = [style.css, style.paragraphCss, paragraphCss(props)].filter(Boolean).join(';');
    const content = renderInline(paragraph) || escapeHtml(ooxmlText(paragraph));
    if (listInfo(paragraph)) return `<li class="docx-fidelity-paragraph"${css ? ` style="${css}"` : ''}>${content || '<br>'}</li>`;
    const tag = style.heading ? `h${Math.min(6, style.heading)}` : 'p';
    return `<${tag} class="docx-fidelity-paragraph"${css ? ` style="${css}"` : ''}>${content || '<br>'}</${tag}>`;
  };
  const renderTable = (table: Element) => {
    const tableProps = ooxmlChild(table, 'tblPr');
    const wordTableStyle = tableStyles.get(wAttr(ooxmlChild(tableProps || table, 'tblStyle'), 'val'));
    const tableWidth = Number(wAttr(ooxmlChild(tableProps || table, 'tblW'), 'w'));
    const tableStyle = [tableWidth ? `width:${tableWidth / 20}pt` : '', 'border-collapse:collapse'].filter(Boolean).join(';');
    return `<table class="studio-table docx-fidelity-table"${tableStyle ? ` style="${tableStyle}"` : ''}>${ooxmlChildren(table, 'tr').map((row, rowIndex) => `<tr>${ooxmlChildren(row, 'tc').map((cell) => { const props = ooxmlChild(cell, 'tcPr'); const shade = wAttr(ooxmlChild(props || cell, 'shd'), 'fill'); const width = Number(wAttr(ooxmlChild(props || cell, 'tcW'), 'w')); const vAlign = wAttr(ooxmlChild(props || cell, 'vAlign'), 'val'); const inheritedFill = rowIndex === 0 ? wordTableStyle?.firstRowBackground : wordTableStyle?.background; const style = [shade && shade !== 'auto' ? `background:#${shade}` : inheritedFill ? `background:${inheritedFill}` : '', width ? `width:${width / 20}pt` : '', vAlign ? `vertical-align:${vAlign}` : '', 'border:1px solid #9aa6b2', 'padding:4pt 6pt'].filter(Boolean).join(';'); return `<td${style ? ` style="${style}"` : ''}>${ooxmlChildren(cell, 'p').map(renderParagraph).join('')}</td>`; }).join('')}</tr>`).join('')}</table>`;
  };
  const renderBlocks = (nodes: Element[]) => {
    let html = ''; let openList: { numId: string; level: number; ordered: boolean } | null = null;
    const closeList = () => { if (openList) { html += openList.ordered ? '</ol>' : '</ul>'; openList = null; } };
    nodes.forEach((node) => {
      if (node.localName !== 'p') { closeList(); if (node.localName === 'tbl') html += renderTable(node); return; }
      const info = listInfo(node);
      if (!info) { closeList(); html += renderParagraph(node); return; }
      if (!openList || openList.numId !== info.numId || openList.level !== info.level || openList.ordered !== info.ordered) {
        closeList(); const tag = info.ordered ? 'ol' : 'ul';
        const start = info.ordered && info.start && info.start !== 1 ? ` start="${info.start}"` : '';
        const style = info.listStyle ? ` style="list-style-type:${info.listStyle}"` : '';
        html += `<${tag} class="docx-fidelity-list"${start}${style}>`; openList = { numId: info.numId, level: info.level, ordered: info.ordered };
      }
      html += renderParagraph(node);
    });
    closeList(); return html;
  };
  // Bring the first section header into the editable document. Mammoth drops
  // headers entirely, which is why institutional tables vanished on import.
  const headerRef = documentXml.querySelector('sectPr > headerReference');
  const relationId = headerRef?.getAttributeNS(R, 'id') || headerRef?.getAttribute('r:id');
  const relation = relationId ? Array.from(documentRels?.querySelectorAll('Relationship') || []).find((item) => item.getAttribute('Id') === relationId) : null;
  const headerTarget = relation?.getAttribute('Target')?.replace(/^\//, '');
  const headerXml = headerTarget ? await readXml(headerTarget.startsWith('word/') ? headerTarget : `word/${headerTarget}`) : null;
  const body = documentXml.querySelector('body');
  if (!body) return '<p><br></p>';
  const headerHtml = headerXml ? renderBlocks(Array.from(headerXml.querySelector('hdr')?.children || []) as Element[]) : '';
  return `${headerHtml}${renderBlocks(Array.from(body.children) as Element[])}` || '<p><br></p>';
}

export async function inspectWordProfile(buffer: ArrayBuffer, title: string): Promise<WordImportProfile> {
  const zip = await JSZip.loadAsync(buffer); const file = zip.file('word/document.xml');
  if (!file) throw new Error('No se encontró el documento Word.');
  const xml = new DOMParser().parseFromString(await file.async('string'), 'application/xml');
  const paragraphs = Array.from(xml.querySelectorAll('p'));
  const styles = Array.from(new Set(paragraphs.map((p) => wAttr(ooxmlChild(ooxmlChild(p, 'pPr') || p, 'pStyle'), 'val')).filter(Boolean)));
  return { title, styles, tables: xml.querySelectorAll('tbl').length, headings: paragraphs.filter((p) => /t.tulo|heading/i.test(wAttr(ooxmlChild(ooxmlChild(p, 'pPr') || p, 'pStyle'), 'val'))).length, source: 'docx-ooxml' };
}

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
  const fidelityHtml = await importDocxFidelityHtml(buffer).catch(() => '');
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
  const paperSize = await inferWordPaperSize(buffer).catch(() => undefined);
  const userSummary =
    warnings.length === 0
      ? `Importado «${titleHint}» con formato editable (estilos, listas, tablas e imágenes).`
      : `Importado «${titleHint}» con ${warnings.length} aviso(s): ${warnings.slice(0, 2).join(' · ')}`;

  return { html, fidelityHtml: fidelityHtml ? sanitizeDocumentHtml(fidelityHtml) : undefined, titleHint, paperSize, warnings, userSummary };
}

/** Word stores section dimensions in twips. Keep the closest editable sheet
 * family so imported content is paginated on the same kind of paper. */
async function inferWordPaperSize(buffer: ArrayBuffer): Promise<PaperSize | undefined> {
  const zip = await JSZip.loadAsync(buffer);
  const file = zip.file('word/document.xml');
  if (!file) return undefined;
  const xml = new DOMParser().parseFromString(await file.async('string'), 'application/xml');
  const pgSz = xml.querySelector('sectPr > pgSz');
  const width = Number(wAttr(pgSz, 'w')); const height = Number(wAttr(pgSz, 'h'));
  if (!width || !height) return undefined;
  if (Math.abs(width - 11906) < 90 && Math.abs(height - 16838) < 100) return 'a4';
  if (Math.abs(width - 12240) < 90 && height >= 19500) return 'legal';
  return 'letter';
}
