/**
 * Server-only AI: DeepSeek primary (OpenAI-compatible).
 * Do NOT import this file from client components.
 */

import 'server-only';
import {
  deepseekApiKey,
  deepseekChat,
  modelFallbackList,
  resolveModelId,
} from '@/lib/deepseek';
import { DEFAULT_STUDIO_MODEL, STUDIO_MODELS } from '@/lib/studio-models';

export { STUDIO_MODELS, DEFAULT_STUDIO_MODEL };
export type { StudioModelId } from '@/lib/studio-models';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function isTransient(err: unknown): boolean {
  const msg = String((err as Error)?.message || err || '');
  return /503|429|high demand|quota|UNAVAILABLE|rate.?limit|try again|timeout|ECONNRESET/i.test(
    msg,
  );
}

export async function generateTextWithFallback(opts: {
  prompt: string;
  preferredModel?: string;
  maxAttemptsPerModel?: number;
  system?: string;
}): Promise<{ text: string; modelUsed: string }> {
  const apiKey = deepseekApiKey();
  if (!apiKey) {
    throw new Error('Missing AI provider credentials');
  }

  const ordered = modelFallbackList(opts.preferredModel || resolveModelId());
  const maxAttempts = opts.maxAttemptsPerModel ?? 2;
  let lastError: unknown;

  for (const model of ordered) {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        const messages: { role: 'system' | 'user'; content: string }[] = [];
        if (opts.system) messages.push({ role: 'system', content: opts.system });
        messages.push({ role: 'user', content: opts.prompt });

        const res = await deepseekChat({
          apiKey,
          model,
          messages,
          stream: false,
          temperature: 0.55,
          maxTokens: 8192,
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data?.error?.message || res.statusText || `HTTP ${res.status}`);
        }
        const text = String(data?.choices?.[0]?.message?.content || '').trim();
        if (!text) throw new Error('Empty model response');
        return { text, modelUsed: model };
      } catch (err) {
        lastError = err;
        console.error(`[studio-ai] model=${model} attempt=${attempt + 1}`, err);
        if (isTransient(err) && attempt < maxAttempts - 1) {
          await sleep(600 * Math.pow(2, attempt));
          continue;
        }
        break;
      }
    }
  }

  throw new Error(
    `Studio AI unavailable. ${String((lastError as Error)?.message || lastError)}`,
  );
}

export function stripToHtml(text: string): string {
  let raw = (text || '').trim();
  if (raw.startsWith('```')) {
    raw = raw.replace(/^```(?:html|HTML)?\s*/i, '').replace(/\s*```$/i, '');
  }
  if (!/<(p|h[1-6]|ul|ol|div)\b/i.test(raw)) {
    raw = raw
      .split(/\n{2,}/)
      .map((block) => {
        const t = block.trim();
        if (!t) return '';
        if (t.startsWith('# ')) return `<h1>${t.slice(2)}</h1>`;
        if (t.startsWith('## ')) return `<h2>${t.slice(3)}</h2>`;
        if (t.startsWith('### ')) return `<h3>${t.slice(4)}</h3>`;
        return `<p>${t.replace(/\n/g, '<br/>')}</p>`;
      })
      .join('');
  }
  raw = raw.replace(/\\\\([()[\]])/g, '\\$1');
  return raw;
}
