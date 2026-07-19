import { McpServer, ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { createAssignmentContext, callDocsStudioApi, readSse, stripMarkdownFences } from './core';
import { documentPdf } from './pdf';
import { CloudDocsStudioWorkspace, publicCloudDocument } from './cloud-workspace';

const SERVER_VERSION = '0.2.0';
const REPO_URL = 'https://github.com/edies76/docs-studio';

function jsonResult(value: unknown) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(value, null, 2) }] };
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

function safeMode(mode: unknown): 'replace_document' | 'replace_selection' | 'replace_block' {
  return mode === 'replace_document' || mode === 'replace_block' ? mode : 'replace_selection';
}

export function createCloudDocsStudioMcpServer(options: {
  userId: string;
  apiBaseUrl: string;
}) {
  const workspace = new CloudDocsStudioWorkspace(options.userId);
  const server = new McpServer(
    { name: 'docs-studio-cloud', version: SERVER_VERSION },
    { capabilities: { logging: {} } },
  );

  server.registerTool('get_capabilities', {
    title: 'Docs Studio capabilities',
    description: 'Describe the remote Docs Studio MCP contract and its review boundary.',
  }, async () => jsonResult({
    name: 'Docs Studio MCP',
    version: SERVER_VERSION,
    repository: REPO_URL,
    workspace: 'Persistent and isolated by authenticated MCP principal. Documents are stored through the Docs Studio document store.',
    editing: 'AI can inspect, search, validate, draft, propose, accept, reject, insert, format, and export. Reviewable edits remain pending until accepted.',
    tools: [
      'get_capabilities', 'create_document', 'list_documents', 'delete_document', 'read_document', 'find_in_document', 'check_document',
      'parse_brief', 'draft_document', 'chat_document', 'propose_edit', 'accept_edit', 'reject_edit', 'update_title', 'set_paper_size',
      'insert_html', 'insert_math', 'insert_table', 'edit_table_cell', 'insert_image', 'insert_page_break', 'get_history', 'list_versions', 'restore_version', 'export_document',
    ],
    resources: ['docs://workspace', 'docs://document/{documentId}', 'docs://history/{documentId}'],
    transports: ['streamable-http'],
  }));

  server.registerTool('create_document', {
    title: 'Create document',
    description: 'Create a blank Letter or Legal document, optionally seeded with sanitized HTML.',
    inputSchema: {
      title: z.string().optional(),
      html: z.string().optional(),
      paperSize: z.enum(['letter', 'legal', 'a4']).optional(),
    },
  }, async ({ title, html, paperSize }) => safe(() => workspace.createDocument({ title, html, paperSize })));

  server.registerTool('list_documents', {
    title: 'List documents',
    description: 'List the authenticated principal’s documents from persistent storage.',
  }, async () => safe(() => workspace.listDocuments()));

  server.registerTool('delete_document', {
    title: 'Delete document',
    description: 'Permanently delete one document. Requires explicit confirmation.',
    inputSchema: { documentId: z.string(), confirm: z.boolean() },
  }, async ({ documentId, confirm }) => safe(async () => {
    if (!confirm) throw new Error('Set confirm=true to delete this document.');
    return workspace.deleteDocument(documentId);
  }));

  server.registerTool('read_document', {
    title: 'Read document',
    description: 'Return current HTML, text, word count, numbered blocks, brief context, and pending proposals.',
    inputSchema: { documentId: z.string() },
  }, async ({ documentId }) => safe(() => workspace.readDocument(documentId)));

  server.registerTool('find_in_document', {
    title: 'Find in document',
    description: 'Search the current document and return matching block indexes before targeted editing.',
    inputSchema: { documentId: z.string(), query: z.string().min(1), maxResults: z.number().int().min(1).max(100).optional() },
  }, async ({ documentId, query, maxResults }) => safe(() => workspace.findInDocument(documentId, query, maxResults)));

  server.registerTool('check_document', {
    title: 'Check document',
    description: 'Run deterministic checks for readable content, headings, image alt text, table headers, and pending proposals.',
    inputSchema: { documentId: z.string() },
  }, async ({ documentId }) => safe(() => workspace.checkDocument(documentId)));

  server.registerTool('parse_brief', {
    title: 'Parse assignment brief',
    description: 'Extract tasks, objectives, constraints, learning outcome, and rubric weights, then optionally attach the result.',
    inputSchema: {
      text: z.string().min(20),
      fileName: z.string().optional(),
      documentId: z.string().optional(),
    },
  }, async ({ text, fileName, documentId }) => safe(async () => {
    const brief = await workspace.parseBrief(text, fileName);
    if (documentId) await workspace.setBrief(documentId, brief);
    return brief;
  }));

  server.registerTool('draft_document', {
    title: 'Draft document',
    description: 'Run the same Docs Studio draft endpoint used by the web app and apply the returned HTML as the first draft.',
    inputSchema: {
      documentId: z.string(),
      prompt: z.string().min(1),
      language: z.string().optional(),
      model: z.string().optional(),
    },
  }, async ({ documentId, prompt, language, model }) => safe(async () => {
    const document = await workspace.getDocument(documentId);
    const response = await callDocsStudioApi('/api/draft', { prompt, language, model }, options.apiBaseUrl);
    const events = await readSse(response);
    const error = events.find((event) => event.type === 'error');
    const ready = events.find((event) => event.type === 'html_ready');
    const streamed = events.filter((event) => event.type === 'html_delta').map((event) => event.delta || '').join('');
    if (error && !ready && !streamed) throw new Error(error.message || 'Draft failed');
    const html = stripMarkdownFences(ready?.html || streamed);
    if (!html) throw new Error('Docs Studio returned an empty draft');
    return workspace.replaceContent(document.id, html, 'drafted', `Drafted with ${ready?.model || model || 'Docs Studio'}`);
  }));

  server.registerTool('chat_document', {
    title: 'Chat with document',
    description: 'Use the Docs Studio copilot. Any AI edit returned by the copilot becomes a persistent proposal until accepted or rejected.',
    inputSchema: {
      documentId: z.string(),
      message: z.string().min(1),
      selectedText: z.string().optional(),
      model: z.string().optional(),
    },
  }, async ({ documentId, message, selectedText, model }) => safe(async () => {
    const document = await workspace.getDocument(documentId);
    const response = await callDocsStudioApi('/api/chat', {
      messages: [{ role: 'user', content: message }],
      documentHtml: document.html,
      documentTitle: document.title,
      paperSize: document.paperSize,
      selectedText: selectedText || '',
      model,
      autoStart: false,
      assignmentContext: createAssignmentContext(document.brief),
    }, options.apiBaseUrl);
    const events = await readSse(response);
    const proposals: string[] = [];
    for (const event of events.filter((item) => item.type === 'propose_edit')) {
      const edit = event.edit || {};
      const mode = safeMode(edit.mode);
      const proposal = await workspace.proposeEdit({
        documentId,
        title: edit.title || 'Document change',
        summary: edit.summary || 'Change proposed by Studio copilot',
        mode,
        beforeHtml: edit.beforeHtml ?? (mode === 'replace_document' ? document.html : selectedText || ''),
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
    description: 'Create a reviewable edit. It does not mutate the document until accept_edit is called.',
    inputSchema: {
      documentId: z.string(),
      title: z.string(),
      summary: z.string(),
      mode: z.enum(['replace_document', 'replace_selection', 'replace_block']).default('replace_document'),
      beforeHtml: z.string().optional(),
      afterHtml: z.string().min(1),
      selectionHint: z.string().optional(),
    },
  }, async ({ documentId, title, summary, mode, beforeHtml, afterHtml, selectionHint }) => safe(async () => {
    const document = await workspace.getDocument(documentId);
    return workspace.proposeEdit({
      documentId, title, summary, mode,
      beforeHtml: beforeHtml ?? (mode === 'replace_document' ? document.html : ''),
      afterHtml, selectionHint,
    });
  }));

  server.registerTool('accept_edit', {
    title: 'Accept edit',
    description: 'Apply a pending proposal only if its source content is still present.',
    inputSchema: { documentId: z.string(), editId: z.string() },
  }, async ({ documentId, editId }) => safe(() => workspace.acceptEdit(documentId, editId)));

  server.registerTool('reject_edit', {
    title: 'Reject edit',
    description: 'Close a pending proposal without changing document content.',
    inputSchema: { documentId: z.string(), editId: z.string() },
  }, async ({ documentId, editId }) => safe(() => workspace.rejectEdit(documentId, editId)));

  server.registerTool('update_title', {
    title: 'Update title',
    description: 'Rename a document and record the change in its audit history.',
    inputSchema: { documentId: z.string(), title: z.string().min(1).max(160) },
  }, async ({ documentId, title }) => safe(() => workspace.updateTitle(documentId, title)));

  server.registerTool('set_paper_size', {
    title: 'Set paper size',
    description: 'Set the document canvas/export size to Letter or Legal.',
    inputSchema: { documentId: z.string(), paperSize: z.enum(['letter', 'legal', 'a4']) },
  }, async ({ documentId, paperSize }) => safe(() => workspace.setPaperSize(documentId, paperSize)));

  server.registerTool('insert_html', {
    title: 'Insert HTML',
    description: 'Append a sanitized HTML fragment directly. Use propose_edit when the change needs human review.',
    inputSchema: { documentId: z.string(), html: z.string().min(1) },
  }, async ({ documentId, html }) => safe(() => workspace.insertHtml(documentId, html)));

  server.registerTool('insert_math', {
    title: 'Insert equation',
    description: 'Insert an editable MathJax equation, inline or display.',
    inputSchema: { documentId: z.string(), tex: z.string().min(1), display: z.boolean().optional() },
  }, async ({ documentId, tex, display }) => safe(() => workspace.insertMath(documentId, tex, display)));

  server.registerTool('insert_table', {
    title: 'Insert table',
    description: 'Insert an editable HTML table with a header row.',
    inputSchema: {
      documentId: z.string(),
      rows: z.number().int().min(1).max(20).optional(),
      columns: z.number().int().min(1).max(12).optional(),
    },
  }, async ({ documentId, rows, columns }) => safe(() => workspace.insertTable(documentId, rows, columns)));

  server.registerTool('edit_table_cell', {
    title: 'Edit table cell',
    description: 'Change exactly one cell in an existing table and persist the operation as a separate document version.',
    inputSchema: {
      documentId: z.string(),
      tableIndex: z.number().int().min(0),
      rowIndex: z.number().int().min(0),
      columnIndex: z.number().int().min(0),
      content: z.string(),
    },
  }, async ({ documentId, tableIndex, rowIndex, columnIndex, content }) => safe(() => workspace.editTableCell(documentId, { tableIndex, rowIndex, columnIndex, content })));

  server.registerTool('insert_image', {
    title: 'Insert image',
    description: 'Insert an HTTPS or data image with width and Word-like wrap mode: inline, left, right, center, break, or behind.',
    inputSchema: {
      documentId: z.string(),
      src: z.string().min(1),
      alt: z.string().optional(),
      width: z.number().min(40).max(2400).optional(),
      wrap: z.enum(['inline', 'left', 'right', 'center', 'break', 'behind']).optional(),
      left: z.number().min(0).max(3000).optional(),
      top: z.number().min(0).max(5000).optional(),
    },
  }, async ({ documentId, src, alt, width, wrap, left, top }) => safe(() => workspace.insertImage(documentId, { src, alt, width, wrap, left, top })));

  server.registerTool('insert_page_break', {
    title: 'Insert page break',
    description: 'Insert a page break that survives the document HTML and export pipeline.',
    inputSchema: { documentId: z.string() },
  }, async ({ documentId }) => safe(() => workspace.insertPageBreak(documentId)));

  server.registerTool('get_history', {
    title: 'Get document history',
    description: 'Read recent document events, including proposals and review decisions.',
    inputSchema: { documentId: z.string() },
  }, async ({ documentId }) => safe(() => workspace.history(documentId)));

  server.registerTool('list_versions', {
    title: 'List safe versions',
    description: 'List persistent HTML snapshots created by accepted or inserted changes. Each snapshot is independently restorable.',
    inputSchema: { documentId: z.string() },
  }, async ({ documentId }) => safe(() => workspace.versions(documentId)));

  server.registerTool('restore_version', {
    title: 'Restore safe version',
    description: 'Restore one persistent snapshot and record the restoration as a new version.',
    inputSchema: { documentId: z.string(), versionId: z.string() },
  }, async ({ documentId, versionId }) => safe(() => workspace.restoreVersion(documentId, versionId)));

  server.registerTool('export_document', {
    title: 'Export document',
    description: 'Export HTML, server-generated DOCX, or PDF. Binary formats return base64.',
    inputSchema: { documentId: z.string(), format: z.enum(['html', 'docx', 'pdf']) },
  }, async ({ documentId, format }) => safe(async () => {
    const document = await workspace.getDocument(documentId);
    const safeTitle = document.title.replace(/[^\w\- ]+/g, '').trim() || 'docs-studio';
    if (format === 'html') return { format, fileName: `${safeTitle}.html`, mimeType: 'text/html', content: document.html };
    if (format === 'pdf') {
      const buffer = documentPdf(document.html, document.title, document.paperSize);
      return { format, fileName: `${safeTitle}.pdf`, mimeType: 'application/pdf', base64: buffer.toString('base64') };
    }
    const response = await callDocsStudioApi('/api/export-docx', { html: document.html, title: document.title }, options.apiBaseUrl);
    if (!response.ok) throw new Error(`DOCX export failed: ${response.status}`);
    const buffer = Buffer.from(await response.arrayBuffer());
    return { format, fileName: `${safeTitle}.docx`, mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', base64: buffer.toString('base64') };
  }));

  server.registerResource('workspace', 'docs://workspace', {
    title: 'Docs Studio workspace',
    description: 'Persistent documents for the authenticated MCP principal.',
    mimeType: 'application/json',
  }, async (uri) => ({ contents: [{ uri: uri.href, mimeType: 'application/json', text: JSON.stringify({ documents: await workspace.listDocuments() }, null, 2) }] }));

  server.registerResource('document', new ResourceTemplate('docs://document/{documentId}', { list: undefined }), {
    title: 'Docs Studio document',
    description: 'A document with HTML, text, blocks, brief, and pending proposals.',
    mimeType: 'application/json',
  }, async (uri, variables) => {
    const documentId = String(variables.documentId || '');
    return { contents: [{ uri: uri.href, mimeType: 'application/json', text: JSON.stringify(await workspace.readDocument(documentId), null, 2) }] };
  });

  server.registerResource('history', new ResourceTemplate('docs://history/{documentId}', { list: undefined }), {
    title: 'Docs Studio history',
    description: 'Recent document events for review and audit.',
    mimeType: 'application/json',
  }, async (uri, variables) => {
    const documentId = String(variables.documentId || '');
    return { contents: [{ uri: uri.href, mimeType: 'application/json', text: JSON.stringify(await workspace.history(documentId), null, 2) }] };
  });

  server.registerPrompt('draft_from_brief', {
    title: 'Draft from brief',
    description: 'Read a parsed brief and draft a complete first version.',
    argsSchema: { documentId: z.string(), focus: z.string().optional() },
  }, async ({ documentId, focus }) => ({ messages: [{ role: 'user', content: { type: 'text', text: `Read document ${documentId}. Draft it from the attached brief. ${focus || 'Cover every required task and preserve the brief language.'}` } }] }));

  server.registerPrompt('review_document', {
    title: 'Review document',
    description: 'Inspect blocks and deterministic checks before proposing targeted edits.',
    argsSchema: { documentId: z.string(), criteria: z.string().optional() },
  }, async ({ documentId, criteria }) => ({ messages: [{ role: 'user', content: { type: 'text', text: `Read document ${documentId}, run check_document, then review it against ${criteria || 'clarity, completeness, structure, language, and its brief'}. Propose targeted edits only.` } }] }));

  server.registerPrompt('prepare_export', {
    title: 'Prepare export',
    description: 'Check a document before exporting it.',
    argsSchema: { documentId: z.string(), format: z.enum(['docx', 'pdf']).optional() },
  }, async ({ documentId, format }) => ({ messages: [{ role: 'user', content: { type: 'text', text: `Read document ${documentId}, run check_document, inspect pending proposals, and report issues before exporting as ${format || 'docx'}.` } }] }));

  return server;
}
