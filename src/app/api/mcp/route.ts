import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { NextRequest } from 'next/server';
import { authenticateMcpBearer } from '@/mcp/auth';
import { createCloudDocsStudioMcpServer } from '@/mcp/cloud-server';
import { storageBackend } from '@/lib/doc-store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': process.env.MCP_CORS_ORIGIN || '*',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type, MCP-Protocol-Version, MCP-Session-Id, Last-Event-ID',
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Access-Control-Expose-Headers': 'MCP-Session-Id, Last-Event-ID, WWW-Authenticate',
    Vary: 'Origin',
  };
}

function jsonError(message: string, status: number, extra?: Record<string, string>) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...corsHeaders(), ...extra },
  });
}

function addCors(response: Response) {
  const headers = new Headers(response.headers);
  for (const [key, value] of Object.entries(corsHeaders())) headers.set(key, value);
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

async function handle(request: NextRequest) {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders() });

  try {
    // Hosted credentials are stored per Google user in DynamoDB. Static
    // environment keys remain supported for service agents and migrations.
    if (storageBackend() !== 'dynamodb' && process.env.MCP_ALLOW_LOCAL !== '1') {
      return jsonError('MCP cloud storage is not configured. Set AWS_REGION, DOCS_TABLE, and an AWS runtime role.', 503);
    }
    const principal = await authenticateMcpBearer(request);
    if (!principal) {
      return jsonError('Missing or invalid MCP bearer token. Create a personal credential from the signed-in Docs Studio workspace.', 401, { 'WWW-Authenticate': 'Bearer' });
    }

    const origin = new URL(request.url).origin;
    const apiBaseUrl = (process.env.DOCS_STUDIO_URL || origin).replace(/\/$/, '');
    const server = createCloudDocsStudioMcpServer({ userId: principal.userId, apiBaseUrl });
    const transport = new WebStandardStreamableHTTPServerTransport({
      // Stateless mode is required for AWS serverless instances: no request
      // depends on an in-memory session map or a sticky host.
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    });
    await server.connect(transport);
    return addCors(await transport.handleRequest(request));
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : String(error), 500);
  }
}

export function OPTIONS(request: NextRequest) {
  return handle(request);
}

export function GET(request: NextRequest) {
  return handle(request);
}

export function POST(request: NextRequest) {
  return handle(request);
}

export function DELETE(request: NextRequest) {
  return handle(request);
}
