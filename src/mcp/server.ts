import { McpServer, ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import {
  callDocsStudioApi,
  createAssignmentContext,
  docsWorkspace,
  publicDocument,
  readSse,
  stripMarkdownFences,
} from './core';
import { documentPdf } from './pdf';

const SERVER_VERSION = '0.1.0';
const REPO_URL = 'https://github.com/edies76/docs-studio';

function jsonResult(value: unknown) {
  return {
    content: [{ type: 'text' as const, text: JSON.stringify(value, null, 2) }],
  };
}

function errorResult(error: unknown) {
  return {
    isError: true,
    content: [{ type: 'text' as const, text: error instanceof Error ? error.message : String(error) }],
  };
}

async function safe<T>(work: () => Promise<T> | T) {
  try {
    return jsonResult(await work());
  } catch (error) {
    return errorResult(error);
  }
}

export function createDocsStudioMcpServer() {
  const server = new McpServer(
    { name: 'docs-studio', version: SERVER_VERSION },
    { capabilities: { logging: {} } },
  );

  server.registerTool('get_capabilities', {
    title: 'Docs Studio capabilities',
    description: 'Return the capabilities and session model of this Docs Studio MCP server.',
  }, async () => jsonResult({
    name: 'Docs Studio MCP',
    version: SERVER_VERSION,
    repository: REPO_URL,
    workspace: 'In-memory per MCP process. A document is not automatically the browser tab until a future session bridge is connected.',
    tools: [
      'create_document', 'list_documents', 'read_document', 'parse_brief', 'draft_document', 'chat_document',
      'propose_edit', 'accept_edit', 'reject_edit', 'insert_math', 'insert_table', 'get_history', 'export_document',
    ],
    resources: ['docs://workspace', 'docs://document/{documentId}', 'docs://history/{documentId}'],
    transports: ['stdio', 'streamable-http'],
  }));

  server.registerTool('create_document', {
    title: 'Create document',
    description: 'Create a blank document or seed one with HTML. Use draft_document for an AI-generated first draft.',
    inputSchema: {
      title: z.string().optional(),
      html: z.string().optional(),
      paperSize: z.enum(['letter', 'legal', 'a4']).optional(),
    },
  }, async ({ title, html, paperSize }) => safe(() => publicDocument(docsWorkspace.createDocument({ title, html, paperSize }))));

  server.registerTool('list_documents', {
    title: 'List documents',
    description: 'List the documents in the current MCP workspace.',
  }, async () => jsonResult(docsWorkspace.listDocuments()));

  server.registerTool('read_document', {
    title: 'Read document',
    description: 'Read current HTML, plain text, block indexes, pending proposals, and assignment context.',
    inputSchema: { documentId: z.string() },
  }, async ({ documentId }) => safe(() => docsWorkspace.readDocument(documentId)));

  server.registerTool('parse_brief', {
    title: 'Parse assignment brief',
    description: 'Extract tasks, objectives, constraints, learning outcome, and rubric weights from a university or professional brief.',
    inputSchema: {
      text: z.string().min(20),
      fileName: z.string().optional(),
      documentId: z.string().optional(),
    },
  }, async ({ text, fileName, documentId }) => safe(async () => {
    const brief = await docsWorkspace.parseBrief(text, fileName);
    if (documentId) docsWorkspace.setBrief(documentId, brief);
    return brief;
  }));

  server.registerTool('draft_document', {
    title: 'Draft document',
    description: 'Run the same Docs Studio streaming draft endpoint used by the web app, then apply the returned HTML to a document.',
    inputSchema: {
      documentId: z.string(),
      prompt: z.string().min(1),
      language: z.string().optional(),
      model: z.string().optional(),
    },
  }, async ({ documentId, prompt, language, model }) => safe(async () => {
    const document = docsWorkspace.getDocument(documentId);
    const response = await callDocsStudioApi('/api/draft', { prompt, language, model });
    const events = await readSse(response);
    const error = events.find((event) => event.type === 'error');
    const ready = events.find((event) => event.type === 'html_ready');
    const streamed = events.filter((event) => event.type === 'html_delta').map((event) => event.delta || '').join('');
    if (error && !ready && !streamed) throw new Error(error.message || 'Draft failed');
    const html = stripMarkdownFences(ready?.html || streamed);
    if (!html) throw new Error('Docs Studio returned an empty draft');
    return docsWorkspace.replaceContent(document.id, html, 'drafted', `Drafted with ${ready?.model || model || 'Docs Studio'}`);
  }));

  server.registerTool('chat_document', {
    title: 'Chat with document',
    description: 'Send a request through the existing document copilot. AI edits remain pending until accept_edit is called.',
    inputSchema: {
      documentId: z.string(),
      message: z.string().min(1),
      selectedText: z.string().optional(),
      model: z.string().optional(),
    },
  }, async ({ documentId, message, selectedText, model }) => safe(async () => {
    const document = docsWorkspace.getDocument(documentId);
    const response = await callDocsStudioApi('/api/chat', {
      messages: [{ role: 'user', content: message }],
      documentHtml: document.html,
      documentTitle: document.title,
      paperSize: document.paperSize,
      selectedText: selectedText || '',
      model,
      autoStart: false,
      assignmentContext: createAssignmentContext(document.brief),
    });
    const events = await readSse(response);
    const proposals: string[] = [];
    for (const event of events.filter((item) => item.type === 'propose_edit')) {
      const edit = event.edit || {};
      const proposal = docsWorkspace.proposeEdit({
        documentId,
        title: edit.title || 'Document change',
        summary: edit.summary || 'Change proposed by Studio copilot',
        mode: edit.mode || 'replace_document',
        beforeHtml: edit.beforeHtml ?? (edit.mode === 'replace_document' ? document.html : selectedText || ''),
        afterHtml: edit.afterHtml || '',
        selectionHint: edit.selectionHint,
      });
      proposals.push(proposal.id);
    }
    const text = events.filter((event) => event.type === 'text').map((event) => event.delta || '').join('');
    const done = events.find((event) => event.type === 'done');
    return { message: text || done?.finalText || '', proposalIds: proposals, documentId };
  }));

  server.registerTool('propose_edit', {
    title: 'Propose edit',
    description: 'Create a reviewable red/green-style proposal. It does not mutate the document until accept_edit is called.',
    inputSchema: {
      documentId: z.string(),
      title: z.string(),
      summary: z.string(),
      mode: z.enum(['replace_document', 'replace_selection', 'replace_block']).default('replace_document'),
      beforeHtml: z.string().optional(),
      afterHtml: z.string().min(1),
      selectionHint: z.string().optional(),
    },
  }, async ({ documentId, title, summary, mode, beforeHtml, afterHtml, selectionHint }) => safe(() => {
    const document = docsWorkspace.getDocument(documentId);
    return docsWorkspace.proposeEdit({
      documentId,
      title,
      summary,
      mode,
      beforeHtml: beforeHtml ?? (mode === 'replace_document' ? document.html : ''),
      afterHtml,
      selectionHint,
    });
  }));

  server.registerTool('accept_edit', {
    title: 'Accept edit',
    description: 'Apply a pending proposal after verifying the document has not changed underneath it.',
    inputSchema: { documentId: z.string(), editId: z.string() },
  }, async ({ documentId, editId }) => safe(() => docsWorkspace.acceptEdit(documentId, editId)));

  server.registerTool('reject_edit', {
    title: 'Reject edit',
    description: 'Reject a pending proposal without changing document content.',
    inputSchema: { documentId: z.string(), editId: z.string() },
  }, async ({ documentId, editId }) => safe(() => docsWorkspace.rejectEdit(documentId, editId)));

  server.registerTool('insert_math', {
    title: 'Insert equation',
    description: 'Insert an editable MathJax equation into the document.',
    inputSchema: { documentId: z.string(), tex: z.string().min(1), display: z.boolean().optional() },
  }, async ({ documentId, tex, display }) => safe(() => docsWorkspace.insertMath(documentId, tex, display)));

  server.registerTool('insert_table', {
    title: 'Insert table',
    description: 'Insert an editable HTML table with a header row.',
    inputSchema: {
      documentId: z.string(),
      rows: z.number().int().min(1).max(20).optional(),
      columns: z.number().int().min(1).max(12).optional(),
    },
  }, async ({ documentId, rows, columns }) => safe(() => docsWorkspace.insertTable(documentId, rows, columns)));

  server.registerTool('get_history', {
    title: 'Get document history',
    description: 'Read the last document events, including proposals and review decisions.',
    inputSchema: { documentId: z.string() },
  }, async ({ documentId }) => safe(() => docsWorkspace.history(documentId)));

  server.registerTool('export_document', {
    title: 'Export document',
    description: 'Export the current document as HTML, a server-generated DOCX, or a text-layout PDF. Binary formats return base64.',
    inputSchema: {
      documentId: z.string(),
      format: z.enum(['html', 'docx', 'pdf']),
    },
  }, async ({ documentId, format }) => safe(async () => {
    const document = docsWorkspace.getDocument(documentId);
    const safeTitle = document.title.replace(/[^\w\- ]+/g, '').trim() || 'docs-studio';
    if (format === 'html') {
      return { format, fileName: `${safeTitle}.html`, mimeType: 'text/html', content: document.html };
    }
    if (format === 'pdf') {
      const buffer = documentPdf(document.html, document.title, document.paperSize);
      return { format, fileName: `${safeTitle}.pdf`, mimeType: 'application/pdf', base64: buffer.toString('base64') };
    }
    const response = await callDocsStudioApi('/api/export-docx', { html: document.html, title: document.title });
    if (!response.ok) throw new Error(`DOCX export failed: ${response.status}`);
    const buffer = Buffer.from(await response.arrayBuffer());
    return {
      format,
      fileName: `${safeTitle}.docx`,
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      base64: buffer.toString('base64'),
    };
  }));

  server.registerResource('workspace', 'docs://workspace', {
    title: 'Docs Studio workspace',
    description: 'Documents currently held by this MCP process.',
    mimeType: 'application/json',
  }, async (uri) => ({ contents: [{ uri: uri.href, mimeType: 'application/json', text: JSON.stringify({ documents: docsWorkspace.listDocuments() }, null, 2) }] }));

  server.registerResource('document', new ResourceTemplate('docs://document/{documentId}', { list: undefined }), {
    title: 'Docs Studio document',
    description: 'A document with its HTML, text, blocks, brief, and pending proposals.',
    mimeType: 'application/json',
  }, async (uri, variables) => {
    const documentId = String(variables.documentId || '');
    return { contents: [{ uri: uri.href, mimeType: 'application/json', text: JSON.stringify(docsWorkspace.readDocument(documentId), null, 2) }] };
  });

  server.registerResource('history', new ResourceTemplate('docs://history/{documentId}', { list: undefined }), {
    title: 'Docs Studio history',
    description: 'Recent document events for review and audit.',
    mimeType: 'application/json',
  }, async (uri, variables) => {
    const documentId = String(variables.documentId || '');
    return { contents: [{ uri: uri.href, mimeType: 'application/json', text: JSON.stringify(docsWorkspace.history(documentId), null, 2) }] };
  });

  server.registerPrompt('draft_from_brief', {
    title: 'Draft from brief',
    description: 'Ask an AI client to turn a parsed assignment into a complete first draft.',
    argsSchema: { documentId: z.string(), focus: z.string().optional() },
  }, async ({ documentId, focus }) => ({
    messages: [{
      role: 'user',
      content: { type: 'text', text: `Read document ${documentId}. Draft it from the attached brief. ${focus || 'Cover every required task, preserve the requested language, and keep the structure easy to review.'}` },
    }],
  }));

  server.registerPrompt('review_document', {
    title: 'Review document',
    description: 'Ask an AI client to inspect blocks before proposing targeted edits.',
    argsSchema: { documentId: z.string(), criteria: z.string().optional() },
  }, async ({ documentId, criteria }) => ({
    messages: [{ role: 'user', content: { type: 'text', text: `Read document ${documentId}, then review it against ${criteria || 'clarity, completeness, language, and the attached brief'}. Propose targeted edits only; do not claim changes are applied.` } }],
  }));

  server.registerPrompt('prepare_export', {
    title: 'Prepare export',
    description: 'Ask an AI client to check a document before export.',
    argsSchema: { documentId: z.string(), format: z.enum(['docx', 'pdf']).optional() },
  }, async ({ documentId, format }) => ({
    messages: [{ role: 'user', content: { type: 'text', text: `Read document ${documentId}. Check headings, tables, equations, and required tasks before exporting as ${format || 'docx'}. Report issues first; only propose fixes that need review.` } }],
  }));

  return server;
}

async function main() {
  const server = createDocsStudioMcpServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

if (process.argv[1]?.endsWith('server.ts') || process.argv[1]?.endsWith('server.js')) {
  void main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
