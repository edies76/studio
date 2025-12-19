'use client';

import { useState, useEffect, useLayoutEffect, useRef, useCallback } from 'react';
import { generateDocumentContent } from '@/ai/flows/generate-document-content';
import { enhanceDocument } from '@/ai/flows/enhance-document';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import RightSidebar from '@/components/right-sidebar';
import TextSelectionIcon from '@/components/ui/text-selection-icon';
import TextSelectionMenu from '@/components/ui/text-selection-menu';
import { useToast } from '@/hooks/use-toast';
import {
  FileText,
  Download,
  Wand2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import jsPDF from 'jspdf';


declare global {
  interface Window { MathJax: any; } 
}

interface UploadedImage {
  id: string;
  name: string;
  dataUrl: string;
  number: number;
}

export default function DocuCraftClient({ topic }: { topic: string }) {
  const [documentContent, setDocumentContent] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [showIcon, setShowIcon] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });
  const [isClient, setIsClient] = useState(false);
  const [uploadedImages, setUploadedImages] = useState<UploadedImage[]>([]);

  const selectionRef = useRef<Range | null>(null);
  const { toast } = useToast();
  const editorRef = useRef<HTMLDivElement>(null);

  const typesetMath = useCallback(() => {
    if (editorRef.current && window.MathJax) {
        window.MathJax.startup.promise.then(() => {
            if (window.MathJax.startup.document.menu) {
                window.MathJax.startup.document.menu.settings.showMathMenu = false;
            }
            if(editorRef.current) {
                window.MathJax.typesetClear([editorRef.current]);
                window.MathJax.typesetPromise([editorRef.current]).catch((err: any) => {
                    if (!String(err).includes('restart')) {
                        console.error('MathJax typesetting failed:', err);
                    }
                });
            }
        }).catch((err: any) => console.error('MathJax startup promise failed:', err));
    }
  }, []);

  const processPlaceholders = useCallback((content: string, images: UploadedImage[]): string => {
      const regex = /\[IMAGE_PLACEHOLDER: (.*?)\]/g;
      return content.replace(regex, (match, captured) => {
          const parts = captured.split(',').map((s: string) => s.trim());
          const id = parts[0];
          const size = parts.length > 1 ? parseInt(parts[1], 10) : 1;
          const image = images.find(img => img.id === id);

          if (!image) {
              return '<span style="color:orange; border: 1px dashed orange; padding: 2px 4px; border-radius: 4px; font-family: monospace;">[Image not found]</span>';
          }
          const style = `width: ${size === 1 ? '100%' : size === 2 ? '75%' : size === 3 ? '50%' : size === 4 ? '35%' : '25%'}; display: block; margin: 1rem auto; border-radius: 0.5rem;`;
          return `<img src="${image.dataUrl}" alt="${image.name || 'Uploaded image'}" style="${style}" />`;
      });
  }, []);

  useEffect(() => {
    if (!isClient) { setIsClient(true); return; }
    const generateInitialContent = async () => {
      setIsLoading(true);
      const { dismiss } = toast({ description: 'B.A.M.B.A.I. is preparing the document...' });
      try {
        const initialTopic = sessionStorage.getItem('initialTopic') || topic;
        const initialImagesRaw = sessionStorage.getItem('initialImages');
        let initialImages: UploadedImage[] = [];
        if (initialImagesRaw) { try { initialImages = JSON.parse(initialImagesRaw); setUploadedImages(initialImages); } catch (e) { console.error("Failed to parse images", e); } }
        sessionStorage.removeItem('uploadedDocumentContent');
        const result = await generateDocumentContent({ topic: initialTopic });
        const finalContent = processPlaceholders(result.content, initialImages);
        setDocumentContent(finalContent);
        toast({ title: 'Success', description: 'Document generated.' });
      } catch (error) { 
        console.error("Error generating content:", error);
        toast({ variant: 'destructive', title: 'Error', description: 'Could not generate content.' });
      } finally { setIsLoading(false); dismiss(); }
    };
    generateInitialContent();
  }, [isClient, topic, toast, processPlaceholders]);

  useLayoutEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== documentContent) {
      editorRef.current.innerHTML = documentContent;
    }
  }, [documentContent]);

  useEffect(() => {
    if (!isLoading) {
      typesetMath();
    }
  }, [documentContent, isLoading, typesetMath]);

  const handleMouseUp = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('.right-sidebar')) return;
    setTimeout(() => {
      const selection = window.getSelection();
      if (selection && selection.rangeCount > 0 && !selection.isCollapsed) {
        const range = selection.getRangeAt(0);
        selectionRef.current = range.cloneRange();
        const rect = range.getBoundingClientRect();
        if (editorRef.current) {
          const editorRect = editorRef.current.getBoundingClientRect();
          setMenuPosition({ top: rect.top - editorRect.top + rect.height / 2 - 16, left: rect.right - editorRect.left + 10 });
          setShowIcon(true); setShowMenu(false);
        }
      } else { setShowIcon(false); setShowMenu(false); }
    }, 10);
  };
  
  const handleIconClick = () => {
    if (selectionRef.current && editorRef.current) {
      const rect = selectionRef.current.getBoundingClientRect();
      const editorRect = editorRef.current.getBoundingClientRect();
      setMenuPosition({ top: rect.bottom - editorRect.top + 5, left: rect.left - editorRect.left + rect.width / 2 - 160 });
      setShowIcon(false); setShowMenu(true);
    }
  };

  const handleImageUpload = (files: File[]) => {
    const newImagesInfo = files.map((file, index) => ({ id: crypto.randomUUID(), name: file.name, number: uploadedImages.length + index + 1 }));
    newImagesInfo.forEach((imageInfo, index) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUrl = e.target?.result as string;
        setUploadedImages(prev => { const updated = [...prev, { ...imageInfo, dataUrl }]; sessionStorage.setItem('initialImages', JSON.stringify(updated)); return updated; });
      };
      reader.readAsDataURL(files[index]);
    });
    toast({ title: 'Success', description: `Uploaded ${files.length} image(s).` });
  };

  const handleChatMessage = async (message: string, images: UploadedImage[]): Promise<string | null> => {
    if (!editorRef.current) return null;
    const { dismiss } = toast({ description: 'AI is updating the document...' });
    try {
      const result = await enhanceDocument({ documentContent: editorRef.current.innerHTML, feedback: `USER REQUEST: "${message}"` });
      const finalContent = processPlaceholders(result.enhancedDocumentContent, images);
      setDocumentContent(finalContent);
      return "I've updated the document as requested.";
    } catch (error) { console.error(error); return "I encountered an error."; } 
    finally { dismiss(); }
  };
  
  const handleReanalyze = () => {
      if (!editorRef.current) { toast({ variant: 'destructive', title: 'Error', description: 'Editor not available.'}); return; }
      const currentContent = editorRef.current.innerHTML;
      const processedContent = processPlaceholders(currentContent, uploadedImages);
      setDocumentContent(processedContent);
      toast({ title: 'Success', description: 'Document re-analyzed and images updated.' });
  };

  const handleAIAction = async (action: string, value?: string) => { /* Placeholder */ };

  const handleExportPdf = async () => {
    if (!editorRef.current) {
      toast({ variant: 'destructive', title: 'Error', description: 'Editor is not available.' });
      return;
    }
    const { dismiss } = toast({ description: 'Exporting to PDF...' });
    try {
      const doc = new jsPDF({
        orientation: 'p',
        unit: 'px',
        format: 'a4',
        putOnlyUsedFonts: true,
        floatPrecision: 16 
      });
      await doc.html(editorRef.current, {
        callback: function (doc) {
          doc.save('document.pdf');
          dismiss();
          toast({ title: 'Success', description: 'Document exported to PDF.' });
        },
        margin: [10, 10, 10, 10],
        autoPaging: 'text',
        width: 425, // A4 width in px (approx)
        windowWidth: editorRef.current.scrollWidth,
      });
    } catch (error) {
      console.error("Error exporting to PDF:", error);
      dismiss();
      toast({ variant: 'destructive', title: 'Error', description: 'Could not export to PDF.' });
    }
  };

  const handleExportWord = () => {
    if (!editorRef.current) {
      toast({ variant: 'destructive', title: 'Error', description: 'Editor is not available.' });
      return;
    }
    const { dismiss } = toast({ description: 'Exporting to Word...' });
    try {
        const header = "<html xmlns:o='urn:schemas-microsoft-com:office:office' "+
            "xmlns:w='urn:schemas-microsoft-com:office:word' "+
            "xmlns='http://www.w3.org/TR/REC-html40'>"+
            "<head><meta charset='utf-8'><title>Export HTML to Word Document</title></head><body>";
        const content = editorRef.current.innerHTML;
        const footer = "</body></html>";
        const sourceHTML = header + content + footer;

        const source = 'data:application/vnd.ms-word;charset=utf-8,' + encodeURIComponent(sourceHTML);
        const fileDownload = document.createElement("a");
        document.body.appendChild(fileDownload);
        fileDownload.href = source;
        fileDownload.download = 'document.doc';
        fileDownload.click();
        document.body.removeChild(fileDownload);

        dismiss();
        toast({ title: 'Success', description: 'Document exported to Word.' });
    } catch (error) {
        console.error("Error exporting to Word:", error);
        dismiss();
        toast({ variant: 'destructive', title: 'Error', description: 'Could not export to Word.' });
    }
  };

  if (!isClient) {
    return <div className="flex h-screen w-full items-center justify-center bg-gray-900"><p className="text-white">Loading Editor...</p></div>;
  }

  return (
    <div className='flex flex-col h-screen bg-gray-900 text-gray-100 font-sans'>
      <header className='flex items-center justify-between px-6 py-3 border-b border-gray-800 shrink-0'>
        <div className='flex items-center gap-3'>
          <Wand2 className='w-6 h-6 text-blue-500' />
          <h1 className="text-2xl font-['Playwrite_IT_Moderna'] font-bold text-white">B.A.M.B.A.I</h1>
        </div>
        <div className='flex items-center gap-4'>
          <DropdownMenu><DropdownMenuTrigger asChild><Button variant='outline' className='border-gray-700'><Download className='w-4 h-4 mr-2' />Export</Button></DropdownMenuTrigger><DropdownMenuContent><DropdownMenuItem onClick={handleExportPdf}><FileText className='w-4 h-4 mr-2' />Export to PDF</DropdownMenuItem><DropdownMenuItem onClick={handleExportWord}><FileText className='w-4 h-4 mr-2' />Export to Word</DropdownMenuItem></DropdownMenuContent></DropdownMenu>
        </div>
      </header>

      <div className='flex-1 grid md:grid-cols-[1fr_400px] min-h-0'>
        <main className='relative flex-1 flex flex-col p-8 md:p-12 overflow-y-auto' onMouseUp={handleMouseUp}>
            {isLoading ? (
                <div className="flex items-center justify-center h-full"><p>Generating document...</p></div>
            ) : (
                <>
                    {showIcon && <TextSelectionIcon top={menuPosition.top} left={menuPosition.left} onClick={handleIconClick} />}
                    {showMenu && <TextSelectionMenu top={menuPosition.top} left={menuPosition.left} onAction={handleAIAction} onClose={() => setShowMenu(false)} />}
                    <style>{`.prose img { margin: 2em auto; border-radius: 0.5rem; }`}</style>
                    <div
                        ref={editorRef}
                        contentEditable
                        suppressContentEditableWarning
                        className={cn('prose dark:prose-invert prose-lg max-w-full w-full h-full focus:outline-none bg-gray-800/30 rounded-lg p-6 overflow-y-auto')}
                    />
                </>
            )}
        </main>
        
        <div className="right-sidebar h-full">
           <RightSidebar 
              initialPrompt={sessionStorage.getItem('initialTopic') || topic}
              onChatMessage={handleChatMessage}
              uploadedImages={uploadedImages}
              onImageUpload={handleImageUpload}
              onReanalyze={handleReanalyze}
            />
        </div>

      </div>
    </div>
  );
}
