import { diffPlain, htmlToPlain, type DiffLine } from '@/lib/html-diff';

/** Build canvas overlay: light-red underline removals + green keep/additions */
export function buildCanvasDiffHtml(beforeHtml: string, afterHtml: string): string {
  const lines = diffPlain(htmlToPlain(beforeHtml || ''), htmlToPlain(afterHtml || ''));
  if (!lines.length) {
    return afterHtml || '';
  }

  const parts: string[] = [];
  let bufDel: string[] = [];
  let bufAdd: string[] = [];
  let bufSame: string[] = [];

  const flushSame = () => {
    if (!bufSame.length) return;
    // Unchanged stays readable (kept)
    parts.push(`<p class="studio-diff-same">${escape(bufSame.join(' '))}</p>`);
    bufSame = [];
  };
  const flushChange = () => {
    if (bufDel.length) {
      // Soft red + underline = will be removed
      parts.push(
        `<p class="studio-diff-del"><span class="studio-diff-del-text">${escape(bufDel.join(' '))}</span></p>`,
      );
      bufDel = [];
    }
    if (bufAdd.length) {
      // Green highlight = will remain / be added
      parts.push(
        `<p class="studio-diff-add"><span class="studio-diff-add-text">${escape(bufAdd.join(' '))}</span></p>`,
      );
      bufAdd = [];
    }
  };

  for (const l of lines) {
    if (l.type === 'same') {
      flushChange();
      bufSame.push(l.text);
    } else if (l.type === 'del') {
      flushSame();
      bufDel.push(l.text);
    } else {
      flushSame();
      bufAdd.push(l.text);
    }
  }
  flushChange();
  flushSame();

  return `<div class="studio-diff-root">${parts.join('')}</div>`;
}

function escape(s: string) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export type { DiffLine };
