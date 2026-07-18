import { timingSafeEqual } from 'node:crypto';

export type McpPrincipal = {
  id: string;
  userId: string;
};

type ConfiguredKey = McpPrincipal & { token: string };

function keys(): ConfiguredKey[] {
  const configured: ConfiguredKey[] = [];
  if (process.env.MCP_API_KEY) {
    configured.push({
      id: process.env.MCP_KEY_ID || 'default',
      userId: process.env.MCP_USER_ID || 'mcp-cloud',
      token: process.env.MCP_API_KEY,
    });
  }
  if (process.env.MCP_API_KEYS) {
    try {
      const parsed = JSON.parse(process.env.MCP_API_KEYS) as unknown;
      if (Array.isArray(parsed)) {
        for (const item of parsed) {
          if (!item || typeof item !== 'object') continue;
          const candidate = item as Record<string, unknown>;
          if (typeof candidate.token !== 'string' || !candidate.token) continue;
          configured.push({
            id: typeof candidate.id === 'string' && candidate.id ? candidate.id : 'mcp-key',
            userId: typeof candidate.userId === 'string' && candidate.userId ? candidate.userId : 'mcp-cloud',
            token: candidate.token,
          });
        }
      }
    } catch {
      throw new Error('MCP_API_KEYS must be valid JSON');
    }
  }
  return configured;
}

function equalSecret(left: string, right: string) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function authenticateMcpRequest(request: Request): McpPrincipal | null {
  const header = request.headers.get('authorization') || '';
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) return null;
  const token = match[1].trim();
  return keys().find((candidate) => equalSecret(token, candidate.token)) || null;
}

export function hasMcpCredentials() {
  return keys().length > 0;
}
