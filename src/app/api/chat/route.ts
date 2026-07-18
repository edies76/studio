import { NextRequest } from 'next/server';
import { STUDIO_TOOL_DEFINITIONS, extractHtmlBlocks } from '@/lib/doc-tools';
import { DEFAULT_STUDIO_MODEL } from '@/lib/studio-models';
import {
  deepseekApiKey,
  deepseekChat,
  geminiParamsToJsonSchema,
  iterateOpenAiSse,
  modelFallbackList,
  resolveModelId,
  type ChatMessage,
} from '@/lib/deepseek';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Msg = { role: 'user' | 'assistant' | 'system'; content: string };

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

function openAiTools() {
  return STUDIO_TOOL_DEFINITIONS.map((t) => ({
    type: 'function' as const,
    function: {
      name: t.name,
      description: t.description,
      parameters: geminiParamsToJsonSchema(t.parameters),
    },
  }));
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

  const apiKey = deepseekApiKey();
  if (!apiKey) {
    return new Response(encode({ type: 'error', message: 'Missing DEEPSEEK_API_KEY' }), {
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
        // Immediate first paint — real thinking signal
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
1. Speak in first person about what you will do BEFORE calling tools, when useful.
2. ALWAYS call read_document before edit_paragraph so you know block indices.
3. For point edits: use edit_paragraph once per block. Prefer several edit_paragraph over one replace_document.
4. For selection rewrites: propose_edit mode=replace_selection.
5. For full-doc rewrite only when clearly asked: propose_edit mode=replace_document + beforeHtml = current HTML.
6. NEVER claim the document is already updated. Changes are PROPOSALS — user Accept/Reject.
7. After tools, write a REAL closing message about what you proposed.
8. Greetings only → short reply, no tools.
9. HTML fragments only: h1-h3,p,ul,ol,li,table,pre,code,strong,em. No markdown fences.
10. set_status labels must be concrete in user language.
`;

        const chatMessages: ChatMessage[] = [{ role: 'system', content: system }];
        for (const m of messages as Msg[]) {
          if (!m?.content) continue;
          if (m.role === 'system') continue;
          chatMessages.push({
            role: m.role === 'assistant' ? 'assistant' : 'user',
            content: m.content,
          });
        }

        const tools = openAiTools();
        const models = modelFallbackList(preferredModel || resolveModelId(DEFAULT_STUDIO_MODEL));
        let usedModel = models[0];
        let lastErr = '';

        const MAX_ROUNDS = 5;
        let finalTextParts: string[] = [];
        let proposedSomething = false;
        let streamedLive = false;

        for (let round = 0; round < MAX_ROUNDS; round++) {
          if (round === 0) send({ type: 'thinking', label: 'Pensando…' });

          let message: any = null;
          for (const mid of models) {
            try {
              // Tool rounds: non-stream for reliable tool_calls (fast single call, no multi-model spam)
              const res = await deepseekChat({
                apiKey,
                model: mid,
                messages: chatMessages,
                tools,
                stream: false,
                temperature: 0.5,
                maxTokens: 8192,
              });
              const data = await res.json();
              if (!res.ok) {
                lastErr = data?.error?.message || res.statusText;
                continue;
              }
              message = data?.choices?.[0]?.message;
              if (!message) {
                lastErr = 'empty message';
                continue;
              }
              usedModel = mid;
              break;
            } catch (e: any) {
              lastErr = e?.message || String(e);
              message = null;
            }
          }

          if (!message) {
            send({ type: 'error', message: lastErr || 'All models failed' });
            break;
          }

          const toolCalls = Array.isArray(message.tool_calls) ? message.tool_calls : [];
          const contentText = typeof message.content === 'string' ? message.content : '';

          chatMessages.push({
            role: 'assistant',
            content: contentText || null,
            tool_calls: toolCalls.length ? toolCalls : undefined,
          });

          if (contentText?.trim()) {
            finalTextParts = [contentText];
            streamedLive = true;
            send({ type: 'text', delta: contentText });
            if (toolCalls.length) send({ type: 'text', delta: '\n' });
          }

          if (!toolCalls.length) break;

          // Execute tools → OpenAI tool role messages
          for (const tc of toolCalls) {
            const name = tc.function?.name as string;
            const args = parseArgs(tc.function?.arguments);
            const callId = tc.id || `call_${Date.now()}`;

            const reply = async (responseObj: object) => {
              chatMessages.push({
                role: 'tool',
                tool_call_id: callId,
                name,
                content: JSON.stringify(responseObj),
              });
            };

            if (name === 'set_status') {
              const label = args.label || 'Trabajando…';
              const tid = `st_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
              send({ type: 'thinking', label });
              send({ type: 'status', label });
              send({ type: 'tool_start', name, label, id: tid });
              send({ type: 'tool_end', name, ok: true, label, id: tid });
              await reply({ ok: true, recorded: label });
              continue;
            }

            if (name === 'set_plan') {
              await reply({ ok: true, ignored: true });
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
              await reply({
                ok: true,
                blockCount: blocks.length,
                blocks: blocks.map((b) => ({
                  index: b.index,
                  tag: b.tag,
                  preview: b.preview,
                })),
                listing,
                note: 'Use blockIndex with edit_paragraph for targeted changes.',
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
                await reply({
                  ok: false,
                  error: `blockIndex ${blockIndex} out of range (0..${Math.max(0, blocks.length - 1)})`,
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
              await reply({
                ok: true,
                id,
                blockIndex,
                note: 'Pending user Accept/Reject. Do NOT claim applied.',
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
              await reply({
                ok: true,
                id,
                note: 'Pending user Accept/Reject. Do NOT claim applied.',
              });
              continue;
            }

            const tid = `uk_${Date.now()}`;
            send({
              type: 'tool_start',
              name: name || 'unknown',
              label: name || 'unknown',
              id: tid,
            });
            send({
              type: 'tool_end',
              name: name || 'unknown',
              ok: false,
              label: 'Tool desconocida',
              id: tid,
            });
            await reply({ ok: false, error: 'Unknown tool' });
          }

          if (proposedSomething && autoStart) {
            chatMessages.push({
              role: 'user',
              content:
                'Tools done. Reply with a short confirmation in the user language (no more tools unless critical).',
            });
          }
        }

        let finalText = finalTextParts.join('\n').trim();

        // Stream a concrete closing if tools-only
        if (!finalText || (proposedSomething && finalText.length < 20)) {
          try {
            send({ type: 'thinking', label: 'Escribiendo respuesta…' });
            const closeRes = await deepseekChat({
              apiKey,
              model: usedModel,
              messages: [
                ...chatMessages,
                {
                  role: 'user',
                  content: proposedSomething
                    ? 'Tools finished. In the user language, write 2–4 short sentences: (1) what you actually proposed, (2) that nothing is applied until Accept/Reject. No tools.'
                    : 'In the user language, answer now in 1–3 short sentences. No tools.',
                },
              ],
              stream: true,
              temperature: 0.5,
              maxTokens: 1024,
            });
            if (closeRes.ok && closeRes.body) {
              finalText = '';
              for await (const chunk of iterateOpenAiSse(closeRes.body)) {
                if (chunk.content) {
                  finalText += chunk.content;
                  streamedLive = true;
                  send({ type: 'text', delta: chunk.content });
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
