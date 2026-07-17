import { diffPlain, htmlToPlain, type DiffLine } from '@/lib/html-diff';

/** Build a clear HTML overlay: red strikethrough removals + green additions */
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
    parts.push(`<div class="studio-diff-same">${escape(bufSame.join(' '))}</div>`);
    bufSame = [];
  };
  const flushChange = () => {
    if (bufDel.length) {
      parts.push(
        `<div class="studio-diff-del"><span class="studio-diff-badge">−</span> ${escape(bufDel.join(' '))}</div>`,
      );
      bufDel = [];
    }
    if (bufAdd.length) {
      parts.push(
        `<div class="studio-diff-add"><span class="studio-diff-badge">+</span> ${escape(bufAdd.join(' '))}</div>`,
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
