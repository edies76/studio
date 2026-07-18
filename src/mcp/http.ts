import { randomUUID } from 'node:crypto';
import { createServer } from 'node:http';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { createDocsStudioMcpServer } from './server';

const port = Number(process.env.MCP_PORT || 8787);
const sessions = new Map<string, StreamableHTTPServerTransport>();

const httpServer = createServer(async (request, response) => {
  if (request.url !== '/mcp') {
    response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('Docs Studio MCP: use /mcp');
    return;
  }

  const sessionId = request.headers['mcp-session-id'];
  const existing = typeof sessionId === 'string' ? sessions.get(sessionId) : undefined;
  if (existing) {
    await existing.handleRequest(request, response);
    return;
  }

  if (request.method !== 'POST') {
    response.writeHead(400, { 'Content-Type': 'application/json' });
    response.end(JSON.stringify({ error: 'Initialize with a POST request first.' }));
    return;
  }

  let transport: StreamableHTTPServerTransport;
  const mcp = createDocsStudioMcpServer();
  transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: () => randomUUID(),
    onsessioninitialized: (id) => {
      sessions.set(id, transport);
    },
    onsessionclosed: (id) => {
      sessions.delete(id);
    },
  });

  await mcp.connect(transport);
  await transport.handleRequest(request, response);
});

httpServer.listen(port, () => {
  console.error(`Docs Studio MCP listening on http://localhost:${port}/mcp`);
});
