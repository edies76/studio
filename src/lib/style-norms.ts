/**
 * Academic style norms for the floating "Normas" tool.
 * Levels ordered MOST demanding → briefest / obvious-only.
 */

export type NormId = 'apa' | 'ieee' | 'mla' | 'simple' | 'minimal';

export type NormLevel = {
  /** 100 = top of selector (most demanding), 10 = bottom (briefest) */
  value: number;
  id: NormId;
  /** Short label on hover / send */
  tip: string;
  /** Full agent instructions */
  brief: string;
};

/**
 * Five dots when action === norms, top → bottom:
 * APA → IEEE → MLA → Simple → Minimal
 */
export const NORM_LEVELS: NormLevel[] = [
  {
    value: 100,
    id: 'apa',
    tip: 'APA 7 — máximo rigor',
    brief: `Apply APA 7th edition (academic paper norms) STRICTLY:
- Title page style: clear title; author/affiliation lines if missing (don't invent fake authors — use placeholders only if needed)
- Headings hierarchy (Level 1 centered bold; Level 2 flush left bold) approximated in HTML with h1/h2/h3
- Body: double-space FEEL via clear paragraphs; Times-like serif preference mentioned in summary; 12pt body
- In-text citations (Author, Year) where claims need sources — keep existing citations; don't fabricate DOIs
- References section titled "References" hanging-indent feel with plain <p> entries if bibliography present
- Figures/tables: numbered (Table 1, Figure 1), caption above tables / below figures when present
- Math: keep all LaTeX/MathJax hosts intact — ONLY edit equations via math tools if needed
- Formal academic Spanish/English matching document language`,
  },
  {
    value: 75,
    id: 'ieee',
    tip: 'IEEE — papers técnicos',
    brief: `Apply IEEE conference/journal style (technical):
- Numbered section headings (I., II., or 1. 2.) where appropriate in HTML
- Abstract-like opening if the doc is a paper; keywords line optional
- Figures/tables numbered (Fig. 1, Table I) with captions
- Equations numbered on the right when display math is central — use clear equation blocks; preserve LaTeX via math tools only
- References as [1], [2] style if citations exist; don't invent papers
- Dense technical prose, SI units, acronyms defined once
- Keep all formulas intact`,
  },
  {
    value: 50,
    id: 'mla',
    tip: 'MLA — humanidades',
    brief: `Apply MLA 9 style (humanities essay):
- Title centered (approximate with centered h1)
- Body paragraphs with clear first-line feel; 12pt body
- In-text (Author page) if literary/humanities sources exist
- Works Cited section if bibliography present
- No heavy engineering numbering
- Preserve math if any (rare) via math tools only`,
  },
  {
    value: 25,
    id: 'simple',
    tip: 'Simple — títulos e imágenes',
    brief: `Apply SIMPLE document norms (no full style guide name):
- Clear title (h1), section headings (h2/h3) consistent
- Titles/section heads centered or visually hierarchical and clean
- Images: max-width 100%, sensible margins, captions under images if present
- Tables: header row, borders, readable
- Lists for steps; short paragraphs
- Do NOT over-formalize; keep student-lab clarity
- NEVER break LaTeX/equations — use math tools for any formula change`,
  },
  {
    value: 10,
    id: 'minimal',
    tip: 'Mínimo — solo lo obvio',
    brief: `Apply MINIMAL obvious cleanup only (no named style):
- Fix broken heading hierarchy (one h1, then h2…)
- Center the main title if it looks like a title
- Ensure images don't overflow; tables not broken
- Remove double spaces / empty spam paragraphs
- Do not rewrite content tone
- Do not invent citations
- Absolute ban on damaging math: leave all equations untouched unless using list_equations/edit_equation`,
  },
];

export function normByIntensity(intensity: number): NormLevel {
  const sorted = [...NORM_LEVELS].sort(
    (a, b) => Math.abs(a.value - intensity) - Math.abs(b.value - intensity),
  );
  return sorted[0] || NORM_LEVELS[2];
}

export function normsAgentPrompt(intensity: number, hasSelection: boolean): string {
  const n = normByIntensity(intensity);
  const scope = hasSelection
    ? 'Apply ONLY to the selected text / selection region.'
    : 'Apply to the entire document via propose_edit or several edit_paragraph.';
  return [
    `Apply document norms: ${n.id.toUpperCase()} (${n.tip}).`,
    scope,
    n.brief,
    '',
    'MATH-SAFE MODE (mandatory):',
    '1. Call list_equations first if the document may contain formulas.',
    '2. Never paste broken LaTeX. Never convert \\( \\) into plain text.',
    '3. To change a formula use edit_equation(index, tex) only.',
    '4. Surrounding prose can change; math hosts must stay as studio-math / data-tex nodes.',
    '5. After edits, propose_edit/edit_paragraph with afterHtml that still contains the math hosts.',
    '',
    'Workflow: set_status → read_document → list_equations (if any math) → edits → short summary of which norm level applied.',
  ].join('\n');
}
