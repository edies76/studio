/**
 * Keeps the first generated document semantic and predictable.
 * The canvas owns layout; the model must not smuggle a cover design into it.
 * Output should look like a normal student/Word document — not a landing page.
 */
export function normaliseDraftHtml(raw: string): string {
  const trimmed = String(raw || '').trimStart();
  if (!/^```(?:html)?\s*/i.test(trimmed)) return raw;
  return trimmed.replace(/^```(?:html)?\s*/i, '').replace(/\s*```\s*$/i, '');
}

const PLAIN_DOC_TAGS = new Set([
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'p',
  'ul',
  'ol',
  'li',
  'strong',
  'b',
  'em',
  'i',
  'u',
  'blockquote',
  'table',
  'thead',
  'tbody',
  'tfoot',
  'tr',
  'th',
  'td',
  'pre',
  'code',
  'br',
  'span',
  'div',
  'sup',
  'sub',
  'a',
]);

/** True when a chat/assistant payload is already an HTML fragment. */
export function looksLikeHtmlFragment(value: string): boolean {
  const s = String(value || '').trim();
  if (!s.startsWith('<')) return false;
  return /<\/?(?:p|h[1-6]|ul|ol|li|div|span|table|blockquote|pre|strong|em)\b/i.test(s);
}

export function compactDraftHtml(raw: string): string {
  let html = normaliseDraftHtml(raw);
  // These assets made the first draft look like a generated landing page and
  // were not editable in the canvas. The user can insert an image explicitly.
  html = html
    .replace(/<svg\b[\s\S]*?<\/svg>/gi, '')
    .replace(/<img\b[^>]*>/gi, '')
    .replace(/<hr\b[^>]*>/gi, '')
    .replace(/<figure\b[\s\S]*?<\/figure>/gi, '')
    .replace(/<\/?(?:section|article|header|footer|nav|aside|main|canvas|button|form)\b[^>]*>/gi, '')
    .replace(/<\/?(?:font|center|marquee)\b[^>]*>/gi, '')
    // A short italic paragraph immediately after the title is the model's
    // usual invented cover subtitle. Remove only that position, preserving
    // legitimate emphasis inside the body.
    .replace(/(<h1\b[^>]*>[\s\S]*?<\/h1>)\s*<p\b[^>]*>\s*<em>[^<]{0,160}<\/em>\s*<\/p>/i, '$1')
    // Drop empty decorative wrappers the model often invents.
    .replace(/<div\b[^>]*>\s*<\/div>/gi, '')
    // Visual style belongs to the canvas, not to model HTML. Keep semantic
    // classes only for math hosts so equations remain editable.
    .replace(/\sstyle\s*=\s*("[^"]*"|'[^']*')/gi, '')
    .replace(/\sclass\s*=\s*("(?![^"']*studio-math)[^"]*"|'(?![^"']*studio-math)[^']*')/gi, '')
    .replace(/\s(?:id|role|aria-[\w-]+|data-(?!tex|display|studio-)[\w-]*)\s*=\s*("[^"]*"|'[^']*')/gi, '');

  // Unwrap unknown block tags while keeping their text/children.
  html = html.replace(/<\/?([a-z][\w-]*)\b[^>]*>/gi, (match, rawTag: string) => {
    const tag = rawTag.toLowerCase();
    if (PLAIN_DOC_TAGS.has(tag)) return match;
    return '';
  });

  return html.trim();
}
