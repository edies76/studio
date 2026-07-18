/**
 * Math inventory + safe equation edits for the agent.
 * Keeps LaTeX in data-tex / \( \) / \[ \] so free-form HTML rewrites don't corrupt formulas.
 */

export type MathEntry = {
  index: number;
  display: boolean;
  tex: string;
  /** Outer HTML of the math host (span/div or raw delimiters block) */
  outerHtml: string;
  contextPreview: string;
};

const WRAP_RE =
  /<(span|div)([^>]*\b(?:studio-math|data-tex|class="[^"]*math)[^>]*)>([\s\S]*?)<\/\1>/gi;
const DELIM_DISPLAY = /\\\[([\s\S]+?)\\\]/g;
const DELIM_INLINE = /\\\(([\s\S]+?)\\\)/g;

function stripTags(s: string) {
  return s.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function extractTexFromHost(html: string, inner: string): string {
  const data = html.match(/data-tex="([^"]*)"/i);
  if (data?.[1]) {
    return data[1]
      .replace(/&quot;/g, '"')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&');
  }
  const ann = inner.match(/encoding="application\/x-tex"[^>]*>([\s\S]*?)<\/annotation>/i);
  if (ann?.[1]) return ann[1].trim();
  const disp = inner.match(/\\\[([\s\S]+?)\\\]/);
  if (disp) return disp[1].trim();
  const inl = inner.match(/\\\(([\s\S]+?)\\\)/);
  if (inl) return inl[1].trim();
  return stripTags(inner).slice(0, 200);
}

/** List equations in document order (for list_equations tool) */
export function listEquations(html: string): MathEntry[] {
  const out: MathEntry[] = [];
  if (!html) return out;
  const seen = new Set<string>();

  let m: RegExpExecArray | null;
  const wrap = new RegExp(WRAP_RE.source, 'gi');
  while ((m = wrap.exec(html))) {
    const full = m[0];
    const attrs = m[2] || '';
    const inner = m[3] || '';
    const display =
      /data-display="1"|studio-math-block|display\s*=\s*["']?true/i.test(attrs + full);
    const tex = extractTexFromHost(full, inner);
    const key = `${display}:${tex}:${m.index}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const start = Math.max(0, m.index - 40);
    const ctx = stripTags(html.slice(start, m.index + full.length + 40)).slice(0, 120);
    out.push({
      index: out.length,
      display,
      tex,
      outerHtml: full,
      contextPreview: ctx,
    });
  }

  // Raw delimiters not already inside wrappers
  const rawScan = (re: RegExp, display: boolean) => {
    re.lastIndex = 0;
    let rm: RegExpExecArray | null;
    while ((rm = re.exec(html))) {
      const full = rm[0];
      // skip if inside a studio-math host we already captured
      const before = html.slice(Math.max(0, rm.index - 80), rm.index);
      if (/studio-math|data-tex/i.test(before) && !before.includes('</')) continue;
      const tex = (rm[1] || '').trim();
      if (!tex) continue;
      const key = `raw:${display}:${tex}:${rm.index}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const start = Math.max(0, rm.index - 40);
      out.push({
        index: out.length,
        display,
        tex,
        outerHtml: full,
        contextPreview: stripTags(html.slice(start, rm.index + full.length + 40)).slice(0, 120),
      });
    }
  };
  rawScan(new RegExp(DELIM_DISPLAY.source, 'g'), true);
  rawScan(new RegExp(DELIM_INLINE.source, 'g'), false);

  // reindex
  return out.map((e, i) => ({ ...e, index: i }));
}

/** Build safe math HTML host the editor + MathJax understand */
export function buildMathHtml(tex: string, display: boolean): string {
  const safe = (tex || '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  const raw = (tex || '').trim();
  if (display) {
    return `<div class="studio-math-block" data-tex="${safe}" data-display="1">\\[${raw}\\]</div>`;
  }
  return `<span class="studio-math-inline" data-tex="${safe}" data-display="0">\\(${raw}\\)</span>`;
}

/**
 * Replace equation at index with new TeX. Returns new HTML or null if missing.
 * Only swaps the math host — surrounding document is untouched.
 */
export function replaceEquationAt(
  html: string,
  index: number,
  nextTex: string,
  display?: boolean,
): { html: string; entry: MathEntry } | null {
  const list = listEquations(html);
  const entry = list[index];
  if (!entry) return null;
  const isDisplay = display ?? entry.display;
  const replacement = buildMathHtml(nextTex, isDisplay);
  // Replace first exact outerHtml occurrence at this slot
  // Prefer unique replace: walk and count
  let count = -1;
  let replaced = false;
  let result = html;

  // Try exact outerHtml replace once at the correct index among all math
  const all = listEquations(html);
  // Rebuild by sequential unique replacements is safer
  const pieces: { from: string; to: string }[] = [];
  for (let i = 0; i < all.length; i++) {
    if (i === index) {
      pieces.push({ from: all[i].outerHtml, to: replacement });
    }
  }
  // Only replace the N-th occurrence of each outerHtml if duplicates
  const target = entry.outerHtml;
  let seen = 0;
  // Find which occurrence number this index is among same outerHtml
  for (let i = 0; i < index; i++) {
    if (all[i].outerHtml === target) seen++;
  }
  let occ = 0;
  result = html.replace(
    // escape for regex
    new RegExp(target.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'),
    (match) => {
      if (occ === seen && !replaced) {
        occ++;
        replaced = true;
        return replacement;
      }
      occ++;
      return match;
    },
  );
  if (!replaced) return null;
  return {
    html: result,
    entry: {
      ...entry,
      tex: nextTex.trim(),
      display: isDisplay,
      outerHtml: replacement,
    },
  };
}

/** Protect: ensure all math is in data-tex hosts before free HTML rewrite */
export function ensureMathHosts(html: string): string {
  let h = html || '';
  // Wrap bare \[ \] not already in studio-math
  h = h.replace(/\\\[([\s\S]+?)\\\]/g, (full, tex, offset, str) => {
    const before = str.slice(Math.max(0, offset - 60), offset);
    if (/studio-math|data-tex/i.test(before)) return full;
    return buildMathHtml(String(tex).trim(), true);
  });
  h = h.replace(/\\\(([\s\S]+?)\\\)/g, (full, tex, offset, str) => {
    const before = str.slice(Math.max(0, offset - 60), offset);
    if (/studio-math|data-tex/i.test(before)) return full;
    return buildMathHtml(String(tex).trim(), false);
  });
  return h;
}
