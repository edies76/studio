# Docs Studio — progressive changelog (Spark)

**Submission repo:** https://github.com/edies76/docs-studio  
**Base repo (code origin):** https://github.com/edies76/studio  

**Not the base:** `esta.zip` / generador-documentos-ai (Flask+Vite) — discarded.

**Spark window:** 2026-07-13 → 2026-07-19  

---

## Before vs today (product)

| | **Base `studio` (before)** | **Docs Studio (now)** |
|--|----------------------------|------------------------|
| Brand | B.A.M.B.A.I / DocuGen AI | Docs Studio + sheet favicon mark |
| Layout | Dark shell + Student Tools | Clean paper canvas + chat |
| Pages | Free-form dark div | **Real multi-page** with break spacers (no text in the “air”) |
| First draft | Dump into editor | `/api/draft` stream → auto-apply + cascade |
| Later edits | Blind overwrite | Red/green canvas diff + Accept/Reject bar |
| Selection AI | — | Prompt bubble + white tools dock (intensity) |
| Settings | — | ChatGPT-style modal (paper, margins, images, edit btn) |
| Export | Basic ideas | PDF + server `.docx` (`/api/export-docx`) |
| Chat noise | — | History drawer (git-like), Segoe UI, shine “Pensando…” |
| Plan UI | Generic checklists | **Removed** |

---

## Day-by-day

### 2026-07-15
- Discarded wrong trees; base = `edies76/studio` clone
- Google AI key + model fallbacks; Genkit client leak fix

### 2026-07-16 (product shell)
- Paper Letter/Legal, chat agent tools, propose_edit, Gauss helpers
- Push/origin disclosure to **docs-studio**

### 2026-07-16 (UX overhaul)
- Floating format toolbar; orbit/tools dock; cascade draft
- No forced professor brief; optional pre-summary
- Ghost edits on canvas; monochrome UI

### 2026-07-16 (hard polish)
- Tools white dock + click-outside cancel
- Settings modal; zoom Ctrl±; thick paragraph hover + pencil FAB
- Canvas red/green **diff** (not green-only ghost)
- Chat: no header spam; history drawer; fewer events
- **Word `.docx` via API** (client never bundles `docx` — fixed `super` SyntaxError)
- Loading: line cascade + shine (no “D” spinner)

### 2026-07-16 / 17 (real pages + ship)
- **Root-cause page explosion:** `minHeight = f(scrollHeight)` feedback → hundreds of empty pages
- **Real pagination:** non-editable `data-studio-break` spacers of height `gap + 2×margin` so text never sits in the visual gap between sheets
- Page count = break count + 1 (capped, content-driven)
- Gap masks (neutral background) over inter-page air
- Clean HTML for AI/export/history always **strips** break spacers
- Versioned deploy + this log + README update

---

## Servers

| Process | Port |
|---------|------|
| `npm run dev` | **:9003** (Next frontend + API) |

---

## Versioning

App version lives in `package.json` (`docs-studio`).  
Each ship increments by `0.0.1` when committing product changes.
