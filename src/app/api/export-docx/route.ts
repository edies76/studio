import { NextRequest } from 'next/server';
import {
  AlignmentType,
  BorderStyle,
  Document,
  HeadingLevel,
  ImageRun,
  LevelFormat,
  Math as DocxMath,
  MathComponent,
  MathFraction,
  MathRadical,
  MathRun,
  MathSubScript,
  MathSuperScript,
  Packer,
  Paragraph,
  ParagraphChild,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from 'docx';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const border = { style: BorderStyle.SINGLE, size: 8, color: '333333' };
const borders = { top: border, bottom: border, left: border, right: border };

type TableBlock = { kind: 'table'; rows: string[][] };
type TextBlock = { kind: 'h1' | 'h2' | 'h3' | 'p' | 'li' | 'pre' | 'math'; html: string; attrs?: string };
type Block = TableBlock | TextBlock;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const html = String(body.html || '');
    const title = String(body.title || 'Docs Studio').slice(0, 120);
    if (!html.trim()) return Response.json({ error: 'Empty document' }, { status: 400 });

    const children = htmlToDocxChildren(html);
    const doc = new Document({
      creator: 'Docs Studio',
      title,
      numbering: {
        config: [{
          reference: 'studio-ordered-list',
          levels: [{ level: 0, format: LevelFormat.DECIMAL, text: '%1.', alignment: AlignmentType.START, style: { paragraph: { indent: { left: 360, hanging: 260 } } } }],
        }],
      },
      sections: [{
        properties: { page: { margin: { top: 1440, bottom: 1440, left: 1440, right: 1440 } } },
        children: children.length ? children : [new Paragraph({ children: [new TextRun({ text: '' })] })],
      }],
    });
    const buffer = await Packer.toBuffer(doc);
    const safe = title.replace(/[^\w\- ]+/g, '').trim() || 'docs-studio';
    return new Response(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename="${safe}.docx"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error: any) {
    return Response.json({ error: error?.message || 'Export failed' }, { status: 500 });
  }
}

function decodeEntities(value: string): string {
  return value
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&#(\d+);/g, (_m, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([\da-f]+);/gi, (_m, n) => String.fromCodePoint(parseInt(n, 16)));
}

function stripTags(value: string): string {
  return decodeEntities(value.replace(/<br\s*\/?\s*>/gi, '\n').replace(/<[^>]+>/g, ''))
    .replace(/[ \t\r\f]+/g, ' ')
    .replace(/\n\s+/g, '\n')
    .trim();
}

function findClosingTag(html: string, tag: string, from: number): number {
  const tokens = new RegExp(`<\\/?${tag}\\b[^>]*>`, 'gi');
  tokens.lastIndex = from;
  let depth = 1;
  let match: RegExpExecArray | null;
  while ((match = tokens.exec(html))) {
    if (/^<\//.test(match[0])) {
      depth -= 1;
      if (depth === 0) return tokens.lastIndex;
    } else if (!/\/\s*>$/.test(match[0])) {
      depth += 1;
    }
  }
  return -1;
}

/** Tokenizes top-level blocks in document order; tables are not hoisted ahead of prose. */
function extractBlocks(input: string): Block[] {
  const html = input
    .replace(/<\/?(?:html|head|body)[^>]*>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '');
  const start = /<(h[1-3]|p|li|pre|blockquote|table|ul|ol|div)(\s[^>]*)?>/gi;
  const blocks: Block[] = [];
  let cursor = 0;
  let match: RegExpExecArray | null;

  const pushPlain = (fragment: string) => {
    // stripTags on the whole fragment would silently delete any bare <img>
    // that isn't wrapped in p/div/etc (exactly what a "behind"/floating
    // image looks like once it's detached from the text flow) — that was
    // making floating images vanish on export. Extract them first, keep
    // everything else as a plain-text paragraph as before.
    const images = [...fragment.matchAll(/<img\b[^>]*>/gi)];
    for (const img of images) blocks.push({ kind: 'p', html: img[0] });
    const withoutImages = fragment.replace(/<img\b[^>]*>/gi, '');
    const text = stripTags(withoutImages);
    if (text) blocks.push({ kind: 'p', html: text });
  };

  while ((match = start.exec(html))) {
    if (match.index < cursor) continue;
    pushPlain(html.slice(cursor, match.index));
    const tag = match[1].toLowerCase();
    const end = findClosingTag(html, tag, start.lastIndex);
    if (end < 0) break;
    const inner = html.slice(start.lastIndex, end - tag.length - 3);
    const opening = match[0];
    if (tag === 'table') {
      const rows: string[][] = [];
      const rowRe = /<tr\b[^>]*>([\s\S]*?)<\/tr>/gi;
      let row: RegExpExecArray | null;
      while ((row = rowRe.exec(inner))) {
        const cells: string[] = [];
        const cellRe = /<t[hd]\b[^>]*>([\s\S]*?)<\/t[hd]>/gi;
        let cell: RegExpExecArray | null;
        while ((cell = cellRe.exec(row[1]))) cells.push(cell[1] || '&nbsp;');
        if (cells.length) rows.push(cells);
      }
      if (rows.length) blocks.push({ kind: 'table', rows });
    } else if (tag === 'ul' || tag === 'ol') {
      const liRe = /<li\b([^>]*)>([\s\S]*?)<\/li>/gi;
      let li: RegExpExecArray | null;
      while ((li = liRe.exec(inner))) blocks.push({ kind: 'li', html: li[2], attrs: tag });
    } else if (tag === 'div' && /studio-math|data-tex|\\\[|\\\(/i.test(opening + inner)) {
      blocks.push({ kind: 'math', html: opening + inner + `</${tag}>`, attrs: opening });
    } else if (tag === 'blockquote') {
      blocks.push({ kind: 'p', html: inner, attrs: 'blockquote' });
    } else {
      blocks.push({ kind: tag === 'h1' || tag === 'h2' || tag === 'h3' || tag === 'pre' || tag === 'li' ? tag : 'p', html: inner, attrs: opening });
    }
    cursor = end;
    start.lastIndex = end;
  }
  pushPlain(html.slice(cursor));
  return blocks.length ? blocks : [{ kind: 'p', html: stripTags(html) }];
}

function attrValue(tag: string, name: string): string | null {
  const match = tag.match(new RegExp(`${name}\\s*=\\s*["']([^"']*)["']`, 'i'));
  return match ? decodeEntities(match[1]) : null;
}

function styleValue(tag: string, property: string): string | null {
  const style = attrValue(tag, 'style');
  if (!style) return null;
  const match = style.match(new RegExp(`${property}\\s*:\\s*([^;]+)`, 'i'));
  return match ? match[1].trim() : null;
}

function colorToHex(value: string | null): string | null {
  if (!value) return null;
  const hex = value.match(/^#?([0-9a-f]{6}|[0-9a-f]{3})$/i);
  if (hex) {
    const h = hex[1];
    return (h.length === 3 ? h.split('').map((c) => c + c).join('') : h).toUpperCase();
  }
  const rgb = value.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
  if (rgb) {
    return rgb.slice(1, 4).map((n) => Number(n).toString(16).padStart(2, '0')).join('').toUpperCase();
  }
  return null;
}

/** CSS px → docx half-points (1px = 0.75pt, docx size is in half-points). */
function pxToHalfPoints(value: string | null): number | null {
  if (!value) return null;
  const px = parseFloat(value);
  if (!Number.isFinite(px) || px <= 0) return null;
  return Math.round(px * 0.75 * 2);
}

type RunStyle = { bold?: boolean; italics?: boolean; underline?: boolean; strike?: boolean; color?: string; size?: number };

/** Merge a tag's own formatting into the inherited style stack (child wins). */
function styleFromTag(tag: string, inherited: RunStyle): RunStyle {
  const lower = tag.toLowerCase();
  const next: RunStyle = { ...inherited };
  if (/^<(b|strong)\b/.test(lower)) next.bold = true;
  if (/^<(i|em)\b/.test(lower)) next.italics = true;
  if (/^<u\b/.test(lower)) next.underline = true;
  if (/^<(s|strike|del)\b/.test(lower)) next.strike = true;
  const colorAttr = colorToHex(styleValue(tag, 'color') || attrValue(tag, 'color'));
  if (colorAttr) next.color = colorAttr;
  const sizeAttr = pxToHalfPoints(styleValue(tag, 'font-size'));
  if (sizeAttr) next.size = sizeAttr;
  if (/font-weight\s*:\s*(bold|[6-9]00)/i.test(attrValue(tag, 'style') || '')) next.bold = true;
  if (/font-style\s*:\s*italic/i.test(attrValue(tag, 'style') || '')) next.italics = true;
  return next;
}

function mathSource(html: string): string {
  const data = attrValue(html, 'data-tex');
  if (data) return data;
  const display = html.match(/\\\[([\s\S]*?)\\\]/);
  if (display) return display[1].trim();
  const inline = html.match(/\\\(([\s\S]*?)\\\)/);
  return inline ? inline[1].trim() : stripTags(html);
}

const symbols: Record<string, string> = {
  alpha: 'α', beta: 'β', gamma: 'γ', delta: 'δ', theta: 'θ', lambda: 'λ', mu: 'μ', pi: 'π', sigma: 'σ', phi: 'φ', omega: 'ω',
  pm: '±', times: '×', cdot: '·', leq: '≤', geq: '≥', neq: '≠', infty: '∞', sum: '∑', prod: '∏', int: '∫', partial: '∂', to: '→', rightarrow: '→', leftarrow: '←',
};

function readGroup(source: string, start: number): { value: string; next: number } {
  if (source[start] !== '{') return { value: source[start] || '', next: start + 1 };
  let depth = 1;
  let i = start + 1;
  while (i < source.length && depth) {
    if (source[i] === '{') depth += 1;
    if (source[i] === '}') depth -= 1;
    i += 1;
  }
  return { value: source.slice(start + 1, Math.max(start + 1, i - 1)), next: i };
}

/** Small TeX → OMML bridge. Common fractions, roots and scripts become native Word equations. */
function latexComponents(source: string): MathComponent[] {
  const clean = source.replace(/\\left|\\right/g, '').replace(/\\text\s*\{/g, '{');
  const out: MathComponent[] = [];
  let i = 0;
  while (i < clean.length) {
    const ch = clean[i];
    if (ch === '^' || ch === '_') {
      const previous = out.pop();
      const unit = readGroup(clean, i + 1);
      const script = latexComponents(unit.value);
      if (previous) out.push(ch === '^' ? new MathSuperScript({ children: [previous], superScript: script }) : new MathSubScript({ children: [previous], subScript: script }));
      i = unit.next;
      continue;
    }
    if (ch === '\\') {
      const command = clean.slice(i + 1).match(/^[A-Za-z]+/)?.[0] || clean[i + 1] || '';
      i += 1 + command.length;
      if (command === 'frac') {
        const numerator = readGroup(clean, i); i = numerator.next;
        const denominator = readGroup(clean, i); i = denominator.next;
        out.push(new MathFraction({ numerator: latexComponents(numerator.value), denominator: latexComponents(denominator.value) }));
      } else if (command === 'sqrt') {
        const radicand = readGroup(clean, i); i = radicand.next;
        out.push(new MathRadical({ children: latexComponents(radicand.value) }));
      } else if (symbols[command]) {
        out.push(new MathRun(symbols[command]));
      } else if (command !== ',' && command !== ';' && command !== '!') {
        out.push(new MathRun(command));
      }
      continue;
    }
    if (ch === '{' || ch === '}') { i += 1; continue; }
    let end = i + 1;
    while (end < clean.length && !/[\\^_{}]/.test(clean[end])) end += 1;
    const text = clean.slice(i, end).replace(/\s+/g, ' ');
    if (text) out.push(new MathRun(text));
    i = end;
  }
  return out.length ? out : [new MathRun(source || ' ')] as MathComponent[];
}

/** Read pixel dimensions for a size probe: try inline style first (that's
 *  how the editor actually sets width/height), then the HTML attribute. */
function pixelSize(tag: string, prop: 'width' | 'height'): number | null {
  const fromStyle = styleValue(tag, prop);
  const fromStylePx = fromStyle ? parseFloat(fromStyle) : NaN;
  if (Number.isFinite(fromStylePx) && fromStylePx > 0) return fromStylePx;
  const attr = attrValue(tag, prop);
  const fromAttr = attr ? parseFloat(attr) : NaN;
  return Number.isFinite(fromAttr) && fromAttr > 0 ? fromAttr : null;
}

/** Decode a base64 PNG/JPEG/GIF/BMP data URL and read its real pixel
 *  dimensions from the file header, so export never distorts the aspect
 *  ratio when only one dimension (or none) was set on the element. */
function naturalImageSize(buffer: Buffer, mime: string): { width: number; height: number } | null {
  try {
    if (mime === 'png' && buffer.length > 24 && buffer.readUInt32BE(0) === 0x89504e47) {
      return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
    }
    if ((mime === 'jpeg' || mime === 'jpg') && buffer.length > 4) {
      let offset = 2;
      while (offset < buffer.length - 8) {
        if (buffer[offset] !== 0xff) { offset += 1; continue; }
        const marker = buffer[offset + 1];
        if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
          return { height: buffer.readUInt16BE(offset + 5), width: buffer.readUInt16BE(offset + 7) };
        }
        const segLen = buffer.readUInt16BE(offset + 2);
        offset += 2 + segLen;
      }
    }
    if (mime === 'gif' && buffer.length > 10 && buffer.toString('ascii', 0, 3) === 'GIF') {
      return { width: buffer.readUInt16LE(6), height: buffer.readUInt16LE(8) };
    }
    if (mime === 'bmp' && buffer.length > 26 && buffer.toString('ascii', 0, 2) === 'BM') {
      return { width: buffer.readInt32LE(18), height: Math.abs(buffer.readInt32LE(22)) };
    }
  } catch {
    /* fall through to default sizing */
  }
  return null;
}

function imageRun(tag: string): ParagraphChild | null {
  const src = attrValue(tag, 'src');
  if (!src || !/^data:image\/(png|jpe?g|gif|bmp);base64,/i.test(src)) return null;
  const mime = src.match(/^data:image\/(png|jpe?g|gif|bmp)/i)?.[1].toLowerCase() || 'png';
  const type = mime === 'jpeg' ? 'jpg' : mime as 'png' | 'jpg' | 'gif' | 'bmp';
  const data = Buffer.from(src.split(',')[1], 'base64');
  const alt = attrValue(tag, 'alt') || 'Imagen';

  const natural = naturalImageSize(data, mime);
  const aspect = natural && natural.height > 0 ? natural.width / natural.height : null;
  const explicitWidth = pixelSize(tag, 'width');
  const explicitHeight = pixelSize(tag, 'height');

  let width: number;
  let height: number;
  if (explicitWidth && explicitHeight) {
    width = explicitWidth;
    height = explicitHeight;
  } else if (explicitWidth && aspect) {
    width = explicitWidth;
    height = Math.round(explicitWidth / aspect);
  } else if (explicitHeight && aspect) {
    height = explicitHeight;
    width = Math.round(explicitHeight * aspect);
  } else if (natural) {
    width = natural.width;
    height = natural.height;
  } else {
    width = explicitWidth || 420;
    height = explicitHeight || Math.round(width * 0.62);
  }

  // Cap to a sane page-fitting size while preserving aspect ratio.
  const maxWidth = 560;
  if (width > maxWidth) {
    const scale = maxWidth / width;
    width = maxWidth;
    height = Math.round(height * scale);
  }
  width = Math.max(20, Math.round(width));
  height = Math.max(20, Math.round(height));

  return new ImageRun({ type, data, transformation: { width, height }, altText: { title: alt, name: alt, description: alt } });
}

/**
 * Walk inline markup (bold/italic/underline/span color/font-size, math,
 * images, line breaks) and emit TextRuns that mirror exactly what the editor
 * shows — instead of stripping every tag and falling back to one flat size.
 */
function inlineChildren(html: string, baseStyle: RunStyle | number = 24): ParagraphChild[] {
  const base: RunStyle = typeof baseStyle === 'number' ? { size: baseStyle } : baseStyle;
  const baseSize = base.size ?? 24;
  const children: ParagraphChild[] = [];
  const tokenRe = /(<\/?(?:b|strong|i|em|u|s|strike|del|span)\b[^>]*>|<(?:span|div)\b[^>]*(?:data-tex|studio-math)[^>]*>[\s\S]*?<\/(?:span|div)>|\\\[[\s\S]*?\\\]|\\\([\s\S]*?\\\)|\$\$[\s\S]*?\$\$|\$[^$\n]+\$|<img\b[^>]*>|<br\s*\/?\s*>)/gi;
  const stack: RunStyle[] = [{ ...base }];
  let cursor = 0;

  const addText = (fragment: string) => {
    const text = stripTags(fragment);
    if (!text) return;
    const style = stack[stack.length - 1];
    children.push(new TextRun({
      text,
      font: 'Calibri',
      size: style.size ?? baseSize,
      bold: style.bold,
      italics: style.italics,
      underline: style.underline ? {} : undefined,
      strike: style.strike,
      color: style.color,
    }));
  };

  let match: RegExpExecArray | null;
  while ((match = tokenRe.exec(html))) {
    addText(html.slice(cursor, match.index));
    const token = match[0];
    if (/^<\/(b|strong|i|em|u|s|strike|del|span)\b/i.test(token)) {
      if (stack.length > 1) stack.pop();
    } else if (/^<(b|strong|i|em|u|s|strike|del|span)\b/i.test(token) && !/data-tex|studio-math/i.test(token)) {
      stack.push(styleFromTag(token, stack[stack.length - 1]));
    } else if (/^<img/i.test(token)) {
      const image = imageRun(token);
      if (image) children.push(image); else addText(`[${attrValue(token, 'alt') || 'Imagen'}]`);
    } else if (/^<br/i.test(token)) {
      children.push(new TextRun({ break: 1 }));
    } else {
      const tex = mathSource(token).replace(/^\$\$|\$\$$/g, '').replace(/^\$|\$$/g, '').trim();
      if (tex) children.push(new DocxMath({ children: latexComponents(tex) }));
    }
    cursor = match.index + token.length;
  }
  addText(html.slice(cursor));
  return children.length ? children : [new TextRun({ text: '', font: 'Calibri', size: baseSize })];
}

function htmlToDocxChildren(html: string): (Paragraph | Table)[] {
  const blocks = extractBlocks(html);
  const output: (Paragraph | Table)[] = [];
  for (const block of blocks) {
    if (block.kind === 'table') {
      const columnCount = Math.max(1, ...block.rows.map((row) => row.length));
      output.push(new Table({ width: { size: 9360, type: WidthType.DXA }, rows: block.rows.map((row, rowIndex) => new TableRow({ children: Array.from({ length: columnCount }, (_, index) => new TableCell({ borders, width: { size: Math.floor(9360 / columnCount), type: WidthType.DXA }, children: [new Paragraph({ children: inlineChildren(row[index] || '&nbsp;', 20) })] })) })) }));
      output.push(new Paragraph({ children: [] }));
      continue;
    }
    if (block.kind === 'math') {
      output.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 160, after: 160 }, children: [new DocxMath({ children: latexComponents(mathSource(block.html)) })] }));
      continue;
    }
    const heading = block.kind === 'h1' ? HeadingLevel.HEADING_1 : block.kind === 'h2' ? HeadingLevel.HEADING_2 : block.kind === 'h3' ? HeadingLevel.HEADING_3 : undefined;
    const defaultSize = heading ? (block.kind === 'h1' ? 32 : block.kind === 'h2' ? 28 : 24) : 24;
    // A block's own tag can carry an inline size/color (e.g. from the
    // selection format bar or an AI "make it smaller/red" edit). Read that
    // straight off <h1 style="...">, don't discard it for a fixed default —
    // this is what made heading size/color change on export.
    const tagStyle = block.attrs ? styleFromTag(block.attrs, { size: defaultSize }) : { size: defaultSize };
    const isOrdered = block.kind === 'li' && block.attrs === 'ol';
    output.push(new Paragraph({
      heading,
      alignment: block.attrs === 'blockquote' ? AlignmentType.LEFT : undefined,
      spacing: { before: heading ? 220 : 0, after: block.kind === 'pre' ? 140 : 160 },
      bullet: block.kind === 'li' && !isOrdered ? { level: 0 } : undefined,
      numbering: isOrdered ? { reference: 'studio-ordered-list', level: 0 } : undefined,
      indent: block.kind === 'li' ? { left: 360 } : undefined,
      children: block.kind === 'pre'
        ? [new TextRun({ text: stripTags(block.html), font: 'Consolas', size: 18 })]
        : inlineChildren(block.html, tagStyle),
    }));
  }
  return output;
}
