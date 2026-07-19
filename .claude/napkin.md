# Napkin Runbook

## Curation Rules
- Re-prioritize on every read.
- Keep recurring, high-value notes only.
- Max 10 items per category.
- Each item includes date + "Do instead".

## Execution & Validation (Highest Priority)
1. **[2026-07-18] Real multi-page sheets (never CSS-only gaps)**
   Do instead: Stack fixed-height white sheets with real DOM `gap`; content only in `[data-page-body]`; pack/rebalance via `page-layout.ts`. Continuous paper + painted pageBreakBg lets text cross gaps — ban that pattern.

2. **[2026-07-18] Landing head: brand outside, slim pill right-only**
   Do instead: `.landing-top` row — logo+DocsS left (scroll expands Studio); `.landing-nav--slim` is `width:fit-content` with ONLY links/locale/CTA. Never put brand inside the full-width pill.

3. **[2026-07-17] Continuous paper + pad empty space (Word click)**
   Do instead: SUPERSEDED by real multi-page sheets (2026-07-18). Pads only inside a page body if needed; never continuous stripe gaps.

2. **[2026-07-17] DOCX import via `import-docx.ts`**
   Do instead: styleMap (ES headings), images base64, clean human warnings (no OOXML noise), promote bold titles. Never dump raw mammoth messages to chat.

3. **[2026-07-17] Ephemeral agent: scale-center anim, draft sticky**
   Do instead: open/close scale+opacity from center (not translateY); click-outside closes only if input empty; opening chat panel closes agent; softFocus after 220ms.

4. **[2026-07-17] UX chrome**
   Do instead: No panel-close X next to history; chat panel width transition; zoom bottom-left; selection AI pencil shows Ctrl+E; tools bottom-right with close anim.

5. **[2026-07-17] Version bump on ship**
   Do instead: Bump `package.json` by exactly `0.0.1` per commit when shipping studio.

## Domain Behavior Guardrails
1. **[2026-07-17] Word-like pages**
   Do instead: Fixed-height sheets, content only inside `[data-page-body]`, create/delete pages via pack/rebalance, click blank sheet to type, Backspace on empty last page removes it.

2. **[2026-07-17] No Connecting spam / fake streams**
   Do instead: Real SSE deltas only; tool logs from actual events.

## User Directives
1. **[2026-07-17] Pushes constantes — nunca dejar al usuario “en vacío”**
   Do instead: After every meaningful work chunk: commit + `git push origin main`. Ship `docs-studio` too (orphan force if non-ff). If push fails, retry/orphan and report; never end a turn with unpushed work if push is possible.

2. **[2026-07-17] Fix pages HARD + import Word**
   Do instead: Multi-page pack model + mammoth import; commit/push docs-studio often without asking.
