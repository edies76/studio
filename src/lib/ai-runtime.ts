/**
 * Server-only Gemini calls: multi-model fallback + backoff on 429/503.
 * Do NOT import this file from client components.
 */

import 'server-only';
import { ai } from '@/ai/genkit';
import { DEFAULT_STUDIO_MODEL, STUDIO_MODELS } from '@/lib/studio-models';

export { STUDIO_MODELS, DEFAULT_STUDIO_MODEL };
export type { StudioModelId } from '@/lib/studio-models';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function isTransient(err: unknown): boolean {
  const msg = String((err as Error)?.message || err || '');
  return /503|429|high demand|quota|UNAVAILABLE|rate.?limit|try again/i.test(msg);
}

export async function generateTextWithFallback(opts: {
  prompt: string;
  preferredModel?: string;
  maxAttemptsPerModel?: number;
}): Promise<{ text: string; modelUsed: string }> {
  const preferred =
    opts.preferredModel || process.env.GEMINI_MODEL || DEFAULT_STUDIO_MODEL;
  // Prefer real AI Studio model ids first; aliases as fallback
  const fallbackOrder = [
    'googleai/gemini-3.5-flash',
    'googleai/gemini-flash-lite-latest',
    'googleai/gemini-flash-latest',
    'googleai/gemini-2.0-flash',
    ...STUDIO_MODELS.map((m) => m.id),
  ];
  const ordered = [
    preferred,
    ...fallbackOrder.filter((id, i, arr) => id !== preferred && arr.indexOf(id) === i),
  ];
  const maxAttempts = opts.maxAttemptsPerModel ?? 2;
  let lastError: unknown;

  for (const model of ordered) {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        const result = await ai.generate({
          model: model as any,
          prompt: opts.prompt,
        });
        const text = result.text?.trim() || '';
        if (!text) throw new Error('Empty model response');
        return { text, modelUsed: model };
      } catch (err) {
        lastError = err;
        console.error(`[studio-ai] model=${model} attempt=${attempt + 1}`, err);
        if (isTransient(err) && attempt < maxAttempts - 1) {
          await sleep(800 * Math.pow(2, attempt));
          continue;
        }
        break;
      }
    }
  }

  throw new Error(
    `Studio AI unavailable after trying fallback models. ${String((lastError as Error)?.message || lastError)}`,
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
  // Soft-normalize math escapes so MathJax sees real \( \)
  raw = raw.replace(/\\\\([()[\]])/g, '\\$1');
  return raw;
}
