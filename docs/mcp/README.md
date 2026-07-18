# Docs Studio MCP

Docs Studio exposes an MCP server for external AI clients. The server is implemented with the official TypeScript SDK v1.29 and supports the two transports that matter for this project:

- `stdio` for local clients that spawn the server process.
- Streamable HTTP for a running endpoint at `http://localhost:8787/mcp`.

The web app still owns the visual editor. The MCP workspace is a separate, in-memory document workspace inside the MCP process. It uses the existing Docs Studio API for AI drafting and DOCX export, but it does not silently mutate a browser tab. A future session bridge must solve that explicitly.

## Start it

In one terminal, start the web app because `draft_document` and DOCX export call the existing server routes:

```bash
npm run dev
```

In another terminal:

```bash
npm run mcp:stdio
```

For Streamable HTTP:

```bash
npm run mcp:http
```

Environment variables:

| Variable | Default | Purpose |
| --- | --- | --- |
| `DOCS_STUDIO_URL` | `http://localhost:9003` | Base URL for `/api/draft`, `/api/chat`, and `/api/export-docx`. |
| `MCP_PORT` | `8787` | Port for the Streamable HTTP server. |

## Client configuration

```json
{
  "mcpServers": {
    "docs-studio": {
      "command": "npx",
      "args": ["tsx", "src/mcp/server.ts"],
      "cwd": "/absolute/path/to/studio",
      "env": {
        "DOCS_STUDIO_URL": "http://localhost:9003"
      }
    }
  }
}
```

The same example is stored at [`client-configs/claude-desktop.json`](./client-configs/claude-desktop.json).

## Recommended workflow

1. Call `create_document`.
2. Call `parse_brief` with the professor's brief. Pass `documentId` to attach it.
3. Call `draft_document` to run the same streaming draft route as the web app.
4. Call `read_document` before making a targeted edit. Blocks have stable indexes for the current document version.
5. Use `chat_document` or `propose_edit`. Proposals are not applied.
6. Call `accept_edit` or `reject_edit` deliberately.
7. Call `export_document` as `html`, `docx`, or `pdf`.

The first draft follows the current web product behavior and is applied directly. Subsequent AI changes are reviewable proposals. `accept_edit` rejects stale proposals when the source document has changed, so an external AI must read again and create a fresh proposal.

## Surface

### Tools

| Tool | What it does | Mutates? |
| --- | --- | --- |
| `get_capabilities` | Reports the server contract, transports, and session boundary. | No |
| `create_document` | Creates a blank or HTML-seeded document. | Yes |
| `list_documents` | Lists documents in this process. | No |
| `read_document` | Returns HTML, text, blocks, word count, brief, and pending proposals. | No |
| `parse_brief` | Extracts tasks, objectives, constraints, learning outcome, and rubric. | Optional attachment |
| `draft_document` | Calls `/api/draft` and applies the returned HTML. | Yes |
| `chat_document` | Calls `/api/chat` and records any returned proposals. | Proposal only |
| `propose_edit` | Creates a reviewable proposal. | Proposal only |
| `accept_edit` / `reject_edit` | Applies or closes a proposal. | Yes / no |
| `insert_math` / `insert_table` | Inserts editable document primitives. | Yes |
| `get_history` | Returns the last 40 events. | No |
| `export_document` | Returns HTML or base64 DOCX/PDF. | No |

### Resources

- `docs://workspace` — documents in the current process.
- `docs://document/{documentId}` — current document state.
- `docs://history/{documentId}` — review and mutation trail.

### Prompts

- `draft_from_brief`
- `review_document`
- `prepare_export`

## Known gaps / necessary next MCPs

These are intentionally documented as gaps instead of being implied to exist:

- **Session bridge:** connect an MCP document ID to an authenticated browser editor session, with explicit open/attach/detach operations.
- **Persistence:** replace process memory with durable document revisions and binary artifact storage.
- **Identity and permissions:** authenticate HTTP clients and scope documents to a user or workspace.
- **Browser selection state:** expose the actual current selection/cursor when the AI is working beside an open canvas.
- **Event subscription:** publish draft/proposal/export progress as structured notifications for long-running jobs.
- **Image operations:** the browser can analyze image context today, but MCP does not yet expose an image upload/resource contract.

The first four are the important product work before hosting this endpoint for multiple users. The current implementation is useful for local agents and controlled single-process integrations.

## Source references

- [`src/mcp/server.ts`](../../src/mcp/server.ts) — tools, resources, and prompts.
- [`src/mcp/core.ts`](../../src/mcp/core.ts) — document state and review semantics.
- [`src/mcp/http.ts`](../../src/mcp/http.ts) — Streamable HTTP process.
- [`/mcp`](http://localhost:9003/mcp) — visual documentation page in the app.

The server follows the MCP model of tools for actions, resources for read-only context, and prompts for reusable interaction templates. See the [official TypeScript SDK server guide](https://github.com/modelcontextprotocol/typescript-sdk/blob/main/docs/server.md) for protocol-level details.

