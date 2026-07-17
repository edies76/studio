import { NextRequest } from 'next/server';
import { DEFAULT_STUDIO_MODEL, STUDIO_MODELS } from '@/lib/studio-models';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function modelId(raw?: string) {
  return (raw || process.env.GEMINI_MODEL || DEFAULT_STUDIO_MODEL).replace(/^googleai\//, '');
}

function encode(ev: object) {
  return `data: ${JSON.stringify(ev)}\n\n`;
}

/** Fast path: stream a full HTML document — no tool loop, auto-apply on client */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { prompt = '', model: preferredModel, language } = body as {
    prompt?: string;
    model?: string;
    language?: string;
  };

  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    return new Response(encode({ type: 'error', message: 'Missing GOOGLE_API_KEY' }), {
      status: 500,
      headers: { 'Content-Type': 'text/event-stream' },
    });
  }

  const stream = new ReadableStream({
    async start(controller) {
      const send = (ev: object) => {
        try {
          controller.enqueue(new TextEncoder().encode(encode(ev)));
        } catch {
          /* closed */
        }
      };

      try {
        send({ type: 'status', label: 'Drafting…' });

        const system = `You write complete academic/professional HTML documents FAST.
Output ONLY an HTML fragment (no markdown fences, no html/body).
Tags: h1,h2,h3,p,ul,ol,li,strong,em,table,pre,code.
Math: use \\( ... \\) inline and \\[ ... \\] display. Prefer clean LaTeX; Unicode (x₁) ok for simple cases.
Tables: use real <table><tr><th>/<td> with headers when comparing data.
Language: match user (${language || 'auto'}). Spanish if user writes Spanish.
Structure: clear title + sections. Be complete but concise (good for ~3–6 pages).
NO meta commentary. Start directly with <h1>...`;

        const models = [
          modelId(preferredModel),
          ...STUDIO_MODELS.map((m) => modelId(m.id)),
        ].filter((v, i, a) => a.indexOf(v) === i);

        let text = '';
        let used = models[0];
        let lastErr = '';

        for (const mid of models) {
          used = mid;
          try {
            // Prefer streaming SSE
            const url = `https://generativelanguage.googleapis.com/v1beta/models/${mid}:streamGenerateContent?alt=sse&key=${apiKey}`;
            const res = await fetch(url, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                contents: [
                  {
                    role: 'user',
                    parts: [{ text: `${system}\n\nUSER REQUEST:\n${prompt}` }],
                  },
                ],
                generationConfig: {
                  temperature: 0.55,
                  maxOutputTokens: 8192,
                },
              }),
            });

            if (!res.ok || !res.body) {
              // fallback non-stream
              const url2 = `https://generativelanguage.googleapis.com/v1beta/models/${mid}:generateContent?key=${apiKey}`;
              const res2 = await fetch(url2, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  contents: [
                    {
                      role: 'user',
                      parts: [{ text: `${system}\n\nUSER REQUEST:\n${prompt}` }],
                    },
                  ],
                  generationConfig: { temperature: 0.55, maxOutputTokens: 8192 },
                }),
              });
              const data = await res2.json();
              if (!res2.ok) {
                lastErr = data?.error?.message || res2.statusText;
                continue;
              }
              text =
                data?.candidates?.[0]?.content?.parts?.map((p: any) => p.text || '').join('') ||
                '';
              if (text) break;
              lastErr = 'empty';
              continue;
            }

            const reader = res.body.getReader();
            const decoder = new TextDecoder();
            let buf = '';
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              buf += decoder.decode(value, { stream: true });
              const lines = buf.split('\n');
              buf = lines.pop() || '';
              for (const line of lines) {
                if (!line.startsWith('data:')) continue;
                const payload = line.slice(5).trim();
                if (!payload || payload === '[DONE]') continue;
                try {
                  const json = JSON.parse(payload);
                  const parts = json?.candidates?.[0]?.content?.parts || [];
                  for (const p of parts) {
                    if (p.text) {
                      text += p.text;
                      send({ type: 'html_delta', delta: p.text });
                    }
                  }
                } catch {
                  /* partial */
                }
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

        // Clean fences if any
        let html = text.trim();
        if (html.startsWith('```')) {
          html = html.replace(/^```(?:html)?\s*/i, '').replace(/\s*```$/i, '');
        }

        send({ type: 'html_ready', html, model: used });
        send({ type: 'status', label: 'Done' });
        send({ type: 'done' });
      } catch (e: any) {
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
