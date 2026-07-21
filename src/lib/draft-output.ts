/**
 * Keeps the first generated document semantic and predictable.
 * The canvas owns layout; the model must not smuggle a cover design into it.
 */
export function normaliseDraftHtml(raw: string): string {
  const trimmed = String(raw || '').trimStart();
  if (!/^```(?:html)?\s*/i.test(trimmed)) return raw;
  return trimmed.replace(/^```(?:html)?\s*/i, '').replace(/\s*```\s*$/i, '');
}

export function compactDraftHtml(raw: string): string {
  let html = normaliseDraftHtml(raw);
  // These assets made the first draft look like a generated landing page and
  // were not editable in the canvas. The user can insert an image explicitly.
  html = html
    .replace(/<svg\b[\s\S]*?<\/svg>/gi, '')
    .replace(/<img\b[^>]*>/gi, '')
    .replace(/<hr\b[^>]*>/gi, '')
    .replace(/<figure\b[^>]*>\s*<\/figure>/gi, '')
    // A short italic paragraph immediately after the title is the model's
    // usual invented cover subtitle. Remove only that position, preserving
    // legitimate emphasis inside the body.
    .replace(/(<h1\b[^>]*>[\s\S]*?<\/h1>)\s*<p\b[^>]*>\s*<em>[^<]{0,160}<\/em>\s*<\/p>/i, '$1')
    // Visual style belongs to the canvas, not to model HTML. Keep semantic
    // classes only for math hosts so equations remain editable.
    .replace(/\sstyle\s*=\s*("[^"]*"|'[^']*')/gi, '')
    .replace(/\sclass\s*=\s*("(?![^"']*studio-math)[^"]*"|'(?![^"']*studio-math)[^']*')/gi, '');
  return html.trim();
}
