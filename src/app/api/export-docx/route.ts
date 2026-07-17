import { NextRequest } from 'next/server';
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
  AlignmentType,
} from 'docx';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const border = { style: BorderStyle.SINGLE, size: 8, color: '333333' };
const borders = { top: border, bottom: border, left: border, right: border };

/** Minimal HTML → docx on the server (keeps `docx` out of the client bundle). */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const html = String(body.html || '');
    const title = String(body.title || 'Docs Studio').slice(0, 120);

    if (!html.trim()) {
      return Response.json({ error: 'Empty document' }, { status: 400 });
    }

    const children = htmlToDocxChildren(html);
    const doc = new Document({
      creator: 'Docs Studio',
      title,
      sections: [
        {
          properties: {
            page: {
              margin: { top: 1440, bottom: 1440, left: 1440, right: 1440 },
            },
          },
          children: children.length
            ? children
            : [new Paragraph({ children: [new TextRun({ text: '' })] })],
        },
      ],
    });

    const buffer = await Packer.toBuffer(doc);
    const safe = title.replace(/[^\w\- ]+/g, '').trim() || 'docs-studio';

    return new Response(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type':
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename="${safe}.docx"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (e: any) {
    return Response.json(
      { error: e?.message || 'Export failed' },
      { status: 500 },
    );
  }
}

type Block =
  | { kind: 'h1' | 'h2' | 'h3' | 'p' | 'li' | 'pre' | 'math'; text: string }
  | { kind: 'table'; rows: string[][] };

function decodeEntities(s: string) {
  return s
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function stripTags(s: string) {
  return decodeEntities(
    s
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/\s+/g, ' ')
      .trim(),
  );
}

function htmlToDocxChildren(html: string) {
  const blocks: Block[] = [];
  // Normalize MathJax / our math wrappers to plain tex markers
  let h = html
    .replace(/<\/?(html|head|body)[^>]*>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '');

  h = h.replace(
    /<(span|div)[^>]*class="[^"]*studio-math[^"]*"[^>]*data-tex="([^"]*)"[^>]*>[\s\S]*?<\/\1>/gi,
    (_m, _t, tex) => `<p class="math">$$ ${tex} $$</p>`,
  );
  h = h.replace(
    /<mjx-container[\s\S]*?<annotation[^>]*>([\s\S]*?)<\/annotation>[\s\S]*?<\/mjx-container>/gi,
    (_m, tex) => `<p class="math">$$ ${String(tex).trim()} $$</p>`,
  );

  // Tables
  h = h.replace(/<table[^>]*>([\s\S]*?)<\/table>/gi, (_m, inner) => {
    const rows: string[][] = [];
    const rowRe = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
    let rm: RegExpExecArray | null;
    while ((rm = rowRe.exec(inner))) {
      const cells: string[] = [];
      const cellRe = /<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/gi;
      let cm: RegExpExecArray | null;
      while ((cm = cellRe.exec(rm[1]))) {
        cells.push(stripTags(cm[1]) || ' ');
      }
      if (cells.length) rows.push(cells);
    }
    if (rows.length) blocks.push({ kind: 'table', rows });
    return '\n';
  });

  // Block tags in order
  const re =
    /<(h1|h2|h3|p|li|pre|blockquote)(\s[^>]*)?>([\s\S]*?)<\/\1>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(h))) {
    const tag = m[1].toLowerCase();
    const attrs = m[2] || '';
    const text = stripTags(m[3]);
    if (!text) continue;
    if (tag === 'h1') blocks.push({ kind: 'h1', text });
    else if (tag === 'h2') blocks.push({ kind: 'h2', text });
    else if (tag === 'h3') blocks.push({ kind: 'h3', text });
    else if (tag === 'li') blocks.push({ kind: 'li', text });
    else if (tag === 'pre') blocks.push({ kind: 'pre', text });
    else if (/math/i.test(attrs) || /^\$\$/.test(text)) blocks.push({ kind: 'math', text });
    else blocks.push({ kind: 'p', text });
  }

  if (!blocks.length) {
    const plain = stripTags(h);
    if (plain) {
      plain.split(/\n+/).forEach((line) => {
        if (line.trim()) blocks.push({ kind: 'p', text: line.trim() });
      });
    }
  }

  const out: (Paragraph | Table)[] = [];
  for (const b of blocks) {
    if (b.kind === 'table') {
      const rows = b.rows.map(
        (row) =>
          new TableRow({
            children: row.map(
              (cell) =>
                new TableCell({
                  borders,
                  width: { size: Math.floor(9360 / Math.max(row.length, 1)), type: WidthType.DXA },
                  children: [
                    new Paragraph({
                      children: [new TextRun({ text: cell, font: 'Calibri', size: 20 })],
                    }),
                  ],
                }),
            ),
          }),
      );
      out.push(new Table({ width: { size: 9360, type: WidthType.DXA }, rows }));
      out.push(new Paragraph({ children: [] }));
      continue;
    }

    if (b.kind === 'h1') {
      out.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_1,
          spacing: { before: 240, after: 120 },
          children: [new TextRun({ text: b.text, bold: true, font: 'Calibri', size: 32 })],
        }),
      );
    } else if (b.kind === 'h2') {
      out.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 200, after: 100 },
          children: [new TextRun({ text: b.text, bold: true, font: 'Calibri', size: 28 })],
        }),
      );
    } else if (b.kind === 'h3') {
      out.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_3,
          spacing: { before: 160, after: 80 },
          children: [new TextRun({ text: b.text, bold: true, font: 'Calibri', size: 24 })],
        }),
      );
    } else if (b.kind === 'li') {
      out.push(
        new Paragraph({
          spacing: { after: 80 },
          indent: { left: 360 },
          children: [
            new TextRun({ text: `• ${b.text}`, font: 'Calibri', size: 24 }),
          ],
        }),
      );
    } else if (b.kind === 'pre') {
      out.push(
        new Paragraph({
          spacing: { after: 120 },
          children: [new TextRun({ text: b.text, font: 'Consolas', size: 18 })],
        }),
      );
    } else if (b.kind === 'math') {
      out.push(
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 120, after: 120 },
          children: [
            new TextRun({
              text: b.text.replace(/^\$\$|\$\$$/g, '').trim(),
              italics: true,
              font: 'Cambria Math',
              size: 24,
            }),
          ],
        }),
      );
    } else {
      out.push(
        new Paragraph({
          spacing: { after: 160 },
          children: [new TextRun({ text: b.text, font: 'Calibri', size: 24 })],
        }),
      );
    }
  }

  return out;
}
