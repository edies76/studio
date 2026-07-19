# Docs Studio

**Core message:** a brief is not a document — Docs Studio turns it into one you can review.

El lienzo (Letter / Legal / A4) es la fuente de verdad. El agente propone; vos aceptás o rechazás. Normas APA / IEEE / MLA, ecuaciones MathJax, import DOCX, export PDF vectorial y Word.

**Dev:** `http://localhost:9003` · **Prod:** [docss.studio](https://docss.studio)  
**Repo:** [github.com/edies76/studio](https://github.com/edies76/studio)

---

## Estado actual (v0.8.5)

![Docs Studio v0.8.5](./docs/demo/screenshot-current-v085.png)

---

## Origen del proyecto — qué existía y qué se construyó

### Base preexistente (diciembre 2025)

El commit `96824af` (18 dic 2025) es el estado original del proyecto: un editor de documentos con IA básico, sin nombre de producto, sin dominio, sin MCP, sin canvas multi-página real.

Era la base de **Studio** — el primer producto de Bamba, un experimento de plataforma de documentos con IA que fue abandonado y no tenía identidad de producto clara.

### Lo construido para la hackathon (16–19 julio 2026)

Todo desde el commit `44bf440` en adelante es trabajo nuevo. La línea de tiempo:

| Fecha | Commits | Qué se hizo |
|-------|---------|-------------|
| **16 jul** | `44bf440` | Punto de partida — layout multi-página + polish base (`v0.2.1`) |
| **17 jul** | `v0.2.2` → `v0.2.8` | Canvas Word-like, import DOCX, composer flotante, zoom, MCP surface, motor de paginación real |
| **18 jul** | `v0.2.9` → `v0.5.2` | Drop Syncfusion → canvas propio, DeepSeek, auth Google, DynamoDB, **marca DocsS** (`3ae6949` = `v0.4.6`), dominio `docss.studio`, landing, `/home`, `/studio/doc/[id]`, deploy EC2 |
| **19 jul** | `v0.5.3` → `v0.8.5` | Motor nativo de paginación, canvas continuo, MCP completo (25 tools), credenciales remotas, import Word fiel, brief workflow, assignment review, fixes de editor (scroll, font size, undo) |

### El commit que nació la marca

```
3ae6949  feat(studio): DocsS brand + docss.studio marketing  v0.4.6  (18 jul 2026)
```

Antes de ese commit: funcional pero sin identidad.  
Después: producto con nombre, dominio, landing, y propuesta de valor definida.

---

## Historial de commits

El historial completo vive en **este repo** (`edies76/studio`).

No está en `edies76/docs-studio` — ese repo fue creado como destino de publicación pero por incompatibilidad de historias entre repos el push tuvo que hacerse como rama huérfana desde `v0.8.5`. No tiene historia previa.

**Para auditar el trabajo real:**

```bash
git clone https://github.com/edies76/studio
cd studio
git log --oneline --date=short --format="%ad %h %s" | grep "2026-07"
```

---

## Rutas de la app

| Ruta | Rol |
|------|-----|
| `/` | Landing |
| `/home` | Biblioteca de documentos |
| `/studio/doc/[id]` | Workspace — lienzo + agente + Tools + export |
| `/login` | Google OAuth (opcional, modo invitado por defecto) |
| `/mcp` | Guía de integración MCP |
| `/usecases` | Casos de uso |
| `/origin` | Historia del producto |

---

## Qué hace

| Área | Feature |
|------|---------|
| Canvas | Multi-página Letter / Legal / A4, rebalance automático sin saltos |
| Draft | SSE → primer borrador directo en el lienzo |
| Edits | Propose → diff rojo/verde → Accept / Reject |
| Normas | APA / IEEE / MLA / Simple / Mínimo |
| Math | MathJax inline + block, editor LaTeX |
| Export | PDF vectorial (print nativo) + DOCX servidor |
| MCP | 25 tools — crear, leer, editar, exportar desde cualquier agente externo |
| Auth | Google OAuth opcional; modo invitado por defecto |
| Brief | Flujo de tarea → borrador guiado → revisión por cobertura |

---

## Quick start

```bash
npm install
cp .env.example .env.local   # agrega DEEPSEEK_API_KEY y AUTH_SECRET
npm run dev                   # http://localhost:9003
```

Variables clave:

| Variable | Requerida | Descripción |
|----------|-----------|-------------|
| `DEEPSEEK_API_KEY` | Sí | Motor del agente (server-side) |
| `AUTH_SECRET` | Para auth | NextAuth secret |
| `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` | Para login Google | OAuth client credentials |
| `AUTH_URL` | Para auth | URL base — `http://localhost:9003` en dev, `https://docss.studio` en prod |
| `AWS_REGION` + `DOCS_TABLE` | Para persistencia | DynamoDB |
| `MCP_API_KEY` | Para MCP externo | Bearer token del servidor MCP |

Nunca commitear `.env.local`.

---

## Arquitectura

```
src/app/docucraft-client.tsx     # shell del workspace
src/components/paper-canvas.tsx  # lienzo multi-página + rebalance
src/lib/page-layout.ts           # motor de paginación
src/app/api/draft|chat|export-docx
src/mcp/cloud-server.ts          # 25 MCP tools (Streamable HTTP)
src/lib/auth.ts                  # NextAuth v5 + modo invitado
```

---

## MCP

```bash
npm run mcp:stdio   # stdio local
npm run mcp:http    # HTTP en http://localhost:8787/mcp
```

Configuración para Claude Desktop u otro cliente HTTP:

```json
{
  "mcpServers": {
    "docss-studio": {
      "type": "http",
      "url": "https://docss.studio/api/mcp",
      "headers": { "Authorization": "Bearer <tu-token>" }
    }
  }
}
```

Documentación completa: [`docs/mcp/README.md`](./docs/mcp/README.md)

---

## Licencia / contacto

Bamba · [bambalunar.app](https://bambalunar.app) · Founder: Edigarlos (edies76)
