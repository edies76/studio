'use client';

import { Button } from '@/components/ui/button';
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
  onInsertTable?: () => void;
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
      {onInsertMath && (
        <Button variant="ghost" size="icon" className={btn} onClick={onInsertMath} title="Insert equation (LaTeX)">
          <Sigma className="h-4 w-4" strokeWidth={1.5} />
        </Button>
      )}
      {onInsertTable && (
        <Button variant="ghost" size="icon" className={btn} onClick={onInsertTable} title="Insert table">
          <Table2 className="h-4 w-4" strokeWidth={1.5} />
        </Button>
      )}
      {onInsertImage && (
        <Button variant="ghost" size="icon" className={btn} onClick={onInsertImage} title="Insert image">
          <ImagePlus className="h-4 w-4" strokeWidth={1.5} />
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
      {onImportWord && (
        <Button
          variant="ghost"
          size="icon"
          className={btn}
          onClick={onImportWord}
          title="Importar Word (.docx)"
        >
          <FileUp className="h-4 w-4" strokeWidth={1.5} />
        </Button>
      )}
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
    </div>
  );
}
