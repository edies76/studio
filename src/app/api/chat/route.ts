import { NextRequest } from 'next/server';
import { STUDIO_TOOL_DEFINITIONS, extractHtmlBlocks } from '@/lib/doc-tools';
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

        const system = `You are Studio, a document copilot. Match the user language (Spanish/English).

Document title: ${documentTitle}
Paper size: ${paperSize}
Selected text: ${selectedText ? selectedText.slice(0, 2500) : '(none)'}
${assignmentContext ? `\nCONTEXT:\n${assignmentContext.slice(0, 8000)}\n` : ''}

CURRENT DOCUMENT HTML:
"""
${(documentHtml || '').slice(0, 32000)}
"""

BEHAVIOR (REAL, not simulated):
1. Speak in first person about what you will do BEFORE calling tools, when useful: e.g. "Primero leo el documento y después edito los párrafos que pediste."
2. ALWAYS call read_document before edit_paragraph so you know block indices.
3. For point edits (one or a few paragraphs): use edit_paragraph once per block. Prefer several edit_paragraph over one replace_document.
4. For selection rewrites: propose_edit mode=replace_selection with intensity if given.
5. For full-doc rewrite only when the user clearly asked for a full rewrite: propose_edit mode=replace_document + beforeHtml = current HTML.
6. NEVER claim the document is already updated. Changes are PROPOSALS — user Accept/Reject.
7. After tools, write a REAL closing message: what you proposed (titles + which blocks), and ask them to Accept/Reject on the canvas. No empty "Listo, decime cómo seguimos" without substance.
8. Greetings only → short reply, no tools, no document.
9. HTML fragments only: h1-h3,p,ul,ol,li,table,pre,code,strong,em. No markdown fences.
10. set_status labels must be concrete in user language ("Leyendo…", "Editando párrafo 3…").
`;

        const contents: any[] = [
          { role: 'user', parts: [{ text: system }] },
          {
            role: 'model',
            parts: [
              {
                text: 'Entendido. Voy a narrar lo que hago, usar read_document + edit_paragraph para cambios puntuales, y proponer edits para que el usuario acepte o rechace.',
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

          // Real model calls only — no "Connecting gemini-…" spam (was just fallback loop noise)
          if (round === 0) {
            send({ type: 'thinking', label: 'Pensando…' });
          }

          for (const mid of modelCandidates) {
            try {
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
            // Real narration as the model speaks (before / between tools)
            for (const t of textBits) {
              if (t?.trim()) {
                streamedLive = true;
                send({ type: 'text', delta: t });
              }
            }
            if (functionCalls.length) send({ type: 'text', delta: '\n' });
          }

          if (!functionCalls.length) {
            break;
          }

          // Execute tools → function responses
          const fnResponses: any[] = [];
          for (const p of functionCalls) {
            const name = p.functionCall?.name as string;
            const args = parseArgs(p.functionCall?.args);

            if (name === 'set_status') {
              const label = args.label || 'Trabajando…';
              const tid = `st_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
              send({ type: 'thinking', label });
              send({ type: 'status', label });
              send({ type: 'tool_start', name, label, id: tid });
              send({ type: 'tool_end', name, ok: true, label, id: tid });
              fnResponses.push({
                functionResponse: {
                  name,
                  response: { ok: true, recorded: label },
                },
              });
              continue;
            }

            if (name === 'set_plan') {
              fnResponses.push({
                functionResponse: {
                  name,
                  response: { ok: true, ignored: true },
                },
              });
              continue;
            }

            if (name === 'read_document') {
              const tid = `rd_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
              const focus = args.focus ? String(args.focus) : '';
              send({
                type: 'tool_start',
                name,
                label: focus ? `Leyendo (${focus})…` : 'Leyendo el documento…',
                id: tid,
              });
              const blocks = extractHtmlBlocks(documentHtml || '');
              const lines = blocks.map(
                (b) =>
                  `[${b.index}] <${b.tag}> ${b.preview}${b.preview.length >= 140 ? '…' : ''}`,
              );
              const listing =
                lines.length > 0
                  ? lines.join('\n')
                  : '(documento vacío o sin bloques parseables)';
              send({
                type: 'tool_end',
                name,
                ok: true,
                label: `Leído · ${blocks.length} bloque(s)`,
                id: tid,
              });
              fnResponses.push({
                functionResponse: {
                  name,
                  response: {
                    ok: true,
                    blockCount: blocks.length,
                    blocks: blocks.map((b) => ({
                      index: b.index,
                      tag: b.tag,
                      preview: b.preview,
                    })),
                    listing,
                    note: 'Use blockIndex with edit_paragraph for targeted changes.',
                  },
                },
              });
              continue;
            }

            if (name === 'edit_paragraph') {
              proposedSomething = true;
              const tid = `ep_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
              const blockIndex = Number(args.blockIndex);
              const title = args.title || `Editar bloque ${blockIndex}`;
              const blocks = extractHtmlBlocks(documentHtml || '');
              const block = Number.isFinite(blockIndex) ? blocks[blockIndex] : undefined;
              send({
                type: 'tool_start',
                name,
                label: `Editando bloque ${Number.isFinite(blockIndex) ? blockIndex : '?'}…`,
                id: tid,
              });
              if (!block) {
                send({
                  type: 'tool_end',
                  name,
                  ok: false,
                  label: `Bloque ${blockIndex} no encontrado`,
                  id: tid,
                });
                fnResponses.push({
                  functionResponse: {
                    name,
                    response: {
                      ok: false,
                      error: `blockIndex ${blockIndex} out of range (0..${Math.max(0, blocks.length - 1)})`,
                    },
                  },
                });
                continue;
              }
              const id = `edit_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
              const beforeHtml = args.beforeHtml || block.html;
              const afterHtml = args.afterHtml || '';
              send({
                type: 'propose_edit',
                id,
                edit: {
                  title,
                  summary: args.summary || `Cambio en bloque ${blockIndex} (<${block.tag}>)`,
                  mode: 'replace_block',
                  blockIndex,
                  afterHtml,
                  beforeHtml,
                  selectionHint: block.preview,
                  changeList: [`Bloque ${blockIndex} (<${block.tag}>)`],
                },
              });
              send({
                type: 'tool_end',
                name,
                ok: true,
                label: `Bloque ${blockIndex} propuesto · aceptá o rechazá`,
                id: tid,
              });
              fnResponses.push({
                functionResponse: {
                  name,
                  response: {
                    ok: true,
                    id,
                    blockIndex,
                    note: 'Pending user Accept/Reject. Do NOT claim applied.',
                  },
                },
              });
              continue;
            }

            if (name === 'propose_edit') {
              proposedSomething = true;
              const title = args.title || 'Cambio de documento';
              const tid = `pe_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
              send({ type: 'status', label: `Proponiendo: ${title}` });
              send({ type: 'tool_start', name, label: `Proponiendo: ${title}`, id: tid });
              const id = `edit_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
              const beforeHtml =
                args.beforeHtml ??
                (args.mode === 'replace_document' ? documentHtml : selectedText || '');
              send({
                type: 'propose_edit',
                id,
                edit: {
                  title,
                  summary: args.summary || 'Cambio propuesto',
                  mode: args.mode || 'replace_document',
                  afterHtml: args.afterHtml || '',
                  beforeHtml,
                  selectionHint: args.selectionHint || selectedText?.slice(0, 200),
                  changeList: Array.isArray(args.changeList)
                    ? args.changeList.map(String)
                    : undefined,
                },
              });
              send({
                type: 'tool_end',
                name,
                ok: true,
                label: `Propuesto: ${title} · aceptá o rechazá`,
                id: tid,
              });
              fnResponses.push({
                functionResponse: {
                  name,
                  response: {
                    ok: true,
                    id,
                    note: 'Pending user Accept/Reject. Do NOT claim applied.',
                  },
                },
              });
              continue;
            }

            const tid = `uk_${Date.now()}`;
            send({ type: 'tool_start', name: name || 'unknown', label: name || 'unknown', id: tid });
            send({ type: 'tool_end', name: name || 'unknown', ok: false, label: 'Tool desconocida', id: tid });
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

        // Prefer real model text; never invent a fake "how do we continue"
        let finalText = finalTextParts.join('\n').trim();

        // Always ask model for a concrete closing if we only ran tools
        if (!finalText || (proposedSomething && finalText.length < 20)) {
          try {
            send({ type: 'thinking', label: 'Escribiendo respuesta…' });
            const closeRes = await callGemini({
              apiKey,
              model: activeModel || usedModel,
              contents: [
                ...contents,
                {
                  role: 'user',
                  parts: [
                    {
                      text: proposedSomething
                        ? 'Tools finished. In the user language, write 2–4 short sentences: (1) what you actually proposed (titles / which blocks), (2) that nothing is applied until they Accept/Reject on the canvas. No tools. Be specific, not generic.'
                        : 'In the user language, answer the user now in 1–3 short sentences. No tools. No filler like "decime cómo seguimos" without content.',
                    },
                  ],
                },
              ],
              stream: true,
            });
            if (closeRes.ok && closeRes.body) {
              finalText = '';
              const reader = closeRes.body.getReader();
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
                        finalText += p.text;
                        streamedLive = true;
                        send({ type: 'text', delta: p.text });
                      }
                    }
                  } catch {
                    /* ignore */
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
            ? 'Propuse cambios en el lienzo (ghost). Nada se aplicó todavía: aceptá o rechazá cada uno.'
            : 'No pude completar la respuesta. ¿Lo intentamos de nuevo con más detalle?';
        }

        // Real stream only — if we already streamed tokens from the model, don't fake-chunk
        if (!streamedLive && finalText) {
          send({ type: 'text', delta: finalText });
        }

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
