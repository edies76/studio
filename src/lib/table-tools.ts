import { sanitizeDocumentHtml } from './math-html';

function escapeCell(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export type TableCellEdit = {
  tableIndex: number;
  rowIndex: number;
  columnIndex: number;
  content: string;
};

/** Replace one cell while preserving the rest of the document byte-for-byte. */
export function replaceTableCell(html: string, input: TableCellEdit) {
  const tables = [...html.matchAll(/<table\b[^>]*>[\s\S]*?<\/table>/gi)];
  const table = tables[input.tableIndex];
  if (!table || input.rowIndex < 0 || input.columnIndex < 0) return null;

  const rows = [...table[0].matchAll(/<tr\b[^>]*>[\s\S]*?<\/tr>/gi)];
  const row = rows[input.rowIndex];
  if (!row) return null;
  const cells = [...row[0].matchAll(/<(th|td)\b([^>]*)>([\s\S]*?)<\/\1>/gi)];
  const cell = cells[input.columnIndex];
  if (!cell) return null;

  const nextCell = `<${cell[1]}${cell[2]}>${escapeCell(input.content)}<\/${cell[1]}>`;
  const nextRow = row[0].slice(0, cell.index || 0) + nextCell + row[0].slice((cell.index || 0) + cell[0].length);
  const nextTable = table[0].slice(0, row.index || 0) + nextRow + table[0].slice((row.index || 0) + row[0].length);
  const nextHtml = html.slice(0, table.index || 0) + nextTable + html.slice((table.index || 0) + table[0].length);
  return { html: sanitizeDocumentHtml(nextHtml), previousHtml: cell[3] };
}
