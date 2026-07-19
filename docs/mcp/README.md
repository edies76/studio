# Docs Studio MCP

Docs Studio exposes the real document loop to external AI clients through the official MCP TypeScript SDK.

The hosted endpoint is:

```text
https://YOUR_DOCS_DOMAIN/api/mcp
```

It uses Streamable HTTP in stateless mode, so an AWS serverless instance does not need sticky sessions. Documents are isolated by the authenticated MCP principal and stored through the same Docs Studio document store. In production, that store must be DynamoDB.

## Remote client configuration

```json
{
  "mcpServers": {
    "docs-studio": {
      "url": "https://YOUR_DOCS_DOMAIN/api/mcp",
      "headers": {
        "Authorization": "Bearer YOUR_MCP_API_KEY"
      }
    }
  }
}
```

Configure the token in Amplify or the hosting provider, never in the repository:

```bash
MCP_API_KEY=long-random-secret
MCP_KEY_ID=agent-main
MCP_USER_ID=workspace-main
AWS_REGION=us-east-2
DOCS_TABLE=docs-studio
DEEPSEEK_API_KEY=sk-...
DOCS_STUDIO_URL=https://YOUR_DOCS_DOMAIN
```

For more than one isolated workspace, use `MCP_API_KEYS` as a JSON array:

```json
[
  {"id":"research-agent","token":"secret-a","userId":"workspace-research"},
  {"id":"writing-agent","token":"secret-b","userId":"workspace-writing"}
]
```

## Editing surface

The remote server exposes 22 tools:

| Tool | Purpose | Mutates |
| --- | --- | --- |
| `get_capabilities` | Read the contract and review boundary. | No |
| `create_document` | Create a Letter or Legal document. | Yes |
| `list_documents` | List documents in the authenticated workspace. | No |
| `delete_document` | Delete a document with `confirm=true`. | Yes |
| `read_document` | Read HTML, text, blocks, brief and pending edits. | No |
| `find_in_document` | Search text and return matching block indexes. | No |
| `check_document` | Check headings, images, tables and review state. | No |
| `parse_brief` | Extract and optionally attach tasks, constraints and rubric. | Optional |
| `draft_document` | Run the same AI draft endpoint as the app. | Yes |
| `chat_document` | Run the copilot and persist returned proposals. | Proposal only |
| `propose_edit` | Create a reviewable edit. | Proposal only |
| `accept_edit` / `reject_edit` | Apply or close a proposal. | Yes / No |
| `update_title` | Rename a document. | Yes |
| `set_paper_size` | Set Letter or Legal. | Yes |
| `insert_html` | Append sanitized HTML directly. | Yes |
| `insert_math` | Insert an inline or display MathJax equation. | Yes |
| `insert_table` | Insert an editable HTML table with headers. | Yes |
| `edit_table_cell` | Change one indexed table cell without replacing the table. | Yes |
| `insert_image` | Insert an HTTPS/data image with width and wrap mode. | Yes |
| `insert_page_break` | Insert a persistent page break. | Yes |
| `get_history` | Read the document audit trail. | No |
| `export_document` | Return HTML or base64 DOCX/PDF. | No |

### Recommended agent loop

1. `create_document` or `list_documents`.
2. `parse_brief` and attach it with `documentId`.
3. `draft_document` for the first version.
4. `read_document`, `find_in_document` and `check_document` before targeted work.
5. Use `chat_document` or `propose_edit` for consequential changes.
6. Review the returned proposal and call `accept_edit` or `reject_edit` deliberately.
7. Use `insert_image`, `insert_math`, `insert_table` and `insert_page_break` for document primitives.
8. `check_document` again, then `export_document`.

`accept_edit` rejects stale proposals when the source HTML changed. An agent must read the document again and create a fresh proposal instead of overwriting newer work.

## Resources and prompts

- `docs://workspace`
- `docs://document/{documentId}`
- `docs://history/{documentId}`
- `draft_from_brief`
- `review_document`
- `prepare_export`

## Local development

The existing stdio and standalone HTTP servers remain available:

```bash
npm run dev
npm run mcp:stdio
npm run mcp:http
```

The Next route can be smoke-tested locally only when `MCP_ALLOW_LOCAL=1` and `MCP_API_KEY` are set. It is intentionally disabled otherwise so a misconfigured production deployment cannot fall back to local JSON files.

## What this does not claim

The remote MCP workspace is not silently attached to a browser tab. It operates on authenticated persistent documents. A future browser session bridge would need explicit attach/detach operations and a permission model for live selection state.
