# Napkin Runbook

## Curation Rules
- Re-prioritize on every read.
- Keep recurring, high-value notes only.
- Max 10 items per category.
- Each item includes date + "Do instead".

## Execution & Validation (Highest Priority)
1. **[2026-07-17] Pages are real multi-page sheets, not spacers**
   Do instead: Use `PaperCanvasHandle` (`getHtml`/`setHtml`/`getBodies`). Never write `editorRef.innerHTML` on a single continuous div. Pack via `distributeHtmlToPages` / `rebalanceFromPage` in `page-layout.ts`.

2. **[2026-07-17] Parent must not treat canvas ref as HTMLDivElement**
   Do instead: `useRef<PaperCanvasHandle>(null)`; typeset with `getBodies().forEach(typesetEditor)`; selection checks via `getBodies().some(b => b.contains(node))`.

3. **[2026-07-17] Rebalance must rewrite focused page on overflow**
   Do instead: After pack, force-write DOM when HTML differs; if page count grew, `placeCaretAtEnd` on the new last page. Don't skip active body forever or text clips under `overflow:hidden`.

4. **[2026-07-17] Import/export Word**
   Do instead: Import with client `mammoth.convertToHtml` → `applyHtml`/`setHtml`. Export via `/api/export-docx` (docx is server-only — never import `docx` on client).

5. **[2026-07-17] Version bump on ship**
   Do instead: Bump `package.json` by exactly `0.0.1` per commit when shipping studio.

## Domain Behavior Guardrails
1. **[2026-07-17] Word-like pages**
   Do instead: Fixed-height sheets, content only inside `[data-page-body]`, create/delete pages via pack/rebalance, click blank sheet to type, Backspace on empty last page removes it.

2. **[2026-07-17] No Connecting spam / fake streams**
   Do instead: Real SSE deltas only; tool logs from actual events.

## User Directives
1. **[2026-07-17] Fix pages HARD + import Word**
   Do instead: Multi-page pack model + mammoth import; commit/push docs-studio often without asking.
