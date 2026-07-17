/**
 * Normalize AI HTML so MathJax can render; keep tables editable; support formula edit.
 */

/** Fix common broken LaTeX / delimiter issues from LLMs */
export function sanitizeDocumentHtml(html: string): string {
  let h = html || '';

  h = h.replace(/<\/?(html|head|body)[^>]*>/gi, '');

  // Convert $$ ... $$ display math
  h = h.replace(/\$\$([\s\S]*?)\$\$/g, (_m, inner) => `\\[${String(inner).trim()}\\]`);

  // Convert single $...$ to \(...\)
  h = h.replace(/\$([^$\n]{1,200}?)\$/g, (m, inner) => {
    if (m.startsWith('$$')) return m;
    return `\\(${inner}\\)`;
  });

  // Double-escaped delimiters
  h = h.replace(/\\\\(\[|\(|\]|\))/g, '\\$1');

  h = h.replace(/\\begin\s*\{\s*cases\s*\}/gi, '\\begin{cases}');
  h = h.replace(/\\end\s*\{\s*cases\s*\}/gi, '\\end{cases}');
  h = h.replace(/\\begin\s*\{\s*align\*?\\s*\}/gi, '\\begin{align*}');
  h = h.replace(/\\end\s*\{\s*align\*?\\s*\}/gi, '\\end{align*}');

  // Tables: clean width junk, keep real table layout (not display:block)
  h = h.replace(/<table([^>]*)>/gi, (_m, attrs) => {
    let a = String(attrs || '');
    a = a.replace(/\sstyle="[^"]*"/gi, '');
    return `<table class="studio-table"${a}>`;
  });
  h = h.replace(/<th([^>]*)>/gi, (_m, attrs) => {
    let a = String(attrs || '');
    if (!/class=/i.test(a)) a += ' class="studio-th"';
    return `<th${a}>`;
  });
  h = h.replace(/<td([^>]*)>/gi, (_m, attrs) => {
    let a = String(attrs || '');
    if (!/class=/i.test(a)) a += ' class="studio-td"';
    return `<td${a}>`;
  });

  h = h.replace(
    /<pre([^>]*)>/gi,
    '<pre$1 style="white-space:pre-wrap;word-break:break-word;overflow-x:auto;max-width:100%">',
  );
  h = h.replace(/<img([^>]*)>/gi, '<img$1 style="max-width:100%;height:auto"');

  return h;
}

export function typesetEditor(el: HTMLElement | null): void {
  if (!el || typeof window === 'undefined') return;
  const mj = (window as any).MathJax;
  if (!mj) return;
  const run = () => {
    try {
      if (mj.typesetClear) mj.typesetClear([el]);
      if (mj.typesetPromise) {
        mj.typesetPromise([el]).catch(() => {
          /* ignore */
        });
      }
    } catch {
      /* ignore */
    }
  };
  if (mj.startup?.promise) {
    mj.startup.promise.then(run).catch(run);
  } else {
    run();
  }
}

/** Extract TeX source from a MathJax node or annotated span */
export function getMathSource(node: HTMLElement): string | null {
  // Our edit wrappers
  const data = node.getAttribute('data-tex') || node.closest('[data-tex]')?.getAttribute('data-tex');
  if (data) return data;

  // MathJax 3 annotation
  const ann =
    node.querySelector('annotation[encoding="application/x-tex"]') ||
    node.closest('mjx-container')?.querySelector('annotation[encoding="application/x-tex"]');
  if (ann?.textContent) return ann.textContent.trim();

  // Raw \( \) still in DOM
  const t = node.textContent || '';
  const inline = t.match(/\\\(([\s\S]+?)\\\)/);
  if (inline) return inline[1].trim();
  const display = t.match(/\\\[([\s\S]+?)\\\]/);
  if (display) return display[1].trim();
  return null;
}

/** Insert inline math at selection / end of editor */
export function insertMathAtSelection(
  editor: HTMLElement,
  tex: string,
  display = false,
): void {
  const wrapped = display ? `\\[${tex}\\]` : `\\(${tex}\\)`;
  const span = document.createElement(display ? 'div' : 'span');
  span.className = display ? 'studio-math-block' : 'studio-math-inline';
  span.setAttribute('data-tex', tex);
  span.setAttribute('data-display', display ? '1' : '0');
  span.contentEditable = 'false';
  span.textContent = wrapped;

  const sel = window.getSelection();
  if (sel && sel.rangeCount && editor.contains(sel.anchorNode)) {
    const range = sel.getRangeAt(0);
    range.deleteContents();
    range.insertNode(span);
    range.setStartAfter(span);
    range.collapse(true);
    sel.removeAllRanges();
    sel.addRange(range);
  } else {
    editor.appendChild(span);
  }
  typesetEditor(editor);
}

/** Replace a math node after user edits TeX source */
export function replaceMathNode(
  editor: HTMLElement,
  target: HTMLElement,
  tex: string,
  display: boolean,
): void {
  const host =
    (target.closest('.studio-math-inline, .studio-math-block, mjx-container') as HTMLElement) ||
    target;
  const span = document.createElement(display ? 'div' : 'span');
  span.className = display ? 'studio-math-block' : 'studio-math-inline';
  span.setAttribute('data-tex', tex);
  span.setAttribute('data-display', display ? '1' : '0');
  span.contentEditable = 'false';
  span.textContent = display ? `\\[${tex}\\]` : `\\(${tex}\\)`;
  host.replaceWith(span);
  typesetEditor(editor);
}

/** Insert a simple editable table */
export function insertTableAtSelection(
  editor: HTMLElement,
  rows = 3,
  cols = 3,
): void {
  const table = document.createElement('table');
  table.className = 'studio-table';
  const tbody = document.createElement('tbody');
  for (let r = 0; r < rows; r++) {
    const tr = document.createElement('tr');
    for (let c = 0; c < cols; c++) {
      const cell = document.createElement(r === 0 ? 'th' : 'td');
      cell.className = r === 0 ? 'studio-th' : 'studio-td';
      cell.innerHTML = r === 0 ? `Col ${c + 1}` : '&nbsp;';
      tr.appendChild(cell);
    }
    tbody.appendChild(tr);
  }
  table.appendChild(tbody);
  const p = document.createElement('p');
  p.innerHTML = '<br>';

  const sel = window.getSelection();
  if (sel && sel.rangeCount && editor.contains(sel.anchorNode)) {
    const range = sel.getRangeAt(0);
    range.deleteContents();
    range.insertNode(p);
    range.insertNode(table);
  } else {
    editor.appendChild(table);
    editor.appendChild(p);
  }
}

/**
 * HTML prepared for Word: strip MathJax chrome, keep TeX as OMML-friendly text,
 * solid table borders, page margins.
 */
export function htmlForWordExport(editor: HTMLElement, title: string): string {
  const clone = editor.cloneNode(true) as HTMLElement;

  // Convert MathJax / math spans back to readable LaTeX or Unicode
  clone.querySelectorAll('mjx-container, .studio-math-inline, .studio-math-block').forEach((node) => {
    const el = node as HTMLElement;
    const tex =
      el.getAttribute('data-tex') ||
      el.querySelector('annotation[encoding="application/x-tex"]')?.textContent ||
      el.textContent ||
      '';
    const display =
      el.getAttribute('data-display') === '1' || el.tagName.toLowerCase() === 'mjx-container';
    const span = document.createElement(display ? 'p' : 'span');
    span.style.fontFamily = 'Cambria Math, Times New Roman, serif';
    span.textContent = display ? `$$ ${tex.trim()} $$` : `$${tex.trim()}$`;
    el.replaceWith(span);
  });

  // Normalize tables for Word
  clone.querySelectorAll('table').forEach((t) => {
    t.setAttribute('border', '1');
    t.setAttribute('cellpadding', '6');
    t.setAttribute('cellspacing', '0');
    t.setAttribute('width', '100%');
    (t as HTMLElement).style.borderCollapse = 'collapse';
    (t as HTMLElement).style.width = '100%';
  });
  clone.querySelectorAll('td, th').forEach((c) => {
    (c as HTMLElement).style.border = '1px solid #333';
    (c as HTMLElement).style.padding = '6px 8px';
    if (c.tagName.toLowerCase() === 'th') {
      (c as HTMLElement).style.background = '#f3f3f3';
      (c as HTMLElement).style.fontWeight = 'bold';
    }
  });

  const body = clone.innerHTML;
  return `<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:w="urn:schemas-microsoft-com:office:word"
 xmlns="http://www.w3.org/TR/REC-html40">
<head>
<meta charset="utf-8">
<meta name="ProgId" content="Word.Document">
<meta name="Generator" content="Docs Studio">
<title>${escapeHtml(title || 'Docs Studio')}</title>
<!--[if gte mso 9]>
<xml>
  <w:WordDocument>
    <w:View>Print</w:View>
    <w:Zoom>100</w:Zoom>
    <w:DoNotOptimizeForBrowser/>
  </w:WordDocument>
</xml>
<![endif]-->
<style>
  @page { size: letter; margin: 1in; }
  body {
    font-family: Inter, Calibri, Arial, sans-serif;
    font-size: 12pt;
    line-height: 1.5;
    color: #111;
  }
  h1 { font-size: 18pt; margin: 12pt 0 8pt; }
  h2 { font-size: 14pt; margin: 12pt 0 6pt; }
  h3 { font-size: 12pt; margin: 10pt 0 4pt; }
  p { margin: 0 0 8pt; }
  table { border-collapse: collapse; width: 100%; margin: 10pt 0; }
  th, td { border: 1px solid #333; padding: 6px 8px; vertical-align: top; }
  th { background: #f3f3f3; font-weight: bold; }
  pre, code { font-family: Consolas, monospace; font-size: 10pt; }
  ul, ol { margin: 0 0 8pt 18pt; }
</style>
</head>
<body>
${body}
</body>
</html>`;
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
