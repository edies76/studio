import { NextRequest } from 'next/server';
import { DEFAULT_STUDIO_MODEL } from '@/lib/studio-models';
import {
  deepseekApiKey,
  deepseekChat,
  iterateOpenAiSse,
  modelFallbackList,
  resolveModelId,
} from '@/lib/deepseek';
import { slog } from '@/lib/server-log';
import { compactDraftHtml } from '@/lib/draft-output';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function encode(ev: object) {
  return `data: ${JSON.stringify(ev)}\n\n`;
}

/** Fast path: stream a full HTML document — real DeepSeek token deltas */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { prompt = '', model: preferredModel, language } = body as {
    prompt?: string;
    model?: string;
    language?: string;
  };

  const apiKey = deepseekApiKey();
  if (!apiKey) {
    slog.error('draft', 'missing AI provider credentials');
    return new Response(encode({ type: 'error', message: 'Faltan las credenciales del proveedor de IA en producción.' }), {
      status: 500,
      headers: { 'Content-Type': 'text/event-stream' },
    });
  }

  const stream = new ReadableStream({
    async start(controller) {
      const t0 = Date.now();
      const send = (ev: object) => {
        try {
          controller.enqueue(new TextEncoder().encode(encode(ev)));
        } catch {
          /* closed */
        }
      };

      try {
        slog.info('draft', 'start', {
          promptLen: String(prompt || '').length,
          language,
          preferredModel,
        });
        send({ type: 'status', label: 'Escribiendo…' });

        const system = `You write a concise, editable document in semantic HTML.
Output ONLY an HTML fragment (no markdown fences, no html/body).
Allowed tags: h1,h2,h3,p,ul,ol,li,strong,em,blockquote,table,thead,tbody,tr,th,td,pre,code,br.
Math: ALWAYS use \\( ... \\) inline and \\[ ... \\] display (never destroy delimiters). Prefer clean LaTeX.
For important formulas wrap as:
<span class="studio-math-inline" data-tex="TEX" data-display="0">\\(TEX\\)</span>
or display:
<div class="studio-math-block" data-tex="TEX" data-display="1">\\[TEX\\]</div>
Tables: use real <table><tr><th>/<td> with headers when comparing data.
Language: match the user's language. Spanish if the request is in Spanish; never switch to English without a reason.
Structure: use one short factual h1 and only the sections the request needs. Keep a short request short: no more than 3 brief sections or paragraphs unless the user asks for length.
Do not create a cover page, subtitle, drop cap, decorative divider, illustration, emoji, icon, invented quote, or visual ornament unless the user explicitly requests it.
Do not use img, svg, hr, style, or layout hacks. The canvas controls pagination and visual style.
NO meta commentary. Start directly with <h1>...`;

        const models = modelFallbackList(preferredModel || resolveModelId(DEFAULT_STUDIO_MODEL));
        let text = '';
        let used = models[0];
        let lastErr = '';

        for (const mid of models) {
          used = mid;
          try {
            const res = await deepseekChat({
              apiKey,
              model: mid,
              messages: [
                { role: 'system', content: system },
                { role: 'user', content: String(prompt || '') },
              ],
              stream: true,
              temperature: 0.35,
              maxTokens: 8192,
            });

            if (!res.ok || !res.body) {
              const errBody = await res.text().catch(() => '');
              lastErr = errBody || res.statusText || `HTTP ${res.status}`;
              // Non-stream fallback for this model
              const res2 = await deepseekChat({
                apiKey,
                model: mid,
                messages: [
                  { role: 'system', content: system },
                  { role: 'user', content: String(prompt || '') },
                ],
                stream: false,
                temperature: 0.35,
                maxTokens: 8192,
              });
              const data = await res2.json();
              if (!res2.ok) {
                lastErr = data?.error?.message || res2.statusText || lastErr;
                continue;
              }
              text = String(data?.choices?.[0]?.message?.content || '');
              if (text) {
                // Real content once (not fake micro-chunks)
                send({ type: 'html_delta', delta: text });
                break;
              }
              lastErr = 'empty';
              continue;
            }

            // Real SSE token stream from DeepSeek
            for await (const chunk of iterateOpenAiSse(res.body)) {
              if (chunk.content) {
                text += chunk.content;
                send({ type: 'html_delta', delta: chunk.content });
              }
            }

            if (text.trim()) break;
            lastErr = 'empty stream';
          } catch (e: any) {
            lastErr = e?.message || String(e);
          }
        }

        if (!text.trim()) {
          send({ type: 'error', message: lastErr || 'Draft failed' });
          send({ type: 'done' });
          controller.close();
          return;
        }

        const html = compactDraftHtml(text);

        slog.info('draft', 'done', { ms: Date.now() - t0, model: used, htmlLen: html.length });
        send({ type: 'html_ready', html, model: used });
        send({ type: 'done' });
      } catch (e: any) {
        slog.error('draft', 'error', { ms: Date.now() - t0, err: e?.message || String(e) });
        send({ type: 'error', message: e?.message || 'Draft failed' });
        send({ type: 'done' });
      } finally {
        try {
          controller.close();
        } catch {
          /* ignore */
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  });
}
