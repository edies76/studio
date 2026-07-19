/**
 * Controlled document formatting for the agent.
 *
 * The model supplies intent; this module owns the CSS surface. Keeping the
 * whitelist here prevents arbitrary HTML/CSS while still letting Studio do
 * the practical things users expect from a document editor.
 */

export type FormatScope = 'document' | 'selection' | 'block';

export type DocumentFormatOptions = {
  scope?: FormatScope;
  blockIndex?: number;
  selectedText?: string;
  /** Exact substring to style when the agent names specific text/characters
   *  in the request (e.g. "pon la palabra X en rojo") without the user
   *  having actually selected anything in the editor. Independent of
   *  `scope` — if present, it always wins over scope=selection/document. */
  targetText?: string;
  /** Which occurrence of targetText to style (0-based). Omit for the first
   *  match, or 'all' to style every occurrence. */
  occurrence?: number | 'all';
  fontSize?: string | number;
  color?: string;
  backgroundColor?: string;
  fontFamily?: string;
  fontWeight?: 'normal' | 'bold' | '600' | '700';
  fontStyle?: 'normal' | 'italic';
  textAlign?: 'left' | 'center' | 'right' | 'justify';
  lineHeight?: string | number;
  letterSpacing?: string | number;
};

export type FormatResult = {
  html: string;
  changed: boolean;
  declarations: string[];
};

/**
 * Parse only unambiguous, atomic formatting commands. This is intentionally
 * small: clear editor actions should not depend on an LLM choosing a tool.
 */
export function parseExplicitFormatRequest(input: string): DocumentFormatOptions | null {
  const text = String(input || '').trim();
  if (!text) return null;

  const hasFormatSignal = /\b(letra|fuente|tama(?:ño|no)|color|negrita|cursiva|font|size|font-size|bold|italic|red|blue|green|black)\b/i.test(text);
  const hasActionSignal = /\b(cambia|cambiar|cámbiale|cambiale|pon|pone|ponle|aplica|aplicar|formatea|formatear|ajusta|ajustar|set|change|apply|format|make|set)\b/i.test(text);
  if (!hasFormatSignal || !hasActionSignal) return null;

  const result: DocumentFormatOptions = {};
  const size = text.match(
    /(?:tama(?:ño|no)|letra|font(?:\s*[- ]?size)?|size)\s*(?:de|en|a|:|=)?\s*(\d+(?:[.,]\d+)?)\s*(px|pt|pc|em|rem|%)?/i,
  );
  if (size) result.fontSize = `${size[1].replace(',', '.')}${size[2] || 'px'}`;

  const color = text.match(
    /(?:color|colores?)\s*(?:de\s*(?:la\s*)?(?:letra|fuente|texto)\s*)?(?:en|a|de|:|=)?\s*(rojo|red|azul|blue|verde|green|negro|black|blanco|white|gris|gray|grey|marr[oó]n|brown|amarillo|yellow|#[0-9a-f]{3,8}|rgba?\([\d\s.,%+-]+\))/i,
  );
  if (color) result.color = color[1];

  if (/\b(negrita|bold)\b/i.test(text)) result.fontWeight = 'bold';
  if (/\b(cursiva|italic)\b/i.test(text)) result.fontStyle = 'italic';
  if (!Object.keys(result).length) return null;
  return result;
}

const COLOR_NAMES: Record<string, string> = {
  rojo: '#d1242f',
  red: '#d1242f',
  azul: '#0969da',
  blue: '#0969da',
  verde: '#1a7f37',
  green: '#1a7f37',
  negro: '#171717',
  black: '#171717',
  blanco: '#ffffff',
  white: '#ffffff',
  gris: '#6b7280',
  gray: '#6b7280',
  grey: '#6b7280',
  marron: '#3d3229',
  marrón: '#3d3229',
  brown: '#3d3229',
  amarillo: '#facc15',
  yellow: '#facc15',
};

const BLOCK_OPEN_RE = /<(p|h[1-6]|li|blockquote|pre|table|th|td|ul|ol)(\s[^>]*)?>/gi;

function cssValue(value: unknown, kind: 'length' | 'color' | 'family'): string | null {
  if (value == null) return null;
  const raw = String(value).trim();
  if (!raw || /[<>"'`;{}]|url\s*\(|expression\s*\(|javascript:/i.test(raw)) return null;

  if (kind === 'color') {
    const lower = raw.toLowerCase();
    if (COLOR_NAMES[lower]) return COLOR_NAMES[lower];
    if (/^#[0-9a-f]{3,8}$/i.test(raw)) return raw;
    if (/^(?:rgb|rgba|hsl|hsla)\([\d\s.,%+-]+\)$/i.test(raw)) return raw;
    if (/^[a-z]{3,20}$/i.test(raw)) return raw.toLowerCase();
    return null;
  }

  if (kind === 'length') {
    if (/^\d+(?:\.\d+)?(?:px|pt|pc|em|rem|%|vh|vw)?$/i.test(raw)) return raw;
    return null;
  }

  if (!/^[\w\s,.-]{2,80}$/.test(raw)) return null;
  return raw;
}

function formatDeclarations(options: DocumentFormatOptions): string[] {
  const out: string[] = [];
  const size = cssValue(options.fontSize, 'length');
  const color = cssValue(options.color, 'color');
  const background = cssValue(options.backgroundColor, 'color');
  const family = cssValue(options.fontFamily, 'family');
  const lineHeight = cssValue(options.lineHeight, 'length');
  const letterSpacing = cssValue(options.letterSpacing, 'length');

  if (size) out.push(`font-size:${/^\d/.test(size) && !/[a-z%]/i.test(size) ? `${size}px` : size}`);
  if (color) out.push(`color:${color}`);
  if (background) out.push(`background-color:${background}`);
  if (family) out.push(`font-family:${family}`);
  if (options.fontWeight && ['normal', 'bold', '600', '700'].includes(options.fontWeight)) {
    out.push(`font-weight:${options.fontWeight}`);
  }
  if (options.fontStyle && ['normal', 'italic'].includes(options.fontStyle)) {
    out.push(`font-style:${options.fontStyle}`);
  }
  if (options.textAlign && ['left', 'center', 'right', 'justify'].includes(options.textAlign)) {
    out.push(`text-align:${options.textAlign}`);
  }
  if (lineHeight) out.push(`line-height:${lineHeight}`);
  if (letterSpacing) out.push(`letter-spacing:${letterSpacing}`);
  return out;
}

function mergeStyle(attrs: string, declarations: string[]): string {
  const styleMatch = attrs.match(/\sstyle\s*=\s*(["'])([\s\S]*?)\1/i);
  const entries = new Map<string, string>();
  if (styleMatch?.[2]) {
    for (const part of styleMatch[2].split(';')) {
      const match = part.trim().match(/^([\w-]+)\s*:\s*(.+)$/);
      if (match) entries.set(match[1].toLowerCase(), match[2].trim());
    }
  }
  for (const declaration of declarations) {
    const [property, ...value] = declaration.split(':');
    entries.set(property, value.join(':'));
  }
  const style = Array.from(entries, ([property, value]) => `${property}:${value}`).join(';');
  if (styleMatch) return attrs.replace(styleMatch[0], ` style="${style}"`);
  return `${attrs} style="${style}"`;
}

function styleOpeningTag(fragment: string, declarations: string[]): string {
  return fragment.replace(/^(<[^\s/>]+)([^>]*)(>)$/, (_match, tag, attrs, close) => {
    return `${tag}${mergeStyle(String(attrs || ''), declarations)}${close}`;
  });
}

function styleBlocks(html: string, declarations: string[]): string {
  return html.replace(BLOCK_OPEN_RE, (opening) => styleOpeningTag(opening, declarations));
}

function styleOneBlock(html: string, blockHtml: string, declarations: string[]): string {
  const start = html.indexOf(blockHtml);
  if (start < 0) return html;
  const end = start + blockHtml.length;
  const target = html.slice(start, end);
  const styled = target.replace(BLOCK_OPEN_RE, (opening) => styleOpeningTag(opening, declarations));
  return html.slice(0, start) + styled + html.slice(end);
}

/**
 * Style an exact text fragment wherever it appears in the document's raw
 * text flow — down to a single character or a mid-word range. Works whether
 * the text came from a real DOM selection (scope=selection) or the agent
 * just naming it from the conversation (targetText, no selection needed).
 */
function styleTextFragment(
  html: string,
  fragment: string,
  declarations: string[],
  occurrence: number | 'all' = 0,
): { html: string; matched: number } {
  const text = fragment.trim();
  if (!text) return { html, matched: 0 };
  const escaped = text.replace(/[&<>]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[char] || char);
  const style = declarations.join(';');

  let result = '';
  let cursor = 0;
  let found = -1;
  let matched = 0;
  while ((found = html.indexOf(text, cursor)) !== -1) {
    // Never split an existing tag — only match plain text runs.
    const before = html.slice(0, found);
    const lastOpen = before.lastIndexOf('<');
    const lastClose = before.lastIndexOf('>');
    const insideTag = lastOpen > lastClose;
    if (insideTag) {
      result += html.slice(cursor, found + text.length);
      cursor = found + text.length;
      continue;
    }
    const shouldStyle = occurrence === 'all' || matched === occurrence;
    result += html.slice(cursor, found);
    result += shouldStyle ? `<span style="${style}">${escaped}</span>` : html.slice(found, found + text.length);
    cursor = found + text.length;
    matched += 1;
    if (occurrence !== 'all' && matched > occurrence) break;
  }
  result += html.slice(cursor);
  return { html: matched > 0 ? result : html, matched };
}

export function formatDocumentHtml(html: string, options: DocumentFormatOptions): FormatResult {
  const declarations = formatDeclarations(options);
  if (!html || !declarations.length) return { html, changed: false, declarations };

  // An explicit targetText (agent naming exact words/characters) always
  // wins — it lets the agent style a fragment down to a single character
  // or a mid-word range, even with nothing selected in the editor.
  if (options.targetText?.trim()) {
    const { html: next, matched } = styleTextFragment(html, options.targetText, declarations, options.occurrence ?? 0);
    return { html: next, changed: matched > 0, declarations };
  }

  const scope = options.scope || 'document';
  let next = html;
  if (scope === 'selection') {
    next = styleTextFragment(html, options.selectedText || '', declarations, 0).html;
  } else if (scope === 'block' && Number.isFinite(options.blockIndex)) {
    // The caller passes the exact block HTML through `selectedText` for this
    // scope. This keeps this helper server-safe and avoids a DOM dependency.
    next = styleOneBlock(html, options.selectedText || '', declarations);
  } else {
    next = styleBlocks(html, declarations);
  }
  return { html: next, changed: next !== html, declarations };
}
