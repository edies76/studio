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
import {
  buildMathHtml,
  ensureMathHosts,
  listEquations,
  mathSafeSnapshot,
  protectMathInRewrite,
  replaceEquationAt,
} from '@/lib/math-tools';
import { slog } from '@/lib/server-log';

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
    slog.error('chat', 'missing DEEPSEEK_API_KEY');
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

      const t0 = Date.now();
      slog.info('chat', 'request.start', {
        title: documentTitle,
        paperSize,
        msgCount: messages?.length || 0,
        htmlLen: (documentHtml || '').length,
        hasSelection: Boolean(selectedText?.trim()),
        preferredModel,
      });

      // Working HTML copy for math-safe tools within this request
      let liveHtml = ensureMathHosts(documentHtml || '');
      /** Special MATH-SAFE mode: active when doc has equations or user talks math */
      let mathSafeMode = listEquations(liveHtml).length > 0;

      try {
        // Immediate first paint — real thinking signal
        send({ type: 'thinking', label: 'Pensando…' });

        const snap0 = mathSafeSnapshot(liveHtml);
        const eqCount = snap0.equationCount;
        const lastUser = [...(messages || [])]
          .reverse()
          .find((m) => m.role === 'user')
          ?.content || '';
        if (
          /ecuaci[oó]n|f[oó]rmula|latex|math|matriz|matrix|\\frac|\\begin|algebra/i.test(
            lastUser,
          )
        ) {
          mathSafeMode = true;
        }
        slog.info('chat', 'math.scan', {
          equationCount: eqCount,
          mathSafeMode,
          sample: snap0.equations.slice(0, 6),
        });

        const system = `You are Studio, a document copilot. Match the user language (Spanish/English).

Document title: ${documentTitle}
Paper size: ${paperSize}
Selected text: ${selectedText ? selectedText.slice(0, 2500) : '(none)'}
Equations detected in document: ${eqCount}
MATH-SAFE MODE: ${mathSafeMode ? 'ON (mandatory for this turn)' : 'standby — activate if you touch formulas'}
${assignmentContext ? `\nCONTEXT:\n${assignmentContext.slice(0, 8000)}\n` : ''}

CURRENT DOCUMENT HTML (math already in studio-math / data-tex hosts when possible):
"""
${liveHtml.slice(0, 32000)}
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
9. HTML fragments only: h1-h3,p,ul,ol,li,table,pre,code,strong,em,span/div.studio-math-*. No markdown fences.

=== MATH-SAFE MODE (hard rules — equations must NOT break) ===
The server runs a math-safe protector on every free HTML rewrite. Still:
A. If equationCount > 0 OR task mentions formulas: call list_equations FIRST before any formula change.
B. To CHANGE a formula: ONLY edit_equation(equationIndex, tex). Never rewrite TeX by free-text inside edit_paragraph.
C. To ADD a formula: insert_equation. Never paste raw broken LaTeX as plain text.
D. edit_paragraph / propose_edit may change prose around math but MUST keep existing <span/div class="studio-math-… data-tex="…"> hosts. If you drop them, the server restores them.
E. TeX in edit_equation is WITHOUT surrounding \\( \\) or \\[ \\].
F. Prefer Unicode only for trivial variables; real formulas stay LaTeX.
G. read_document may show tag "math" for display equation blocks — use those indices with insert_equation(afterBlockIndex).

10. set_status labels must be concrete in user language.
11. Style norms (APA/IEEE/MLA/simple/minimal): follow the user message; still obey MATH-SAFE.
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

        // Most Studio edits are read → propose. Three tool rounds are enough
        // for that path and prevent a slow runaway loop when a model keeps
        // asking for another status/read call.
        const MAX_ROUNDS = 3;
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
                maxTokens: 4096,
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

            slog.info('chat', 'tool.invoke', { round, name, callId, argsKeys: Object.keys(args || {}) });

            if (name === 'set_status') {
              const label = args.label || 'Trabajando…';
              const tid = `st_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
              send({ type: 'thinking', label });
              send({ type: 'status', label });
              send({ type: 'tool_start', name, label, id: tid });
              send({ type: 'tool_end', name, ok: true, label, id: tid });
              slog.info('chat', 'tool.set_status', { label });
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
              // Use liveHtml so prior math tools in this turn are visible
              const blocks = extractHtmlBlocks(liveHtml);
              const mathBlocks = blocks.filter((b) => b.tag === 'math').length;
              slog.info('chat', 'tool.read_document', {
                blockCount: blocks.length,
                mathBlocks,
                focus: focus || null,
                htmlLen: liveHtml.length,
              });
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
                label: `Leído · ${blocks.length} bloque(s)${mathBlocks ? ` · ${mathBlocks} math` : ''}`,
                id: tid,
              });
              await reply({
                ok: true,
                blockCount: blocks.length,
                mathBlockCount: mathBlocks,
                mathSafeMode,
                blocks: blocks.map((b) => ({
                  index: b.index,
                  tag: b.tag,
                  preview: b.preview,
                })),
                listing,
                note: 'Use blockIndex with edit_paragraph. Tag "math" = display equation host. Prefer list_equations + edit_equation for formulas.',
              });
              continue;
            }

            if (name === 'edit_paragraph') {
              proposedSomething = true;
              const tid = `ep_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
              const blockIndex = Number(args.blockIndex);
              const title = args.title || `Editar bloque ${blockIndex}`;
              const blocks = extractHtmlBlocks(liveHtml);
              const block = Number.isFinite(blockIndex) ? blocks[blockIndex] : undefined;
              send({
                type: 'tool_start',
                name,
                label: `Editando bloque ${Number.isFinite(blockIndex) ? blockIndex : '?'}…`,
                id: tid,
              });
              if (!block) {
                slog.warn('chat', 'tool.edit_paragraph.miss', {
                  blockIndex,
                  available: blocks.length,
                });
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
              // Math hosts must not be edited via free HTML — redirect agent
              if (block.tag === 'math') {
                slog.warn('chat', 'tool.edit_paragraph.math_block_redirect', { blockIndex });
                send({
                  type: 'tool_end',
                  name,
                  ok: false,
                  label: 'Math block → use edit_equation',
                  id: tid,
                });
                await reply({
                  ok: false,
                  error:
                    'This block is a math host. Call list_equations then edit_equation(index, tex). Do not use edit_paragraph on math.',
                });
                continue;
              }
              const id = `edit_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
              const beforeHtml = args.beforeHtml || block.html;
              const guarded = protectMathInRewrite(beforeHtml, args.afterHtml || '');
              if (guarded.restored > 0) {
                mathSafeMode = true;
                slog.warn('chat', 'math.protect.restored', {
                  tool: 'edit_paragraph',
                  blockIndex,
                  restored: guarded.restored,
                  lostTex: guarded.lostTex,
                });
              }
              const afterHtml = guarded.html;
              // Patch liveHtml for multi-tool turns
              if (liveHtml.includes(block.html)) {
                liveHtml = liveHtml.replace(block.html, afterHtml);
              }
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
                  changeList: [
                    `Bloque ${blockIndex} (<${block.tag}>)`,
                    ...(guarded.restored
                      ? [`MATH-SAFE: restauradas ${guarded.restored} ecuación(es)`]
                      : []),
                  ],
                },
              });
              slog.info('chat', 'tool.edit_paragraph', {
                blockIndex,
                tag: block.tag,
                afterLen: afterHtml.length,
                mathBefore: guarded.beforeCount,
                mathAfter: guarded.afterCount,
                mathRestored: guarded.restored,
              });
              send({
                type: 'tool_end',
                name,
                ok: true,
                label: `Block ${blockIndex} proposed · accept or reject`,
                id: tid,
              });
              await reply({
                ok: true,
                id,
                blockIndex,
                mathSafe: {
                  restored: guarded.restored,
                  beforeCount: guarded.beforeCount,
                  afterCount: guarded.afterCount,
                },
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
              const mode = args.mode || 'replace_document';
              const beforeHtml =
                args.beforeHtml ??
                (mode === 'replace_document' ? liveHtml : selectedText || liveHtml);
              const guarded = protectMathInRewrite(
                mode === 'replace_document' ? liveHtml : beforeHtml,
                args.afterHtml || '',
              );
              if (guarded.restored > 0) {
                mathSafeMode = true;
                slog.warn('chat', 'math.protect.restored', {
                  tool: 'propose_edit',
                  mode,
                  restored: guarded.restored,
                  lostTex: guarded.lostTex,
                });
              }
              const afterHtml = guarded.html;
              if (mode === 'replace_document') {
                liveHtml = afterHtml;
              }
              const changeList = Array.isArray(args.changeList)
                ? args.changeList.map(String)
                : [];
              if (guarded.restored) {
                changeList.push(`MATH-SAFE: restauradas ${guarded.restored} ecuación(es)`);
              }
              send({
                type: 'propose_edit',
                id,
                edit: {
                  title,
                  summary: args.summary || 'Cambio propuesto',
                  mode,
                  afterHtml,
                  beforeHtml,
                  selectionHint: args.selectionHint || selectedText?.slice(0, 200),
                  changeList: changeList.length ? changeList : undefined,
                },
              });
              slog.info('chat', 'tool.propose_edit', {
                id,
                mode,
                afterLen: afterHtml.length,
                mathBefore: guarded.beforeCount,
                mathAfter: guarded.afterCount,
                mathRestored: guarded.restored,
              });
              send({
                type: 'tool_end',
                name,
                ok: true,
                label: `Proposed: ${title} · accept or reject`,
                id: tid,
              });
              await reply({
                ok: true,
                id,
                mathSafe: {
                  restored: guarded.restored,
                  beforeCount: guarded.beforeCount,
                  afterCount: guarded.afterCount,
                },
                note: 'Pending user Accept/Reject. Do NOT claim applied.',
              });
              continue;
            }

            if (name === 'list_equations') {
              const tid = `lq_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
              send({
                type: 'tool_start',
                name,
                label: 'Inventariando ecuaciones…',
                id: tid,
              });
              const eqs = listEquations(liveHtml);
              slog.info('chat', 'tool.list_equations', {
                count: eqs.length,
                focus: args.focus || null,
                sample: eqs.slice(0, 5).map((e) => ({ i: e.index, display: e.display, tex: e.tex.slice(0, 80) })),
              });
              send({
                type: 'tool_end',
                name,
                ok: true,
                label: `${eqs.length} ecuación(es)`,
                id: tid,
              });
              await reply({
                ok: true,
                count: eqs.length,
                equations: eqs.map((e) => ({
                  index: e.index,
                  display: e.display,
                  tex: e.tex,
                  contextPreview: e.contextPreview,
                })),
                note: 'Use edit_equation(index, tex) to change one formula safely.',
              });
              continue;
            }

            if (name === 'edit_equation') {
              proposedSomething = true;
              const tid = `ee_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
              const equationIndex = Number(args.equationIndex);
              const tex = String(args.tex || '').trim();
              const title = args.title || `Ecuación ${equationIndex}`;
              send({
                type: 'tool_start',
                name,
                label: `Editando ecuación ${Number.isFinite(equationIndex) ? equationIndex : '?'}…`,
                id: tid,
              });
              if (!tex || !Number.isFinite(equationIndex)) {
                slog.warn('chat', 'tool.edit_equation.bad_args', { equationIndex, texLen: tex.length });
                send({
                  type: 'tool_end',
                  name,
                  ok: false,
                  label: 'Índice o TeX inválido',
                  id: tid,
                });
                await reply({ ok: false, error: 'equationIndex and tex required' });
                continue;
              }
              const beforeList = listEquations(liveHtml);
              const before = beforeList[equationIndex];
              const result = replaceEquationAt(
                liveHtml,
                equationIndex,
                tex,
                typeof args.display === 'boolean' ? args.display : undefined,
              );
              if (!result || !before) {
                slog.warn('chat', 'tool.edit_equation.miss', {
                  equationIndex,
                  available: beforeList.length,
                });
                send({
                  type: 'tool_end',
                  name,
                  ok: false,
                  label: `Ecuación ${equationIndex} no encontrada`,
                  id: tid,
                });
                await reply({
                  ok: false,
                  error: `equationIndex ${equationIndex} out of range (0..${Math.max(0, beforeList.length - 1)})`,
                });
                continue;
              }
              const id = `edit_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
              // Propose full document HTML with only that math host swapped
              send({
                type: 'propose_edit',
                id,
                edit: {
                  title,
                  summary:
                    args.summary ||
                    `LaTeX: ${before.tex.slice(0, 40)} → ${tex.slice(0, 40)}`,
                  mode: 'replace_document',
                  afterHtml: result.html,
                  beforeHtml: liveHtml,
                  changeList: [
                    `Ecuación #${equationIndex}`,
                    before.display ? 'display' : 'inline',
                    `antes: ${before.tex.slice(0, 60)}`,
                    `después: ${tex.slice(0, 60)}`,
                  ],
                },
              });
              // Keep liveHtml for subsequent math tools in this turn
              liveHtml = result.html;
              slog.info('chat', 'tool.edit_equation.ok', {
                equationIndex,
                before: before.tex.slice(0, 100),
                after: tex.slice(0, 100),
                display: result.entry.display,
              });
              send({
                type: 'tool_end',
                name,
                ok: true,
                label: `Equation ${equationIndex} proposed · accept or reject`,
                id: tid,
              });
              await reply({
                ok: true,
                id,
                equationIndex,
                note: 'Pending Accept/Reject. Math host only changed.',
              });
              continue;
            }

            if (name === 'insert_equation') {
              proposedSomething = true;
              const tid = `ie_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
              const tex = String(args.tex || '').trim();
              const display = args.display !== false;
              const title = args.title || 'Nueva ecuación';
              send({
                type: 'tool_start',
                name,
                label: 'Insertando ecuación…',
                id: tid,
              });
              if (!tex) {
                send({
                  type: 'tool_end',
                  name,
                  ok: false,
                  label: 'TeX vacío',
                  id: tid,
                });
                await reply({ ok: false, error: 'tex required' });
                continue;
              }
              const mathHtml = buildMathHtml(tex, display);
              const blocks = extractHtmlBlocks(liveHtml);
              const afterIdx =
                typeof args.afterBlockIndex === 'number' ? Number(args.afterBlockIndex) : null;
              let nextHtml = liveHtml;
              if (afterIdx != null && blocks[afterIdx]) {
                const target = blocks[afterIdx].html;
                nextHtml = liveHtml.replace(target, `${target}${mathHtml}`);
              } else {
                nextHtml = `${liveHtml}${mathHtml}`;
              }
              nextHtml = ensureMathHosts(nextHtml);
              const id = `edit_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
              send({
                type: 'propose_edit',
                id,
                edit: {
                  title,
                  summary: args.summary || `Insertar ${display ? 'display' : 'inline'}: ${tex.slice(0, 50)}`,
                  mode: 'replace_document',
                  afterHtml: nextHtml,
                  beforeHtml: liveHtml,
                  changeList: [`+ ecuación ${display ? 'bloque' : 'inline'}`, tex.slice(0, 80)],
                },
              });
              liveHtml = nextHtml;
              slog.info('chat', 'tool.insert_equation', {
                display,
                tex: tex.slice(0, 100),
                afterBlockIndex: afterIdx,
              });
              send({
                type: 'tool_end',
                name,
                ok: true,
                label: 'Ecuación insertada (propuesta)',
                id: tid,
              });
              await reply({ ok: true, id, note: 'Pending Accept/Reject.' });
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

        // Only ask for a second model completion when the first call did not
        // answer at all. A proposal already has enough context to close with a
        // truthful local message, so avoid paying for another network round.
        if (!finalText) {
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
            ? 'I proposed canvas changes (ghost). Nothing applied yet: accept or reject each one.'
            : 'No pude completar la respuesta. ¿Lo intentamos de nuevo con más detalle?';
        }

        if (!streamedLive && finalText) {
          send({ type: 'text', delta: finalText });
        }

        slog.info('chat', 'request.done', {
          ms: Date.now() - t0,
          model: usedModel,
          proposedSomething,
          streamedLive,
          finalLen: finalText.length,
          mathSafeMode,
          finalEquations: listEquations(liveHtml).length,
        });
        send({ type: 'done', finalText, model: usedModel });
      } catch (e: any) {
        slog.error('chat', 'request.error', { ms: Date.now() - t0, err: e?.message || String(e) });
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
