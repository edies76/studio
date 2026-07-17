# Napkin Runbook

## Curation Rules
- Re-prioritize on every read.
- Keep recurring, high-value notes only.
- Max 10 items per category.
- Each item includes date + "Do instead".

## Execution & Validation (Highest Priority)
1. **[2026-07-17] Continuous paper editor, not fake multi-page contenteditables**
   Do instead: One `contentEditable` that grows freely; page count = ceil(scrollHeight / pageHeight); page chrome is visual break lines only. Never clip with overflow:hidden per sheet.

2. **[2026-07-17] Parent uses PaperCanvasHandle**
   Do instead: `useRef<PaperCanvasHandle>(null)`; typeset `getBodies()`; selection via bodies contain check.

3. **[2026-07-17] Floating composer owns agent UX**
   Do instead: Collapse to center pill on outside click; expand on hover/focus; tools left + zoom slider under; review accept/reject in composer; no SelectionPrompt, no top-right chat FAB.

4. **[2026-07-17] Import Word is HTML import not binary viewer**
   Do instead: mammoth → editable HTML; surface mammoth messages in toast + chat log. Export via `/api/export-docx`.

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
