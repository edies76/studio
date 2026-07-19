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
import { formatDocumentHtml, parseExplicitFormatRequest } from '@/lib/document-format';
import { buildDocumentIntelligence, buildDocsAgentSystem, parseWorkspaceCommand, type WorkspaceAgentContext } from '@/lib/docs-agent';
import { replaceTableCell } from '@/lib/table-tools';

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

function escapeAgentHtml(value: string) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
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

function isFastLaneQuestion(text: string, selectedText: string) {
  if (selectedText.trim() || text.length > 240) return false;
  return !/\b(documento|lienzo|hoja|p[áa]gina|texto|p[áa]rrafo|selecci[oó]n|ecuaci[oó]n|f[oó]rmula|tabla|imagen|estructura|esquema|outline|brief|norma|apa|ieee|mla|document|canvas|page|text|paragraph|selection|equation|formula|table|image|structure|cambia|cambiar|pon|aplica|formatea|edita|corrige|reescribe|escribe|redacta|genera|crea|inserta|elimina|borra|mueve|inspecciona|analiza|revisa|comprueba|valida|busca|encuentra|resume|deshaz|rehaz|undo|redo|format|change|apply|edit|rewrite|write|draft|generate|create|insert|delete|remove|move|fix|check|review|search|summarize)\b/i.test(text);
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
    workspaceContext,
  } = body as {
    messages: Msg[];
    documentHtml?: string;
    documentTitle?: string;
    paperSize?: string;
    selectedText?: string;
    model?: string;
    autoStart?: boolean;
    assignmentContext?: string;
    workspaceContext?: WorkspaceAgentContext;
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
      const toolStartedAt = new Map<string, number>();
      const toolDurations: Array<{ name: string; durationMs: number }> = [];
      const send = (ev: object) => {
        try {
          const event = ev as Record<string, unknown>;
          const id = typeof event.id === 'string' ? event.id : '';
          if (event.type === 'tool_start' && id) toolStartedAt.set(id, Date.now());
          if (event.type === 'tool_end' && id) {
            const started = toolStartedAt.get(id);
            if (started) {
              const durationMs = Date.now() - started;
              toolDurations.push({ name: String(event.name || 'unknown'), durationMs });
              toolStartedAt.delete(id);
              controller.enqueue(new TextEncoder().encode(encode({ ...event, durationMs })));
              return;
            }
          }
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

      // These are initialized after the fast lane. Simple answers must not pay
      // for document parsing before we even know whether the document matters.
      let liveHtml = '';
      let mathSafeMode = false;

      try {
        // Immediate first paint — real thinking signal
        send({ type: 'thinking', label: 'Pensando…' });

        const lastUser = [...(messages || [])]
          .reverse()
          .find((m) => m.role === 'user')
          ?.content || '';

        // Fast lane: no document HTML, no tool schema, no long conversation
        // history, no second completion. This is the path for greetings and
        // short informational questions where the canvas is irrelevant.
        if (isFastLaneQuestion(lastUser, selectedText)) {
          let quickText = '';
          let firstTokenMs: number | null = null;
          const quickModel = process.env.DEEPSEEK_FAST_MODEL || 'deepseek-chat';
          send({ type: 'status', label: 'Respondiendo rápido…' });
          try {
            const quickRes = await deepseekChat({
              apiKey,
              model: quickModel,
              messages: [
                {
                  role: 'system',
                  content: 'You are Docs Studio. Answer concisely in the user language. Maximum 3 short sentences. No tools, no document edits, no preamble.',
                },
                { role: 'user', content: lastUser },
              ],
              stream: true,
              temperature: 0.2,
              maxTokens: 192,
            });
            if (quickRes.ok && quickRes.body) {
              for await (const chunk of iterateOpenAiSse(quickRes.body)) {
                if (chunk.content) {
                  if (firstTokenMs == null) firstTokenMs = Date.now() - t0;
                  quickText += chunk.content;
                  send({ type: 'text', delta: chunk.content });
                }
              }
            }
          } catch (e: any) {
            slog.warn('chat', 'fast_path.error', { err: e?.message || String(e) });
          }
          if (!quickText.trim()) {
            quickText = 'No pude responder en este momento.';
            send({ type: 'text', delta: quickText });
          }
          const durationMs = Date.now() - t0;
          slog.info('chat', 'request.done', {
            ms: durationMs,
            model: quickModel,
            path: 'fast_answer',
            promptChars: lastUser.length,
            firstTokenMs,
            finalLen: quickText.length,
          });
          send({
            type: 'done',
            finalText: quickText,
            model: quickModel,
            durationMs,
            outcome: 'answer',
          });
          return;
        }

        // Working HTML copy for math-safe tools within this request
        liveHtml = ensureMathHosts(documentHtml || '');
        /** Special MATH-SAFE mode: active when doc has equations or user talks math */
        mathSafeMode = listEquations(liveHtml).length > 0;

        const snap0 = mathSafeSnapshot(liveHtml);
        const eqCount = snap0.equationCount;
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

        const documentIntelligence = buildDocumentIntelligence(liveHtml, selectedText);
        const system = buildDocsAgentSystem({
          documentTitle,
          paperSize,
          documentIntelligence,
          assignmentContext,
          workspaceContext,
          liveHtml,
        }) + `

=== SERVER MATH SAFETY ===
The server protects math hosts on every free HTML rewrite. If equations exist or the task mentions formulas, call list_equations before changing one. Use edit_equation for an existing formula and insert_equation for a new one. Keep studio-math/data-tex hosts intact in prose edits. TeX arguments have no surrounding delimiters.
=== END SPECIALIST CONTEXT ===
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

        // Clear atomic formatting commands are deterministic editor actions.
        // Resolve them locally so the agent cannot answer with a false
        // "CSS is unsupported" instead of creating the requested proposal.
        const explicitFormat = parseExplicitFormatRequest(lastUser);
        if (explicitFormat) {
          const scope = selectedText.trim() ? 'selection' : 'document';
          const beforeHtml = liveHtml;
          const formatted = formatDocumentHtml(beforeHtml, {
            ...explicitFormat,
            scope,
            selectedText,
          });
          if (formatted.changed) {
            const guarded = protectMathInRewrite(beforeHtml, formatted.html);
            const afterHtml = guarded.html;
            const id = `edit_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
            send({ type: 'status', label: scope === 'document' ? 'Formateando el documento…' : 'Formateando la selección…' });
            send({ type: 'tool_start', name: 'format_document', label: 'Aplicando formato…', id });
            send({
              type: 'propose_edit',
              id,
              edit: {
                title: 'Formato del documento',
                summary: 'Preparé el formato solicitado para que lo revises antes de aplicarlo.',
                mode: 'replace_document',
                afterHtml,
                beforeHtml,
                changeList: [
                  ...formatted.declarations.map((item) => item.replace(/:/, ': ')),
                  scope === 'document' ? 'Alcance: documento completo' : 'Alcance: selección',
                ],
              },
            });
            send({ type: 'tool_end', name: 'format_document', ok: true, label: 'Formato propuesto · aceptá para aplicarlo', id });
            const finalText = scope === 'document'
              ? 'Preparé el cambio de formato para todo el documento. Revisalo y aceptalo para aplicarlo; todavía no se ha modificado el lienzo.'
              : 'Preparé el cambio de formato para la selección. Revisalo y aceptalo para aplicarlo.';
            send({ type: 'text', delta: finalText });
            const durationMs = Date.now() - t0;
            slog.info('chat', 'request.done', {
              ms: durationMs,
              model: 'local-format-parser',
              path: 'explicit_format',
              proposedSomething: true,
              finalLen: finalText.length,
              declarations: formatted.declarations,
            });
            send({
              type: 'done',
              finalText,
              model: 'local-format-parser',
              durationMs,
              outcome: 'proposal',
            });
            return;
          }
        }

        const directWorkspaceCommand = parseWorkspaceCommand(lastUser);
        if (directWorkspaceCommand) {
          const durationMs = Date.now() - t0;
          const label = directWorkspaceCommand === 'undo' ? 'Deshaciendo el último cambio…' : 'Rehaciendo el cambio…';
          const finalText = directWorkspaceCommand === 'undo'
            ? 'Deshice el último cambio del workspace.'
            : 'Rehice el cambio del workspace.';
          send({ type: 'status', label });
          send({ type: 'tool_start', name: 'workspace_command', label, id: `workspace_${Date.now()}` });
          send({ type: 'workspace_command', command: directWorkspaceCommand });
          send({ type: 'tool_end', name: 'workspace_command', ok: true, label: directWorkspaceCommand === 'undo' ? 'Cambio deshecho' : 'Cambio rehecho' });
          send({ type: 'text', delta: finalText });
          send({ type: 'done', finalText, model: 'workspace-command', durationMs, outcome: 'answer' });
          return;
        }

        // Informational questions do not need the document editor's full tool
        // loop. Keeping them on a small, streamed path removes the tool-schema
        // payload and the extra completion that used to make a no-op feel slow.
        const actionRequest = /\b(cambia|cambiar|cambiale|cámbiale|pon|pone|ponle|ponla|ponlos|ponlas|aplica|aplicar|formatea|formatear|ajusta|ajustar|edita|editar|corrige|corregir|reescribe|reescribir|escribe|escribir|redacta|redactar|genera|generar|crea|crear|inserta|insertar|elimina|eliminar|borra|borrar|mueve|mover|inspecciona|inspeccionar|analiza|analizar|revisa|revisar|comprueba|comprobar|valida|validar|busca|buscar|encuentra|encontrar|resume|resumir|deshaz|deshacer|rehaz|rehacer|undo|redo|inspect|check|review|validate|search|summarize|resize|align|format|change|apply|edit|rewrite|write|draft|generate|create|insert|delete|remove|move|fix|set|color|colores|letra|tamaño|tamano|fuente|font|size|bold|italic|red|blue|green|black)\b/i.test(
          lastUser,
        );
        const documentQuestion = /\b(documento|lienzo|hoja|p[áa]gina|texto|p[áa]rrafo|selecci[oó]n|ecuaci[oó]n|f[oó]rmula|tabla|imagen|estructura|esquema|outline|brief|norma|apa|ieee|mla|document|canvas|page|text|paragraph|selection|equation|formula|table|image|structure)\b/i.test(
          lastUser,
        );

        if (!actionRequest && !documentQuestion) {
          const quickMessages: ChatMessage[] = [
            {
              role: 'system',
              content:
                'You are Docs Studio, a concise document assistant. Answer the user directly in their language. This is an informational question, so do not propose or claim document changes, do not call tools, and do not mention internal implementation unless asked. Use Markdown headings, lists, bold, and code when helpful.',
            },
            ...chatMessages.slice(1).slice(-6),
          ];
          let quickText = '';
          const quickModel = resolveModelId(preferredModel || DEFAULT_STUDIO_MODEL);
          send({ type: 'status', label: 'Respondiendo…' });
          try {
            const quickRes = await deepseekChat({
              apiKey,
              model: quickModel,
              messages: quickMessages,
              stream: true,
              temperature: 0.35,
              maxTokens: 640,
            });
            if (quickRes.ok && quickRes.body) {
              for await (const chunk of iterateOpenAiSse(quickRes.body)) {
                if (chunk.content) {
                  quickText += chunk.content;
                  send({ type: 'text', delta: chunk.content });
                }
              }
            } else {
              const errorBody = await quickRes.json().catch(() => ({}));
              slog.warn('chat', 'quick_path.failed', {
                status: quickRes.status,
                error: errorBody?.error?.message || quickRes.statusText,
              });
            }
          } catch (e: any) {
            slog.warn('chat', 'quick_path.error', { err: e?.message || String(e) });
          }
          if (!quickText.trim()) {
            quickText = 'No pude responder en este momento. Intentémoslo de nuevo.';
            send({ type: 'text', delta: quickText });
          }
          const durationMs = Date.now() - t0;
          slog.info('chat', 'request.done', {
            ms: durationMs,
            model: quickModel,
            path: 'quick_answer',
            proposedSomething: false,
            finalLen: quickText.length,
          });
          send({
            type: 'done',
            finalText: quickText,
            model: quickModel,
            durationMs,
            outcome: 'answer',
          });
          return;
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

        const proposeGeneratedDocument = (input: {
          title: string;
          summary: string;
          nextHtml: string;
          changeList: string[];
        }) => {
          const beforeHtml = liveHtml;
          const guarded = protectMathInRewrite(beforeHtml, input.nextHtml);
          if (guarded.restored > 0) mathSafeMode = true;
          const afterHtml = guarded.html;
          const id = `edit_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
          proposedSomething = true;
          liveHtml = afterHtml;
          send({
            type: 'propose_edit',
            id,
            edit: {
              title: input.title,
              summary: input.summary,
              mode: 'replace_document',
              afterHtml,
              beforeHtml,
              changeList: [
                ...input.changeList,
                ...(guarded.restored ? [`MATH-SAFE: restauradas ${guarded.restored} ecuación(es)`] : []),
              ],
            },
          });
          return { id, afterHtml };
        };

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

            if (name === 'inspect_document') {
              const tid = `idoc_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
              send({ type: 'tool_start', name, label: 'Analizando estructura…', id: tid });
              const intelligence = buildDocumentIntelligence(liveHtml, selectedText);
              send({
                type: 'tool_end',
                name,
                ok: true,
                label: `${intelligence.stats.blockCount} bloques · ${intelligence.stats.wordCount} palabras`,
                id: tid,
              });
              await reply({ ok: true, focus: args.focus || 'all', ...intelligence });
              continue;
            }

            if (name === 'find_in_document') {
              const tid = `find_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
              const query = String(args.query || '').trim();
              const needle = query.toLocaleLowerCase();
              const maxResults = Math.min(Math.max(Number(args.maxResults) || 10, 1), 30);
              send({ type: 'tool_start', name, label: `Buscando “${query.slice(0, 36)}”…`, id: tid });
              const matches = query
                ? extractHtmlBlocks(liveHtml)
                    .filter((block) => `${block.tag} ${block.preview} ${block.html}`.toLocaleLowerCase().includes(needle))
                    .slice(0, maxResults)
                    .map(({ index, tag, preview }) => ({ index, tag, preview }))
                : [];
              send({ type: 'tool_end', name, ok: Boolean(query), label: `${matches.length} coincidencia(s)`, id: tid });
              await reply({ ok: Boolean(query), query, matches, error: query ? undefined : 'query is required' });
              continue;
            }

            if (name === 'check_document') {
              const tid = `check_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
              send({ type: 'tool_start', name, label: 'Revisando el documento…', id: tid });
              const intelligence = buildDocumentIntelligence(liveHtml, selectedText);
              const issues: Array<{ code: string; severity: 'error' | 'warning'; message: string }> = [];
              if (intelligence.stats.wordCount === 0) issues.push({ code: 'empty', severity: 'error', message: 'El documento no tiene texto legible.' });
              if (!/<h1\b/i.test(liveHtml)) issues.push({ code: 'missing_h1', severity: 'warning', message: 'No encontré un encabezado H1.' });
              if (intelligence.media.missingAltCount > 0) issues.push({ code: 'image_alt', severity: 'warning', message: `${intelligence.media.missingAltCount} imagen(es) no tienen texto alternativo.` });
              if (intelligence.stats.tableCount > 0 && !/<th\b/i.test(liveHtml)) issues.push({ code: 'table_header', severity: 'warning', message: 'Hay tablas sin celdas de encabezado.' });
              const levels = intelligence.outline.map((heading) => heading.level);
              if (levels.some((level, index) => index > 0 && level - levels[index - 1] > 1)) issues.push({ code: 'heading_jump', severity: 'warning', message: 'La jerarquía de encabezados salta niveles.' });
              if ((workspaceContext?.pendingEdits || 0) > 0) issues.push({ code: 'pending_edits', severity: 'warning', message: 'Hay propuestas pendientes de revisión.' });
              send({ type: 'tool_end', name, ok: !issues.some((issue) => issue.severity === 'error'), label: `${issues.length} observación(es)`, id: tid });
              await reply({ ok: !issues.some((issue) => issue.severity === 'error'), focus: args.focus || 'all', issues, stats: intelligence.stats, outline: intelligence.outline });
              continue;
            }

            if (name === 'workspace_command') {
              const tid = `workspace_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
              const command = args.command === 'redo' ? 'redo' : args.command === 'undo' ? 'undo' : null;
              send({ type: 'tool_start', name, label: command === 'undo' ? 'Deshaciendo…' : command === 'redo' ? 'Rehaciendo…' : 'Comando inválido', id: tid });
              if (!command) {
                send({ type: 'tool_end', name, ok: false, label: 'Solo undo/redo', id: tid });
                await reply({ ok: false, error: 'command must be undo or redo' });
                continue;
              }
              send({ type: 'workspace_command', command });
              send({ type: 'tool_end', name, ok: true, label: command === 'undo' ? 'Cambio deshecho' : 'Cambio rehecho', id: tid });
              await reply({ ok: true, command });
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

            if (name === 'format_document') {
              const tid = `fmt_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
              const scope = ['document', 'selection', 'block'].includes(String(args.scope))
                ? String(args.scope)
                : 'document';
              const blockIndex = Number(args.blockIndex);
              const blocks = extractHtmlBlocks(liveHtml);
              const targetBlock = scope === 'block' && Number.isFinite(blockIndex)
                ? blocks[blockIndex]
                : undefined;
              send({
                type: 'status',
                label: scope === 'document' ? 'Formateando el documento…' : 'Formateando la selección…',
              });
              send({
                type: 'tool_start',
                name,
                label: 'Aplicando formato…',
                id: tid,
              });

              if (scope === 'block' && !targetBlock) {
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

              const beforeHtml = liveHtml;
              const formatted = formatDocumentHtml(beforeHtml, {
                scope: scope as 'document' | 'selection' | 'block',
                blockIndex,
                selectedText: targetBlock?.html || selectedText,
                fontSize: args.fontSize,
                color: args.color,
                backgroundColor: args.backgroundColor,
                fontFamily: args.fontFamily,
                fontWeight: args.fontWeight,
                fontStyle: args.fontStyle,
                textAlign: args.textAlign,
                lineHeight: args.lineHeight,
                letterSpacing: args.letterSpacing,
              });
              if (!formatted.changed) {
                send({
                  type: 'tool_end',
                  name,
                  ok: false,
                  label: 'No encontré un formato válido para aplicar',
                  id: tid,
                });
                await reply({ ok: false, error: 'No valid formatting values were provided.' });
                continue;
              }

              const guarded = protectMathInRewrite(beforeHtml, formatted.html);
              if (guarded.restored > 0) mathSafeMode = true;
              proposedSomething = true;
              const id = `edit_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
              const afterHtml = guarded.html;
              liveHtml = afterHtml;
              const changeList = [
                ...formatted.declarations.map((item) => item.replace(/:/, ': ')),
                scope === 'document'
                  ? 'Alcance: documento completo'
                  : scope === 'block'
                    ? `Alcance: bloque ${blockIndex}`
                    : 'Alcance: selección',
              ];
              send({
                type: 'propose_edit',
                id,
                edit: {
                  title: args.title || 'Formato del documento',
                  summary: args.summary || 'Se preparó el formato solicitado para revisión.',
                  mode: 'replace_document',
                  afterHtml,
                  beforeHtml,
                  changeList,
                },
              });
              send({
                type: 'tool_end',
                name,
                ok: true,
                label: 'Formato propuesto · aceptá para aplicarlo',
                id: tid,
              });
              await reply({ ok: true, id, declarations: formatted.declarations, note: 'Pending Accept/Reject.' });
              continue;
            }

            if (name === 'insert_table') {
              const tid = `table_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
              const rows = Math.min(Math.max(Math.floor(Number(args.rows) || 3), 1), 20);
              const columns = Math.min(Math.max(Math.floor(Number(args.columns) || 3), 1), 12);
              const hasHeader = args.hasHeader !== false;
              send({ type: 'tool_start', name, label: `Preparando tabla ${rows} × ${columns}…`, id: tid });
              const markup = Array.from({ length: rows }, (_, row) => {
                const cells = Array.from({ length: columns }, (_, column) => {
                  const tag = row === 0 && hasHeader ? 'th' : 'td';
                  const value = row === 0 && hasHeader ? `Columna ${column + 1}` : '&nbsp;';
                  return `<${tag}>${value}</${tag}>`;
                }).join('');
                return `<tr>${cells}</tr>`;
              }).join('');
              const caption = typeof args.caption === 'string' && args.caption.trim() ? `<caption>${escapeAgentHtml(args.caption.trim())}</caption>` : '';
              const fragment = `<table class="studio-table">${caption}<tbody>${markup}</tbody></table><p><br></p>`;
              const blocks = extractHtmlBlocks(liveHtml);
              const afterBlockIndex = Number(args.afterBlockIndex);
              const target = Number.isFinite(afterBlockIndex) ? blocks[afterBlockIndex] : undefined;
              const nextHtml = target ? liveHtml.replace(target.html, `${target.html}${fragment}`) : `${liveHtml}${fragment}`;
              const proposal = proposeGeneratedDocument({
                title: args.title || 'Insertar tabla',
                summary: args.summary || `Preparé una tabla editable de ${rows} filas por ${columns} columnas.`,
                nextHtml,
                changeList: [`Tabla ${rows} × ${columns}`, target ? `Después del bloque ${afterBlockIndex}` : 'Al final del documento'],
              });
              send({ type: 'tool_end', name, ok: true, label: 'Tabla propuesta · aceptá para insertarla', id: tid });
              await reply({ ok: true, id: proposal.id, rows, columns, note: 'Pending user Accept/Reject.' });
              continue;
            }

            if (name === 'edit_table_cell') {
              const tid = `table_cell_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
              const tableIndex = Math.floor(Number(args.tableIndex));
              const rowIndex = Math.floor(Number(args.rowIndex));
              const columnIndex = Math.floor(Number(args.columnIndex));
              const content = String(args.content || '').trim();
              send({ type: 'tool_start', name, label: `Editando celda ${rowIndex + 1}:${columnIndex + 1}…`, id: tid });
              const changed = replaceTableCell(liveHtml, { tableIndex, rowIndex, columnIndex, content });
              if (!changed) {
                send({ type: 'tool_end', name, ok: false, label: 'No encontré esa celda', id: tid });
                await reply({ ok: false, error: 'tableIndex, rowIndex or columnIndex is out of range' });
                continue;
              }
              const proposal = proposeGeneratedDocument({
                title: args.title || `Editar celda ${rowIndex + 1}:${columnIndex + 1}`,
                summary: args.summary || 'Preparé un cambio localizado en una sola celda.',
                nextHtml: changed.html,
                changeList: [`Tabla ${tableIndex + 1}`, `Fila ${rowIndex + 1}`, `Columna ${columnIndex + 1}`],
              });
              send({ type: 'tool_end', name, ok: true, label: 'Celda propuesta · aceptá para aplicarla', id: tid });
              await reply({ ok: true, id: proposal.id, previous: changed.previousHtml, note: 'Pending user Accept/Reject.' });
              continue;
            }

            if (name === 'insert_page_break') {
              const tid = `break_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
              send({ type: 'tool_start', name, label: 'Preparando salto de página…', id: tid });
              const nextHtml = `${liveHtml}<div data-studio-break="1" style="break-before:page;page-break-before:always"></div><p><br></p>`;
              const proposal = proposeGeneratedDocument({
                title: 'Insertar salto de página',
                summary: 'Preparé un salto de página que conserva el lienzo y la exportación.',
                nextHtml,
                changeList: ['Salto de página al final del documento'],
              });
              send({ type: 'tool_end', name, ok: true, label: 'Salto propuesto · aceptá para insertarlo', id: tid });
              await reply({ ok: true, id: proposal.id, note: 'Pending user Accept/Reject.' });
              continue;
            }

            if (name === 'insert_image') {
              const tid = `image_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
              const src = String(args.src || '').trim();
              const wrap = ['inline', 'left', 'right', 'center', 'break', 'behind'].includes(args.wrap) ? args.wrap : 'break';
              send({ type: 'tool_start', name, label: 'Preparando imagen…', id: tid });
              if (!/^(https?:\/\/|data:image\/)/i.test(src)) {
                send({ type: 'tool_end', name, ok: false, label: 'La imagen debe ser HTTPS o data:image', id: tid });
                await reply({ ok: false, error: 'src must be an https URL or a data:image URL' });
                continue;
              }
              const width = Math.min(Math.max(Number(args.width) || 640, 40), 2400);
              const alt = escapeAgentHtml(String(args.alt || 'Imagen insertada'));
              const safeSrc = escapeAgentHtml(src);
              const alignment = wrap === 'center' ? 'margin:0.85em auto' : wrap === 'left' ? 'margin:0.25em 1.1em 0.6em 0' : wrap === 'right' ? 'margin:0.25em 0 0.6em 1.1em' : wrap === 'inline' ? 'margin:0 0.3em' : 'margin:0.85em 0';
              const position = wrap === 'behind' ? `position:absolute;left:${Math.max(0, Number(args.left) || 0)}px;top:${Math.max(0, Number(args.top) || 0)}px;z-index:0;margin:0` : '';
              const image = `<p><img src="${safeSrc}" alt="${alt}" data-studio-image="1" data-studio-wrap="${wrap}" style="width:${width}px;max-width:100%;height:auto;display:${wrap === 'inline' ? 'inline-block' : 'block'};${alignment};${position}"></p>`;
              const proposal = proposeGeneratedDocument({
                title: 'Insertar imagen',
                summary: 'Preparé la imagen con texto alternativo, tamaño y modo de incrustación explícitos.',
                nextHtml: `${liveHtml}${image}<p><br></p>`,
                changeList: [`Ancho: ${width}px`, `Modo: ${wrap}`, `Alt: ${String(args.alt || 'Imagen insertada').slice(0, 80)}`],
              });
              send({ type: 'tool_end', name, ok: true, label: 'Imagen propuesta · aceptá para insertarla', id: tid });
              await reply({ ok: true, id: proposal.id, width, wrap, note: 'Pending user Accept/Reject.' });
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

        // A proposal benefits from a short model-written closing message. For
        // a no-op/non-proposal, return the local truthful fallback immediately
        // instead of paying for another model round.
        if (!finalText && proposedSomething) {
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
        send({
          type: 'done',
          finalText,
          model: usedModel,
          durationMs: Date.now() - t0,
          toolDurations,
          outcome: proposedSomething ? 'proposal' : 'answer',
        });
      } catch (e: any) {
        slog.error('chat', 'request.error', { ms: Date.now() - t0, err: e?.message || String(e) });
        send({ type: 'error', message: e?.message || 'Chat failed' });
        send({ type: 'done', durationMs: Date.now() - t0, outcome: 'error' });
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
