# Docs Studio

**AI document generator & editor** for university workshops (APA / talleres) and professional writing.

Chat → draft streams onto the paper → later edits show as **red/green canvas diff** → Accept / Reject → export PDF / Word (`.docx`).

**Live app (dev):** `http://localhost:9003`

---

## Origin / honesty note (Spark)

This was **not** built from an empty folder.

| | |
|--|--|
| **Base** | https://github.com/edies76/studio (Firebase Studio / Genkit Next prototype) |
| **Submission** | https://github.com/edies76/docs-studio |
| **Not the base** | `esta.zip` / generador-documentos-ai (Flask + Vite) — same hash as a discarded experiment |

We kept a thin technical base (Next, Genkit parse-brief, PDF libs) and **rewrote** the product loop, UI, pagination, and agent tools during the hackathon window. Full day-by-day log: [`docs/HACKATHON_CHANGES.md`](./docs/HACKATHON_CHANGES.md).

---

## What it does **now** (2026-07-16/17)

| Area | Feature |
|------|---------|
| Canvas | **Real multi-page Letter/Legal** — page-break spacers so text never sits in the gap between sheets |
| Draft | `/api/draft` SSE stream → auto-apply + cascade (no Accept on first create) |
| Edits | Propose → **− red / + green** on paper + floating Accept/Reject |
| Tools | White dock (icons only) + intensity dots; selection prompt bubble |
| Settings | Modal: paper size, margins, images, edit-button toggle |
| Zoom | Ctrl + / − / 0 + Word-like control |
| Chat | Segoe-style medium weight; history drawer instead of spam |
| Export | PDF + **server** `.docx` (`docx` package never on the client) |
| Math | MathJax + Σ insert; double-click formula to edit |

### What we **removed** from base

Student Tools (flashcards/quiz/mind map), B.A.M.B.A.I branding, generic plan/checklist UI, dead Genkit one-shot flows, unused shadcn bulk.

---

## Quick start

```bash
npm install
cp .env.example .env.local   # GOOGLE_API_KEY=
npm run dev                  # http://localhost:9003
```

| Variable | Required | Description |
|----------|----------|-------------|
| `GOOGLE_API_KEY` | Yes | Google AI Studio key |
| `GEMINI_MODEL` | No | Defaults via `src/lib/studio-models.ts` |

Never commit `.env.local`.

---

## Architecture (short)

```
src/app/docucraft-client.tsx   # workspace shell
src/components/paper-canvas.tsx # pages + reflow breaks
src/lib/page-layout.ts          # real pagination engine
src/app/api/draft|chat|export-docx
```

**Pagination fix (important):** page count must **never** be derived from `scrollHeight` when `minHeight` is also derived from page count (that loop created 40–400 empty pages). Count = number of `data-studio-break` spacers + 1 after measuring real blocks.

---

## License / contact

Hackathon build for Bamba / Spark. Founder context: bambalunar.app.
