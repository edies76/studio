/**
 * Client-safe Word helpers. The real `docx` package is ONLY used in
 * `/api/export-docx` so Turbopack never bundles class/`super` code into the browser.
 */

import { htmlForWordExport } from '@/lib/math-html';

/** Fallback browser download as .doc (Word HTML). Prefer /api/export-docx for .docx. */
export function downloadHtmlDoc(editor: HTMLElement, title: string) {
  const html = htmlForWordExport(editor, title);
  const blob = new Blob(['\ufeff', html], { type: 'application/msword' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${(title || 'docs-studio').replace(/[^\w\- ]+/g, '').trim() || 'docs-studio'}.doc`;
  a.click();
  URL.revokeObjectURL(url);
}
