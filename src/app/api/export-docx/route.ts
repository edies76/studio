import { NextRequest } from 'next/server';
import {
  AlignmentType,
  BorderStyle,
  Document,
  HeadingLevel,
  ImageRun,
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
    const text = stripTags(fragment);
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

function imageRun(tag: string): ParagraphChild | null {
  const src = attrValue(tag, 'src');
  if (!src || !/^data:image\/(png|jpe?g|gif|bmp);base64,/i.test(src)) return null;
  const mime = src.match(/^data:image\/(png|jpe?g|gif|bmp)/i)?.[1].toLowerCase() || 'png';
  const type = mime === 'jpeg' ? 'jpg' : mime as 'png' | 'jpg' | 'gif' | 'bmp';
  const width = Math.min(560, Math.max(80, Number(attrValue(tag, 'width')) || 420));
  const height = Math.max(60, Math.round(width * 0.62));
  const alt = attrValue(tag, 'alt') || 'Imagen';
  return new ImageRun({ type, data: Buffer.from(src.split(',')[1], 'base64'), transformation: { width, height }, altText: { title: alt, name: alt, description: alt } });
}

function inlineChildren(html: string, size = 24): ParagraphChild[] {
  const children: ParagraphChild[] = [];
  const tokenRe = /(<(?:span|div)\b[^>]*(?:data-tex|studio-math)[^>]*>[\s\S]*?<\/(?:span|div)>|\\\[[\s\S]*?\\\]|\\\([\s\S]*?\\\)|\$\$[\s\S]*?\$\$|\$[^$\n]+\$|<img\b[^>]*>|<br\s*\/?\s*>)/gi;
  let cursor = 0;
  const addText = (fragment: string) => { const text = stripTags(fragment); if (text) children.push(new TextRun({ text, font: 'Calibri', size })); };
  let match: RegExpExecArray | null;
  while ((match = tokenRe.exec(html))) {
    addText(html.slice(cursor, match.index));
    const token = match[0];
    if (/^<img/i.test(token)) {
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
  return children.length ? children : [new TextRun({ text: '', font: 'Calibri', size })];
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
    output.push(new Paragraph({
      heading,
      alignment: block.attrs === 'blockquote' ? AlignmentType.LEFT : undefined,
      spacing: { before: heading ? 220 : 0, after: block.kind === 'pre' ? 140 : 160 },
      indent: block.kind === 'li' ? { left: 360 } : undefined,
      children: block.kind === 'pre' ? [new TextRun({ text: stripTags(block.html), font: 'Consolas', size: 18 })] : inlineChildren(block.kind === 'li' ? `• ${block.html}` : block.html, heading ? (block.kind === 'h1' ? 32 : block.kind === 'h2' ? 28 : 24) : 24),
    }));
  }
  return output;
}
