'use client';

import { Button } from '@/components/ui/button';
import { useState } from 'react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Bold,
  Code,
  Highlighter,
  Italic,
  Link2,
  List,
  ListOrdered,
  Redo2,
  Strikethrough,
  Subscript,
  Superscript,
  Underline,
  Undo2,
  ChevronDown,
  Sigma,
  Table2,
  Settings2,
  FileUp,
  ImagePlus,
} from 'lucide-react';
function ensureEditMode() {
  try {
    document.execCommand('styleWithCSS', false, 'true');
  } catch {
    /* ignore */
  }
}

function cmd(command: string, value?: string) {
  ensureEditMode();
  document.execCommand(command, false, value);
}

const FONTS = [
  { name: 'Inter', value: 'Inter, Segoe UI, system-ui, sans-serif' },
  { name: 'Times New Roman', value: 'Times New Roman, Times, serif' },
  { name: 'Georgia', value: 'Georgia, serif' },
  { name: 'Arial', value: 'Arial, Helvetica, sans-serif' },
  { name: 'Calibri', value: 'Calibri, Candara, sans-serif' },
  { name: 'Courier New', value: 'Courier New, monospace' },
];

const SIZES = [
  { label: '10', value: '2' },
  { label: '12', value: '3' },
  { label: '14', value: '4' },
  { label: '18', value: '5' },
  { label: '24', value: '6' },
];

type Props = {
  onRequestLink: () => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  fontFamily: string;
  onFontFamily: (f: string) => void;
  fontSize: string;
  onFontSize: (s: string) => void;
  pageCount?: number;
  wordCount?: number;
  onInsertMath?: () => void;
  onInsertTable?: (rows?: number, cols?: number) => void;
  onInsertImage?: () => void;
  onOpenSettings?: () => void;
  onImportWord?: () => void;
};

/** Clean white Word-style toolbar (restored look) */
export default function DocumentEditorToolbar({
  onRequestLink,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  fontFamily,
  onFontFamily,
  fontSize,
  onFontSize,
  pageCount,
  wordCount,
  onInsertMath,
  onInsertTable,
  onInsertImage,
  onOpenSettings,
  onImportWord,
}: Props) {
  const [insertOpen, setInsertOpen] = useState(false);
  const [tableRows, setTableRows] = useState(3);
  const [tableCols, setTableCols] = useState(3);

  const applyFont = (value: string, name: string) => {
    onFontFamily(value);
    ensureEditMode();
    document.execCommand('fontName', false, name);
  };

  const applySize = (cmdVal: string, css: string) => {
    onFontSize(css);
    ensureEditMode();
    document.execCommand('fontSize', false, cmdVal);
  };

  const btn =
    'h-8 w-8 text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900 rounded-md';

  return (
    <div className="flex flex-nowrap items-center gap-0.5 bg-transparent px-2 py-1.5 text-neutral-800">
      <Button variant="ghost" size="icon" className={btn} disabled={!canUndo} onClick={onUndo} title="Undo">
        <Undo2 className="h-4 w-4" strokeWidth={1.5} />
      </Button>
      <Button variant="ghost" size="icon" className={btn} disabled={!canRedo} onClick={onRedo} title="Redo">
        <Redo2 className="h-4 w-4" strokeWidth={1.5} />
      </Button>

      <div className="mx-1 h-5 w-px bg-neutral-200" />

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="h-8 gap-1 text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900">
            Body <ChevronDown className="h-3 w-3" strokeWidth={1.5} />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem onClick={() => cmd('formatBlock', 'p')}>Paragraph</DropdownMenuItem>
          <DropdownMenuItem onClick={() => cmd('formatBlock', 'h1')}>Heading 1</DropdownMenuItem>
          <DropdownMenuItem onClick={() => cmd('formatBlock', 'h2')}>Heading 2</DropdownMenuItem>
          <DropdownMenuItem onClick={() => cmd('formatBlock', 'h3')}>Heading 3</DropdownMenuItem>
          <DropdownMenuItem onClick={() => cmd('formatBlock', 'blockquote')}>Quote</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="h-8 max-w-[130px] gap-1 truncate text-neutral-600 hover:bg-neutral-100">
            {FONTS.find((f) => f.value === fontFamily)?.name || 'Font'}
            <ChevronDown className="h-3 w-3 shrink-0" strokeWidth={1.5} />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          {FONTS.map((font) => (
            <DropdownMenuItem key={font.name} onClick={() => applyFont(font.value, font.name)} style={{ fontFamily: font.value }}>
              {font.name}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="h-8 gap-1 text-neutral-600 hover:bg-neutral-100">
            {fontSize.replace('px', '')}
            <ChevronDown className="h-3 w-3" strokeWidth={1.5} />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          {SIZES.map((s) => (
            <DropdownMenuItem key={s.label} onClick={() => applySize(s.value, `${s.label}px`)}>
              {s.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <div className="mx-1 h-5 w-px bg-neutral-200" />

      <Button variant="ghost" size="icon" className={btn} onClick={() => cmd('bold')} title="Bold">
        <Bold className="h-4 w-4" strokeWidth={1.5} />
      </Button>
      <Button variant="ghost" size="icon" className={btn} onClick={() => cmd('italic')} title="Italic">
        <Italic className="h-4 w-4" strokeWidth={1.5} />
      </Button>
      <Button variant="ghost" size="icon" className={btn} onClick={() => cmd('underline')} title="Underline">
        <Underline className="h-4 w-4" strokeWidth={1.5} />
      </Button>
      <Button variant="ghost" size="icon" className={btn} onClick={onRequestLink} title="Link">
        <Link2 className="h-4 w-4" strokeWidth={1.5} />
      </Button>
      {(onInsertMath || onInsertTable || onInsertImage || onImportWord) && (
        <Button
          variant="ghost"
          size="sm"
          className="h-8 gap-1.5 rounded-md px-2 text-neutral-700 hover:bg-neutral-100 hover:text-neutral-900"
          onClick={() => setInsertOpen(true)}
          title="Insertar o importar"
        >
          <FileUp className="h-4 w-4" strokeWidth={1.5} />
          <span className="hidden sm:inline">Insertar</span>
        </Button>
      )}

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="h-8 px-2 text-neutral-600 hover:bg-neutral-100">
            …
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-52">
          <DropdownMenuItem onClick={() => cmd('strikeThrough')}>
            <Strikethrough className="mr-2 h-4 w-4" /> Strikethrough
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => cmd('formatBlock', 'pre')}>
            <Code className="mr-2 h-4 w-4" /> Code
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => cmd('hiliteColor', '#fef08a')}>
            <Highlighter className="mr-2 h-4 w-4" /> Highlight
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => cmd('subscript')}>
            <Subscript className="mr-2 h-4 w-4" /> Subscript
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => cmd('superscript')}>
            <Superscript className="mr-2 h-4 w-4" /> Superscript
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => cmd('justifyLeft')}>
            <AlignLeft className="mr-2 h-4 w-4" /> Align left
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => cmd('justifyCenter')}>
            <AlignCenter className="mr-2 h-4 w-4" /> Center
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => cmd('justifyRight')}>
            <AlignRight className="mr-2 h-4 w-4" /> Right
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => cmd('justifyFull')}>
            <AlignJustify className="mr-2 h-4 w-4" /> Justify
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => cmd('insertUnorderedList')}>
            <List className="mr-2 h-4 w-4" /> Bullets
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => cmd('insertOrderedList')}>
            <ListOrdered className="mr-2 h-4 w-4" /> Numbers
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <div className="mx-1 h-5 w-px bg-neutral-200" />
      {onOpenSettings && (
        <Button
          variant="ghost"
          size="icon"
          className={btn}
          onClick={onOpenSettings}
          title="Ajustes"
        >
          <Settings2 className="h-4 w-4" strokeWidth={1.5} />
        </Button>
      )}
      {typeof pageCount === 'number' && (
        <span className="ml-0.5 shrink-0 px-1 font-mono text-[10px] text-neutral-400" title="Páginas">
          {pageCount}p
        </span>
      )}
      {typeof wordCount === 'number' && (
        <span className="shrink-0 px-1 font-mono text-[10px] text-neutral-400" title="Palabras">
          {wordCount}w
        </span>
      )}

      {insertOpen && (
        <div
          className="fixed inset-0 z-[90] flex items-center justify-center bg-black/15 px-4"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setInsertOpen(false);
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="insert-dialog-title"
            className="w-full max-w-[620px] rounded-2xl border border-[#d8d1c8] bg-[#fffdfa] p-5 text-[#211b17] shadow-[0_24px_80px_rgba(38,29,23,0.2)]"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-[#8b4a34]">Biblioteca de objetos</p>
                <h2 id="insert-dialog-title" className="mt-1 text-lg font-semibold tracking-[-0.02em]">Insertar en el lienzo</h2>
                <p className="mt-1 max-w-[470px] text-xs leading-5 text-[#75695e]">Elegí una pieza y ajustá lo necesario antes de llevarla al documento.</p>
              </div>
              <button type="button" onClick={() => setInsertOpen(false)} className="rounded-lg px-2 py-1 text-lg text-[#75695e] hover:bg-[#f0ece6]" aria-label="Cerrar">×</button>
            </div>

            <div className="mt-5 grid gap-2 sm:grid-cols-2">
              {onInsertMath && (
                <button type="button" onClick={() => { setInsertOpen(false); onInsertMath(); }} className="flex items-start gap-3 rounded-xl border border-[#ded6cd] p-3 text-left hover:border-[#8b4a34] hover:bg-[#fbf7f1]">
                  <Sigma className="mt-0.5 h-5 w-5 text-[#8b4a34]" strokeWidth={1.5} />
                  <span><strong className="block text-sm">Ecuación</strong><small className="mt-1 block text-[11px] leading-4 text-[#75695e]">LaTeX, vista previa y bloque centrado.</small></span>
                </button>
              )}
              {onInsertImage && (
                <button type="button" onClick={() => { setInsertOpen(false); onInsertImage(); }} className="flex items-start gap-3 rounded-xl border border-[#ded6cd] p-3 text-left hover:border-[#8b4a34] hover:bg-[#fbf7f1]">
                  <ImagePlus className="mt-0.5 h-5 w-5 text-[#8b4a34]" strokeWidth={1.5} />
                  <span><strong className="block text-sm">Imagen</strong><small className="mt-1 block text-[11px] leading-4 text-[#75695e]">Tamaño, posición y ajuste de texto.</small></span>
                </button>
              )}
              {onImportWord && (
                <button type="button" onClick={() => { setInsertOpen(false); onImportWord(); }} className="flex items-start gap-3 rounded-xl border border-[#ded6cd] p-3 text-left hover:border-[#8b4a34] hover:bg-[#fbf7f1]">
                  <FileUp className="mt-0.5 h-5 w-5 text-[#8b4a34]" strokeWidth={1.5} />
                  <span><strong className="block text-sm">Importar Word</strong><small className="mt-1 block text-[11px] leading-4 text-[#75695e]">.docx con texto, tablas y fórmulas detectables.</small></span>
                </button>
              )}
              {onInsertTable && (
                <div className="rounded-xl border border-[#ded6cd] p-3">
                  <div className="flex items-start gap-3">
                    <Table2 className="mt-0.5 h-5 w-5 text-[#8b4a34]" strokeWidth={1.5} />
                    <div className="min-w-0 flex-1"><strong className="block text-sm">Tabla</strong><small className="mt-1 block text-[11px] leading-4 text-[#75695e]">Empieza con encabezado y queda editable.</small></div>
                  </div>
                  <div className="mt-3 flex items-end gap-2">
                    <label className="text-[10px] text-[#75695e]">Filas<input type="number" min={2} max={20} value={tableRows} onChange={(event) => setTableRows(Math.min(20, Math.max(2, Number(event.target.value) || 2)))} className="mt-1 block h-7 w-14 rounded-md border border-[#cfc5ba] bg-white px-2 text-xs outline-none focus:border-[#8b4a34]" /></label>
                    <label className="text-[10px] text-[#75695e]">Columnas<input type="number" min={1} max={12} value={tableCols} onChange={(event) => setTableCols(Math.min(12, Math.max(1, Number(event.target.value) || 1)))} className="mt-1 block h-7 w-14 rounded-md border border-[#cfc5ba] bg-white px-2 text-xs outline-none focus:border-[#8b4a34]" /></label>
                    <button type="button" onClick={() => { setInsertOpen(false); onInsertTable(tableRows, tableCols); }} className="ml-auto rounded-md bg-[#3d3229] px-3 py-1.5 text-[11px] font-semibold text-[#fffaf4] hover:bg-[#2a221c]">Insertar</button>
                  </div>
                </div>
              )}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
