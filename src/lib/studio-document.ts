/** Native, serializable document model. HTML is only a compatibility projection. */
export type TextMark = { bold?: boolean; italic?: boolean; underline?: boolean; color?: string; background?: string; fontSize?: string; fontFamily?: string };
export type TextRun = { text: string; marks?: TextMark };
export type BlockStyle = { align?: 'left' | 'center' | 'right' | 'justify'; indent?: number; spacingBefore?: number; spacingAfter?: number };
export type StudioBlock =
  | { id: string; type: 'paragraph' | 'heading' | 'quote'; level?: 1 | 2 | 3 | 4 | 5 | 6; runs: TextRun[]; style?: BlockStyle }
  | { id: string; type: 'list'; ordered: boolean; items: { id: string; runs: TextRun[] }[]; style?: BlockStyle }
  | { id: string; type: 'table'; rows: { id: string; cells: { id: string; runs: TextRun[]; header?: boolean }[] }[] }
  | { id: string; type: 'image'; src: string; alt: string; width?: number; height?: number; wrap: 'inline' | 'left' | 'right' | 'center' | 'break' | 'behind'; left?: number; top?: number }
  | { id: string; type: 'equation'; tex: string; display: boolean }
  | { id: string; type: 'pageBreak' };

type ImageWrap = Extract<StudioBlock, { type: 'image' }>['wrap'];

export type StudioDocumentModel = {
  version: 1;
  page: { size: 'letter' | 'legal' | 'a4'; margins: { top: number; right: number; bottom: number; left: number }; header?: string; footer?: string };
  blocks: StudioBlock[];
};

const id = () => (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `block-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
const escape = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const text = (node: Element) => Array.from(node.childNodes).map((child) => child.textContent || '').join('');

export function createStudioDocument(pageSize: StudioDocumentModel['page']['size'] = 'letter'): StudioDocumentModel {
  return { version: 1, page: { size: pageSize, margins: { top: 72, right: 72, bottom: 72, left: 72 } }, blocks: [{ id: id(), type: 'paragraph', runs: [{ text: '' }] }] };
}

export function modelFromHtml(html: string, pageSize: StudioDocumentModel['page']['size'] = 'letter'): StudioDocumentModel {
  if (typeof document === 'undefined') return createStudioDocument(pageSize);
  const host = document.createElement('div'); host.innerHTML = html || '';
  const blocks: StudioBlock[] = [];
  const runsFrom = (node: Element): TextRun[] => {
    const values: TextRun[] = [];
    const walk = (current: Node, marks: TextMark = {}) => {
      if (current.nodeType === Node.TEXT_NODE) { if (current.textContent) values.push({ text: current.textContent, marks: Object.keys(marks).length ? marks : undefined }); return; }
      if (current.nodeType !== Node.ELEMENT_NODE) return;
      const el = current as HTMLElement; const next = { ...marks };
      if (['STRONG', 'B'].includes(el.tagName)) next.bold = true;
      if (['EM', 'I'].includes(el.tagName)) next.italic = true;
      if (el.tagName === 'U') next.underline = true;
      if (el.style.color) next.color = el.style.color;
      if (el.style.backgroundColor) next.background = el.style.backgroundColor;
      if (el.style.fontSize) next.fontSize = el.style.fontSize;
      if (el.style.fontFamily) next.fontFamily = el.style.fontFamily;
      Array.from(el.childNodes).forEach((child) => walk(child, next));
    };
    Array.from(node.childNodes).forEach((child) => walk(child));
    return values.length ? values : [{ text: '' }];
  };
  Array.from(host.children).forEach((element) => {
    const el = element as HTMLElement; const tag = el.tagName.toLowerCase();
    const blockId = el.dataset.studioBlockId || id();
    if (/^h[1-6]$/.test(tag)) blocks.push({ id: blockId, type: 'heading', level: Number(tag[1]) as 1, runs: runsFrom(el) });
    else if (tag === 'p' || tag === 'blockquote') blocks.push({ id: blockId, type: tag === 'blockquote' ? 'quote' : 'paragraph', runs: runsFrom(el), style: { align: (el.style.textAlign as BlockStyle['align']) || undefined, indent: parseFloat(el.style.marginLeft || '0') || undefined } });
    else if (tag === 'ul' || tag === 'ol') blocks.push({ id: blockId, type: 'list', ordered: tag === 'ol', items: Array.from(el.querySelectorAll(':scope > li')).map((li) => ({ id: (li as HTMLElement).dataset.studioItemId || id(), runs: runsFrom(li) })) });
    else if (tag === 'table') blocks.push({ id: blockId, type: 'table', rows: Array.from(el.querySelectorAll(':scope > tr, :scope > tbody > tr')).map((row) => ({ id: (row as HTMLElement).dataset.studioRowId || id(), cells: Array.from(row.querySelectorAll(':scope > th, :scope > td')).map((cell) => ({ id: (cell as HTMLElement).dataset.studioCellId || id(), header: cell.tagName === 'TH', runs: runsFrom(cell) })) })) });
    else if (tag === 'img') {
      const candidate = el.dataset.studioWrap;
      const wrap: ImageWrap = candidate === 'inline' || candidate === 'left' || candidate === 'right' || candidate === 'center' || candidate === 'behind' ? candidate : 'break';
      blocks.push({ id: blockId, type: 'image', src: el.getAttribute('src') || '', alt: el.getAttribute('alt') || '', width: Number(el.style.width.replace('px', '')) || undefined, height: Number(el.style.height.replace('px', '')) || undefined, wrap, left: Number(el.style.left.replace('px', '')) || undefined, top: Number(el.style.top.replace('px', '')) || undefined });
    }
    else if (el.classList.contains('studio-page-break') || el.dataset.studioBreak === '1') blocks.push({ id: blockId, type: 'pageBreak' });
    else if (text(el).trim()) blocks.push({ id: blockId, type: 'paragraph', runs: runsFrom(el) });
  });
  return { version: 1, page: { ...createStudioDocument(pageSize).page, size: pageSize }, blocks: blocks.length ? blocks : createStudioDocument(pageSize).blocks };
}

function renderRuns(runs: TextRun[]) {
  return runs.map((run) => { const m = run.marks || {}; const styles = [m.color && `color:${m.color}`, m.background && `background-color:${m.background}`, m.fontSize && `font-size:${m.fontSize}`, m.fontFamily && `font-family:${m.fontFamily}`].filter(Boolean).join(';'); let value = escape(run.text).replace(/\n/g, '<br>'); if (m.bold) value = `<strong>${value}</strong>`; if (m.italic) value = `<em>${value}</em>`; if (m.underline) value = `<u>${value}</u>`; return styles ? `<span style="${styles}">${value}</span>` : value; }).join('');
}

export function modelToHtml(model: StudioDocumentModel): string {
  return model.blocks.map((block) => {
    if (block.type === 'pageBreak') return `<div class="studio-page-break" data-studio-break="1" data-studio-block-id="${escape(block.id)}"></div>`;
    if (block.type === 'image') return `<img src="${escape(block.src)}" alt="${escape(block.alt)}" data-studio-block-id="${escape(block.id)}" data-studio-wrap="${block.wrap}" style="${block.width ? `width:${block.width}px;` : ''}${block.height ? `height:${block.height}px;` : ''}${block.left != null ? `left:${block.left}px;top:${block.top || 0}px;` : ''}">`;
    if (block.type === 'equation') return `<div class="studio-math-${block.display ? 'block' : 'inline'}" data-studio-block-id="${escape(block.id)}" data-tex="${escape(block.tex)}" data-display="${block.display ? '1' : '0'}">\\(${escape(block.tex)}\\)</div>`;
    if (block.type === 'table') return `<table class="studio-table" data-studio-block-id="${escape(block.id)}"><tbody>${block.rows.map((row) => `<tr data-studio-row-id="${escape(row.id)}">${row.cells.map((cell) => `<${cell.header ? 'th' : 'td'} data-studio-cell-id="${escape(cell.id)}">${renderRuns(cell.runs)}</${cell.header ? 'th' : 'td'}>`).join('')}</tr>`).join('')}</tbody></table>`;
    if (block.type === 'list') return `<${block.ordered ? 'ol' : 'ul'} data-studio-block-id="${escape(block.id)}">${block.items.map((item) => `<li data-studio-item-id="${escape(item.id)}">${renderRuns(item.runs)}</li>`).join('')}</${block.ordered ? 'ol' : 'ul'}>`;
    const tag = block.type === 'heading' ? `h${block.level || 1}` : block.type === 'quote' ? 'blockquote' : 'p';
    const style = block.style ? [block.style.align && `text-align:${block.style.align}`, block.style.indent && `margin-left:${block.style.indent}px`, block.style.spacingBefore && `margin-top:${block.style.spacingBefore}px`, block.style.spacingAfter && `margin-bottom:${block.style.spacingAfter}px`].filter(Boolean).join(';') : '';
    return `<${tag} data-studio-block-id="${escape(block.id)}"${style ? ` style="${style}"` : ''}>${renderRuns(block.runs)}</${tag}>`;
  }).join('') || '<p><br></p>';
}

export type DocumentOperation =
  | { type: 'replaceDocument'; model: StudioDocumentModel }
  | { type: 'insertBlock'; afterId?: string; block: StudioBlock }
  | { type: 'removeBlock'; blockId: string }
  | { type: 'replaceBlock'; blockId: string; block: StudioBlock };

export function applyDocumentOperation(model: StudioDocumentModel, operation: DocumentOperation): StudioDocumentModel {
  if (operation.type === 'replaceDocument') return operation.model;
  const blocks = [...model.blocks];
  if (operation.type === 'insertBlock') { const at = operation.afterId ? blocks.findIndex((block) => block.id === operation.afterId) + 1 : blocks.length; blocks.splice(Math.max(0, at), 0, operation.block); }
  if (operation.type === 'removeBlock') { const at = blocks.findIndex((block) => block.id === operation.blockId); if (at >= 0) blocks.splice(at, 1); }
  if (operation.type === 'replaceBlock') { const at = blocks.findIndex((block) => block.id === operation.blockId); if (at >= 0) blocks[at] = operation.block; }
  return { ...model, blocks: blocks.length ? blocks : createStudioDocument(model.page.size).blocks };
}
