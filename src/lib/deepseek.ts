/** Azure AI Foundry / Grok OpenAI-compatible runtime (server-only). */

import 'server-only';
import { DEFAULT_STUDIO_MODEL, STUDIO_MODELS } from '@/lib/studio-models';

export const GROK_FOUNDRY_BASE =
  (process.env.FOUNDRY_GROK_ENDPOINT || process.env.AZURE_OPENAI_ENDPOINT || 'https://bambalunar-resource.services.ai.azure.com/openai/v1').replace(/\/$/, '');

function chatCompletionsUrl() {
  return /\/openai\/v1$/i.test(GROK_FOUNDRY_BASE)
    ? `${GROK_FOUNDRY_BASE}/chat/completions`
    : `${GROK_FOUNDRY_BASE}/v1/chat/completions`;
}

export function deepseekApiKey(): string | null {
  return process.env.FOUNDRY_GROK_API_KEY || process.env.AZURE_OPENAI_API_KEY || null;
}

export function resolveModelId(raw?: string): string {
  const requested = (raw || '').trim();
  // Studio no longer lets legacy client identifiers select a different
  // provider. The Foundry deployment remains configurable server-side.
  if (!requested || /^deepseek|^googleai\//i.test(requested)) {
    return process.env.FOUNDRY_GROK_DEPLOYMENT || process.env.GROK_MODEL || DEFAULT_STUDIO_MODEL;
  }
  return requested;
}

export function modelFallbackList(preferred?: string): string[] {
  const p = resolveModelId(preferred);
  const rest = STUDIO_MODELS.map((m) => m.id).filter((id) => id !== p);
  return [p, ...rest];
}

/** Convert Gemini-style tool schemas to OpenAI JSON Schema */
export function geminiParamsToJsonSchema(params: any): Record<string, unknown> {
  if (!params || typeof params !== 'object') {
    return { type: 'object', properties: {} };
  }
  const mapType = (t: string | undefined): string => {
    const u = String(t || 'STRING').toUpperCase();
    if (u === 'OBJECT') return 'object';
    if (u === 'ARRAY') return 'array';
    if (u === 'NUMBER' || u === 'INTEGER') return 'number';
    if (u === 'BOOLEAN') return 'boolean';
    return 'string';
  };
  const convert = (schema: any): Record<string, unknown> => {
    const type = mapType(schema?.type);
    const entry: Record<string, unknown> = { type };
    if (schema?.description) entry.description = schema.description;
    if (Array.isArray(schema?.enum)) entry.enum = schema.enum;
    if (schema?.default !== undefined) entry.default = schema.default;
    if (type === 'array') {
      entry.items = convert(schema?.items || { type: 'STRING' });
    }
    if (type === 'object') {
      const nested: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(schema?.properties || {})) {
        nested[key] = convert(value);
      }
      entry.properties = nested;
      entry.required = Array.isArray(schema?.required) ? schema.required : [];
    }
    return entry;
  };
  const props: Record<string, unknown> = {};
  const rawProps = params.properties || {};
  for (const [k, v] of Object.entries(rawProps as Record<string, any>)) {
    props[k] = convert(v);
  }
  return {
    type: 'object',
    properties: props,
    required: Array.isArray(params.required) ? params.required : [],
  };
}

export type ChatMessage = {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content?: string | null;
  tool_calls?: any[];
  tool_call_id?: string;
  name?: string;
};

export async function deepseekChat(opts: {
  apiKey: string;
  model: string;
  messages: ChatMessage[];
  tools?: any[];
  stream?: boolean;
  temperature?: number;
  maxTokens?: number;
}): Promise<Response> {
  const body: Record<string, unknown> = {
    model: opts.model,
    messages: opts.messages,
    temperature: opts.temperature ?? 0.55,
    max_completion_tokens: opts.maxTokens ?? 8192,
    stream: Boolean(opts.stream),
  };
  if (opts.tools?.length) {
    body.tools = opts.tools;
    body.tool_choice = 'auto';
  }
  return fetch(chatCompletionsUrl(), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'api-key': opts.apiKey,
    },
    body: JSON.stringify(body),
  });
}

/**
 * Parse OpenAI-style SSE stream; yields content deltas as they arrive (real streaming).
 */
export async function* iterateOpenAiSse(
  body: ReadableStream<Uint8Array>,
): AsyncGenerator<{ content?: string; tool_calls?: any[]; finish_reason?: string }> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buf = '';
  // Accumulate tool call fragments by index
  const toolAcc: Record<number, { id?: string; name?: string; arguments: string }> = {};

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const lines = buf.split('\n');
    buf = lines.pop() || '';
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('data:')) continue;
      const payload = trimmed.slice(5).trim();
      if (!payload || payload === '[DONE]') {
        if (payload === '[DONE]') {
          const tools = Object.keys(toolAcc)
            .map(Number)
            .sort((a, b) => a - b)
            .map((i) => ({
              id: toolAcc[i].id || `call_${i}`,
              type: 'function',
              function: {
                name: toolAcc[i].name || '',
                arguments: toolAcc[i].arguments || '{}',
              },
            }));
          if (tools.length) yield { tool_calls: tools, finish_reason: 'tool_calls' };
        }
        continue;
      }
      try {
        const json = JSON.parse(payload);
        const choice = json?.choices?.[0];
        const delta = choice?.delta || {};
        if (typeof delta.content === 'string' && delta.content) {
          yield { content: delta.content };
        }
        if (Array.isArray(delta.tool_calls)) {
          for (const tc of delta.tool_calls) {
            const idx = typeof tc.index === 'number' ? tc.index : 0;
            if (!toolAcc[idx]) toolAcc[idx] = { arguments: '' };
            if (tc.id) toolAcc[idx].id = tc.id;
            if (tc.function?.name) toolAcc[idx].name = (toolAcc[idx].name || '') + tc.function.name;
            if (tc.function?.arguments) {
              toolAcc[idx].arguments += tc.function.arguments;
            }
          }
        }
        if (choice?.finish_reason === 'tool_calls') {
          const tools = Object.keys(toolAcc)
            .map(Number)
            .sort((a, b) => a - b)
            .map((i) => ({
              id: toolAcc[i].id || `call_${i}`,
              type: 'function',
              function: {
                name: toolAcc[i].name || '',
                arguments: toolAcc[i].arguments || '{}',
              },
            }));
          yield { tool_calls: tools, finish_reason: 'tool_calls' };
        } else if (choice?.finish_reason) {
          yield { finish_reason: choice.finish_reason };
        }
      } catch {
        /* partial */
      }
    }
  }
}
