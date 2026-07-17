import { NextRequest } from 'next/server';
import { STUDIO_TOOL_DEFINITIONS } from '@/lib/doc-tools';
import { STUDIO_MODELS, DEFAULT_STUDIO_MODEL } from '@/lib/studio-models';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Msg = { role: 'user' | 'assistant' | 'system'; content: string };

function modelId(raw?: string) {
  const m = raw || process.env.GEMINI_MODEL || DEFAULT_STUDIO_MODEL;
  return m.replace(/^googleai\//, '');
}

function encode(ev: object) {
  return `data: ${JSON.stringify(ev)}\n\n`;
}

function parseArgs(raw: any): any {
  if (!raw) return {};
  if (typeof raw === 'object') return raw;
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw);
    } catch {
      return { raw };
    }
  }
  return {};
}

async function callGemini(opts: {
  apiKey: string;
  model: string;
  contents: any[];
  tools?: any;
  stream?: boolean;
}) {
  const { apiKey, model, contents, tools, stream } = opts;
  const method = stream ? 'streamGenerateContent' : 'generateContent';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:${method}?key=${apiKey}${
    stream ? '&alt=sse' : ''
  }`;
  const body: any = {
    contents,
    generationConfig: {
      temperature: 0.55,
      maxOutputTokens: 8192,
    },
  };
  if (tools) {
    body.tools = tools;
    body.toolConfig = { functionCallingConfig: { mode: 'AUTO' } };
  }
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return res;
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const {
    messages = [],
    documentHtml = '',
    documentTitle = 'Untitled',
    paperSize = 'letter',
    selectedText = '',
    model: preferredModel,
    autoStart = false,
    assignmentContext = '',
  } = body as {
    messages: Msg[];
    documentHtml?: string;
    documentTitle?: string;
    paperSize?: string;
    selectedText?: string;
    model?: string;
    autoStart?: boolean;
    assignmentContext?: string;
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
        send({ type: 'thinking', label: 'Pensando…' });

        const system = `You are Studio, a document copilot for academic and professional writing in Spanish or English (match the user).

Document title: ${documentTitle}
Paper size: ${paperSize}
Selected text: ${selectedText ? selectedText.slice(0, 2500) : '(none)'}
${assignmentContext ? `\nCONTEXT:\n${assignmentContext.slice(0, 8000)}\n` : ''}

CURRENT DOCUMENT HTML:
"""
${(documentHtml || '').slice(0, 32000)}
"""

RULES:
1. Be direct. NO multi-step plans/checklists. set_status only for short labels.
2. Greetings or small talk ("hola", "hi"): just reply briefly in chat. NEVER invent a document, NEVER use assignment context for that.
3. ONLY use propose_edit when the user asked to change/write content. Never claim the doc changed without it.
4. Selection rewrites: replace_selection + intensity if given.
5. Full rewrites of non-empty docs: replace_document + beforeHtml = current.
6. changeList: max 4 short bullets.
7. HTML: h1-h3, p, ul/ol/li, table, pre/code, strong, em. Math: \\( \\) and \\[ \\]. No markdown fences.
8. Empty doc + user not asking for a document: answer in text only, do not propose a full paper.
9. NEVER reuse old workshop/Gauss context unless it appears in CURRENT DOCUMENT HTML or the user message.
`;

        const contents: any[] = [
          { role: 'user', parts: [{ text: system }] },
          {
            role: 'model',
            parts: [
              {
                text: 'Listo. Usaré set_status y propose_edit para cambios en documentos existentes.',
              },
            ],
          },
        ];

        for (const m of messages as Msg[]) {
          if (!m?.content) continue;
          contents.push({
            role: m.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: m.content }],
          });
        }

        const tools = [
          {
            functionDeclarations: STUDIO_TOOL_DEFINITIONS.map((t) => ({
              name: t.name,
              description: t.description,
              parameters: t.parameters,
            })),
          },
        ];

        const modelCandidates = [
          modelId(preferredModel),
          ...STUDIO_MODELS.map((m) => modelId(m.id)),
        ].filter((v, i, a) => a.indexOf(v) === i);

        let usedModel = modelCandidates[0];
        let lastErr = '';
        let activeModel = '';

        // Find a working model with a tiny probe via first real call
        const MAX_ROUNDS = 6;
        let finalTextParts: string[] = [];
        let proposedSomething = false;
        let streamedLive = false;

        for (let round = 0; round < MAX_ROUNDS; round++) {
          let data: any = null;

          for (const mid of modelCandidates) {
            try {
              send({
                type: 'status',
                label: round === 0 ? `Connecting ${mid}…` : `Tool round ${round + 1} · ${mid}`,
              });
              const res = await callGemini({
                apiKey,
                model: mid,
                contents,
                tools,
                stream: false,
              });
              data = await res.json();
              if (!res.ok) {
                lastErr = data?.error?.message || res.statusText;
                data = null;
                continue;
              }
              usedModel = mid;
              activeModel = mid;
              break;
            } catch (e: any) {
              lastErr = e?.message || String(e);
              data = null;
            }
          }

          if (!data) {
            send({ type: 'error', message: lastErr || 'All models failed' });
            break;
          }

          const modelContent = data?.candidates?.[0]?.content;
          const parts = modelContent?.parts || [];
          if (!parts.length) {
            // finish
            break;
          }

          // Append model turn
          contents.push({ role: 'model', parts });

          const functionCalls = parts.filter((p: any) => p.functionCall);
          const textBits = parts.filter((p: any) => typeof p.text === 'string').map((p: any) => p.text);

          if (textBits.length) {
            finalTextParts = textBits;
          }

          if (!functionCalls.length) {
            // No tools — stream final text with streamGenerateContent if we only have text
            break;
          }

          // Execute tools → function responses
          const fnResponses: any[] = [];
          for (const p of functionCalls) {
            const name = p.functionCall?.name as string;
            const args = parseArgs(p.functionCall?.args);

            if (name === 'set_status') {
              const label = args.label || 'Working…';
              send({ type: 'thinking', label });
              send({ type: 'status', label });
              send({ type: 'tool_start', name, label });
              send({ type: 'tool_end', name, ok: true });
              fnResponses.push({
                functionResponse: {
                  name,
                  response: { ok: true, recorded: label },
                },
              });
              continue;
            }

            if (name === 'set_plan') {
              // Plan UI removed — acknowledge and skip noise
              fnResponses.push({
                functionResponse: {
                  name,
                  response: { ok: true, ignored: true },
                },
              });
              continue;
            }

            if (name === 'propose_edit') {
              proposedSomething = true;
              const title = args.title || 'Document change';
              send({ type: 'status', label: `Proposing: ${title}` });
              send({ type: 'tool_start', name, label: title });
              const id = `edit_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
              const beforeHtml =
                args.beforeHtml ??
                (args.mode === 'replace_document' ? documentHtml : selectedText || '');
              send({
                type: 'propose_edit',
                id,
                edit: {
                  title,
                  summary: args.summary || 'AI proposed an update',
                  mode: args.mode || 'replace_document',
                  afterHtml: args.afterHtml || '',
                  beforeHtml,
                  selectionHint: args.selectionHint || selectedText?.slice(0, 200),
                  changeList: Array.isArray(args.changeList)
                    ? args.changeList.map(String)
                    : undefined,
                },
              });
              send({ type: 'tool_end', name, ok: true });
              fnResponses.push({
                functionResponse: {
                  name,
                  response: {
                    ok: true,
                    id,
                    note: 'Shown to user as pending. Wait for Accept/Reject. Do not claim applied.',
                  },
                },
              });
              continue;
            }

            send({ type: 'tool_start', name: name || 'unknown', label: name || 'unknown' });
            send({ type: 'tool_end', name: name || 'unknown', ok: false });
            fnResponses.push({
              functionResponse: {
                name: name || 'unknown',
                response: { ok: false, error: 'Unknown tool' },
              },
            });
          }

          contents.push({ role: 'user', parts: fnResponses });

          // If we already proposed a full edit on autoStart, ask model to finish with a short message
          if (proposedSomething && autoStart) {
            contents.push({
              role: 'user',
              parts: [
                {
                  text: 'Tools done. Reply with a short confirmation in the user language (no more tools unless critical).',
                },
              ],
            });
            // one more non-tool-ish call: still allow tools but prefer text
          }
        }

        // Stream assistant text (real SSE if possible, else chunked)
        let finalText = finalTextParts.join('\n').trim();
        if (!finalText && proposedSomething) {
          finalText =
            'Listo. Revisá el cambio propuesto: podés aceptar o rechazar antes de aplicarlo al documento.';
        }
        if (!finalText) {
          // Try a pure streaming text completion
          try {
            send({ type: 'status', label: 'Writing reply…' });
            const streamRes = await callGemini({
              apiKey,
              model: activeModel || usedModel,
              contents: [
                ...contents,
                {
                  role: 'user',
                  parts: [
                    {
                      text: 'Respond briefly to the user now (no tools). Confirm next steps.',
                    },
                  ],
                },
              ],
              stream: true,
            });
            if (streamRes.ok && streamRes.body) {
              const reader = streamRes.body.getReader();
              const decoder = new TextDecoder();
              let buf = '';
              while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                buf += decoder.decode(value, { stream: true });
                // SSE lines
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
                        finalText += p.text;
                        streamedLive = true;
                        send({ type: 'text', delta: p.text });
                      }
                    }
                  } catch {
                    /* ignore partial */
                  }
                }
              }
            }
          } catch {
            /* fall through */
          }
        }

        if (!finalText) {
          finalText = proposedSomething
            ? 'Listo. Aceptá o rechazá el cambio en la tarjeta.'
            : 'Listo. Decime cómo seguimos.';
        }

        if (!streamedLive && finalText) {
          send({ type: 'status', label: 'Writing reply…' });
          const chunk = 18;
          for (let i = 0; i < finalText.length; i += chunk) {
            send({ type: 'text', delta: finalText.slice(i, i + chunk) });
            await new Promise((r) => setTimeout(r, 10));
          }
        }

        send({ type: 'status', label: 'Done' });
        send({ type: 'thinking', label: 'Done' });
        send({ type: 'done', finalText, model: usedModel });
      } catch (e: any) {
        send({ type: 'error', message: e?.message || 'Chat failed' });
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
