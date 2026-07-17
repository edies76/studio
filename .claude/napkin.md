# Napkin Runbook

## Curation Rules
- Re-prioritize on every read.
- Keep recurring, high-value notes only.
- Max 10 items per category.
- Each item includes date + "Do instead".

## Execution & Validation (Highest Priority)
1. **[2026-07-17] Continuous paper + pad empty space (Word click)**
   Do instead: Single contentEditable; pageCount=ceil(height/pageH); `[data-studio-pad]` fillers so click below content doesn't caret-jump; strip pads on getHtml. caretRangeFromPoint on empty click.

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
1. **[2026-07-17] Fix pages HARD + import Word**
   Do instead: Multi-page pack model + mammoth import; commit/push docs-studio often without asking.
