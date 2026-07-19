# Docs Studio

**Promesa:** workspace académico, no un chat genérico.

**Core message:** a brief is not a document; Docs Studio turns it into one you can review.

El papel (lienzo Letter/Legal) es la fuente de verdad. El agente propone; vos aceptás o rechazás. Normas APA/IEEE/MLA, ecuaciones MATH-SAFE, import DOCX y export PDF/Word.

**Dev:** `http://localhost:9003`

---

## Rutas de la app

| Ruta | Rol |
|------|-----|
| `/` | Landing — promesa del producto + arranque con tema/guía |
| `/home` | Biblioteca de documentos (autosave local o Google) |
| `/studio` | Workspace — lienzo + agente + Tools + export |
| `/login` | Google OAuth (opcional) |
| `/mcp` | Superficie MCP para agentes externos |
| `/usecases` | Casos de uso y diferencia frente a un editor general |
| `/origin` | Historia y evolución del producto |
| `/pre-summary` | Redirect legacy → `/` |

Legacy: `/?doc=` y `/?topic=` redirigen a `/studio` (middleware).

---

## Qué hace de verdad

| Área | Feature |
|------|---------|
| Canvas | Lienzo multi-página Letter/Legal (no transcript de chat) |
| Draft | `/api/draft` SSE → primer borrador en el papel |
| Edits | Propose → diff rojo/verde → Accept / Reject |
| Normas | Tools → Aplicar normas: APA → IEEE → MLA → Simple → Mínimo |
| Math | MATH-SAFE: `list/edit/insert_equation` + protector server-side |
| Tools | Improve / shorter / expand / grammar / academic / normas |
| Export | PDF + `.docx` generado en servidor |
| Biblioteca | `/home` + autosave |

---

## Origin (honestidad)

Base: [edies76/studio](https://github.com/edies76/studio). Submission: [edies76/docs-studio](https://github.com/edies76/docs-studio). Log: [`docs/HACKATHON_CHANGES.md`](./docs/HACKATHON_CHANGES.md).

---

## Quick start

```bash
npm install
cp .env.example .env.local   # DEEPSEEK_API_KEY=
npm run dev                  # http://localhost:9003
```

| Variable | Required | Description |
|----------|----------|-------------|
| `DEEPSEEK_API_KEY` | Yes for the agent | Private key used by the server-side agent runtime |
| `GOOGLE_API_KEY` | No | Optional legacy/provider fallback; never exposed in the product UI |
| `GEMINI_MODEL` | No | Text model used by the Google/Genkit pipeline |
| `GEMINI_VISION_MODEL` | No | Vision model used when image context is analyzed |

Never commit `.env.local`. The provider and model are implementation details; public product language should refer only to “the agent”.

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

## MCP integration

Docs Studio now exposes the document loop to external AI clients through an official MCP server:

```bash
npm run mcp:stdio   # local stdio client
npm run mcp:http    # Streamable HTTP at http://localhost:8787/mcp
```

The surface includes `create_document`, `parse_brief`, `draft_document`, `read_document`, `chat_document`, reviewable `propose_edit` / `accept_edit` / `reject_edit`, math/table insertion, history, and HTML/DOCX/PDF export. Full setup, client config, resources, prompts, and honest integration boundaries live in [`docs/mcp/README.md`](./docs/mcp/README.md). The visual guide is available at [`/mcp`](http://localhost:9003/mcp).

---

## License / contact

Hackathon build for Bamba / Spark. Founder context: bambalunar.app.
