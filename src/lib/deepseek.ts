/**
 * DeepSeek OpenAI-compatible API (server-only).
 * Base: https://api.deepseek.com
 * Primary model: deepseek-v4-flash
 */

import 'server-only';
import { DEFAULT_STUDIO_MODEL, STUDIO_MODELS } from '@/lib/studio-models';

export const DEEPSEEK_BASE =
  (process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com').replace(/\/$/, '');

export function deepseekApiKey(): string | null {
  return process.env.DEEPSEEK_API_KEY || process.env.OPENAI_API_KEY || null;
}

export function resolveModelId(raw?: string): string {
  const m = (raw || process.env.DEEPSEEK_MODEL || DEFAULT_STUDIO_MODEL).trim();
  // Strip leftover googleai/ prefixes if a client still sends them
  return m.replace(/^googleai\//, '') || DEFAULT_STUDIO_MODEL;
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
  const props: Record<string, unknown> = {};
  const rawProps = params.properties || {};
  for (const [k, v] of Object.entries(rawProps as Record<string, any>)) {
    const entry: Record<string, unknown> = {
      type: mapType(v?.type),
    };
    if (v?.description) entry.description = v.description;
    if (v?.properties) {
      entry.type = 'object';
      entry.properties = geminiParamsToJsonSchema(v).properties;
    }
    props[k] = entry;
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
    max_tokens: opts.maxTokens ?? 8192,
    stream: Boolean(opts.stream),
  };
  if (opts.tools?.length) {
    body.tools = opts.tools;
    body.tool_choice = 'auto';
  }
  return fetch(`${DEEPSEEK_BASE}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${opts.apiKey}`,
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
