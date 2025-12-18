'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { generateDocumentContent } from '@/ai/flows/generate-document-content';
import { enhanceDocument } from '@/ai/flows/enhance-document';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import AiToolsSidebar from '@/components/ai-tools-sidebar';
import FloatingToolbar from '@/components/ui/floating-toolbar';
import TextSelectionIcon from '@/components/ui/text-selection-icon';
import TextSelectionMenu from '@/components/ui/text-selection-menu';
import { useToast } from '@/hooks/use-toast';
import {
  FileText,
  Download,
  Wand2,
  Upload,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import jsPDF from 'jspdf';
import * as mammoth from 'mammoth';

declare global {
  interface Window {
    MathJax: {
      typesetPromise: (elements?: HTMLElement[]) => Promise<void>;
      startup: {
        promise: Promise<void>;
      };
    };
  }
}

export default function DocuCraftClient({ topic }: { topic: string }) {
  const [documentContent, setDocumentContent] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [showIcon, setShowIcon] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  const selectionRef = useRef<Range | null>(null);
  const { toast } = useToast();
  const editorRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const typesetMath = useCallback(() => {
    if (editorRef.current && window.MathJax) {
        window.MathJax.startup.promise.then(() => {
            window.MathJax.typesetPromise([editorRef.current!]).catch((err) => {
                console.error('MathJax typesetting failed:', err);
            });
        });
    }
  }, []);

  useEffect(() => {
    const uploadedContent = sessionStorage.getItem('uploadedDocumentContent');
    sessionStorage.removeItem('uploadedDocumentContent');

    const generateInitialContent = async () => {
      const { dismiss } = toast({ description: 'B.A.M.B.A.I. is thinking... a document will be generated soon' });
      try {
        const result = await generateDocumentContent({ topic: uploadedContent ? `${topic}\n\n${uploadedContent}` : topic });
        setDocumentContent(result.content);
        toast({ title: 'Success', description: 'Document generated successfully.' });
      } catch (error) { 
        console.error(error);
        toast({ variant: 'destructive', title: 'Error', description: 'Could not generate document content.' });
        setDocumentContent(`<h1>Error generating document</h1><p>Please try again later.</p>`);
      } finally {
        setIsLoading(false);
        dismiss();
      }
    };

    if (topic) {
      generateInitialContent();
    }
  }, [topic, toast]);

  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== documentContent) {
      editorRef.current.innerHTML = documentContent;
      typesetMath();
    }
  }, [documentContent, typesetMath]);

  useEffect(() => {
    const handlePaste = (event: ClipboardEvent) => {
      event.preventDefault();
      const items = event.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          const blob = items[i].getAsFile();
          if (!blob) continue;

          const reader = new FileReader();
          reader.onload = (e) => {
            const src = e.target?.result as string;
            const img = document.createElement('img');
            img.src = src;

            const selection = window.getSelection();
            if (!selection || selection.rangeCount === 0) return;

            const range = selection.getRangeAt(0);
            range.deleteContents();
            range.insertNode(img);

            // Move cursor after the inserted image
            const newRange = document.createRange();
            newRange.setStartAfter(img);
            newRange.collapse(true);
            selection.removeAllRanges();
            selection.addRange(newRange);

            // Save the updated content
            if (editorRef.current) {
              setDocumentContent(editorRef.current.innerHTML);
            }
          };
          reader.readAsDataURL(blob);
        }
      }
    };

    const editor = editorRef.current;
    if (editor) {
      editor.addEventListener('paste', handlePaste);
    }

    return () => {
      if (editor) {
        editor.removeEventListener('paste', handlePaste);
      }
    };
  }, [editorRef]);

  const handleMouseUp = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('.floating-toolbar-container')) {
      return;
    }
    setTimeout(() => {
      const selection = window.getSelection();
      if (selection && selection.rangeCount > 0 && !selection.isCollapsed) {
        const range = selection.getRangeAt(0);
        selectionRef.current = range.cloneRange();
        const rect = range.getBoundingClientRect();
        
        if (editorRef.current) {
          const editorRect = editorRef.current.getBoundingClientRect();
          setMenuPosition({
            top: rect.top - editorRect.top + rect.height / 2 - 16, // Center vertically
            left: rect.right - editorRect.left + 10, // Position to the right
          });
          setShowIcon(true);
          setShowMenu(false);
        }
      } else {
        setShowIcon(false);
        setShowMenu(false);
      }
    }, 10);
  };
  
  const handleIconClick = () => {
    if (selectionRef.current) {
        const rect = selectionRef.current.getBoundingClientRect();
        if (editorRef.current) {
            const editorRect = editorRef.current.getBoundingClientRect();
            setMenuPosition({
                top: rect.bottom - editorRect.top + 5,
                left: rect.left - editorRect.left + rect.width / 2 - 160, // Center horizontally
            });
            setShowIcon(false);
            setShowMenu(true);
        }
    }
  };

  const handleFloatingBarAction = async (action: string) => {
    if (!editorRef.current) return;

    let feedback = '';
    let toastDescription = 'AI is enhancing the document...';

    switch (action) {
      case 'grammar':
        feedback = 'Fix all grammar and spelling mistakes in the text. Only return the corrected text.';
        toastDescription = 'Checking grammar for the entire document...';
        break;
      case 'suggest-changes':
         feedback = 'Act as an editor. Review the following document and provide a revised version with improvements to clarity, flow, and overall quality. Only return the improved text.';
         toastDescription = 'AI is suggesting changes...';
        break;
      case 'improve':
        feedback = 'Improve the entire document, making it more engaging and clear.';
        break;
      case 'shorter':
        feedback = 'Make the entire document shorter and more concise.';
        break;
      case 'expand':
        feedback = 'Expand on the content of the entire document, adding more detail and explanation.';
        break;
      default:
        console.warn(`Unknown floating bar action: ${action}`);
        return;
    }

    setIsLoading(true);
    const { dismiss } = toast({ description: toastDescription });
    try {
      const result = await enhanceDocument({
        documentContent: editorRef.current.innerText,
        feedback: feedback,
      });
      setDocumentContent(result.enhancedDocumentContent);
      toast({ title: 'Success', description: 'Document enhancement completed.' });
    } catch (error) {
      console.error(error);
      toast({ variant: 'destructive', title: 'Error', description: 'Could not enhance the document.' });
    } finally {
      setIsLoading(false);
      dismiss();
    }
  };

  const handleAIAction = async (action: string, value?: string) => {
    let prompt = '';
    const selectedText = selectionRef.current?.toString() || '';

    if (!selectedText) {
        toast({ variant: 'destructive', description: 'Please select text to perform this action.' });
        return;
    }

    switch (action) {
      case 'improve':
        prompt = 'Improve the following text:';
        break;
      case 'summarize':
        prompt = 'Summarize the following text:';
        break;
      case 'shorter':
        prompt = 'Make the following text shorter:';
        break;
      case 'expand':
        prompt = 'Expand on the following text:';
        break;
      case 'custom_prompt':
        prompt = value || '';
        break;
    }

    if (!prompt) return;

    setIsLoading(true);
    const { dismiss } = toast({ description: 'AI is thinking...' });

    try {
      const result = await enhanceDocument({
        documentContent: selectedText,
        feedback: prompt,
      });

      if (editorRef.current && selectionRef.current) {
        const range = selectionRef.current;
        range.deleteContents();
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = result.enhancedDocumentContent;
        const nodes = Array.from(tempDiv.childNodes);
        nodes.reverse().forEach(node => range.insertNode(node));
        const newRange = document.createRange();
        newRange.setStartBefore(nodes[nodes.length - 1]);
        newRange.setEndAfter(nodes[0]);
        const selection = window.getSelection();
        selection?.removeAllRanges();
        selection?.addRange(newRange);
        selectionRef.current = newRange;
      }

      toast({ title: 'Success', description: 'Text updated successfully.' });
    } catch (error) {
      console.error(error);
      toast({
        variant: 'destructive',
        title: 'Uh oh! Something went wrong.',
        description: 'Could not enhance text.',
      });
    } finally {
      setIsLoading(false);
      setShowMenu(false);
      dismiss();
    }
  };
  
  const handleExportPdf = async () => {
    if (!editorRef.current) return;
    setIsLoading(true);
    const { dismiss } = toast({ description: 'Exporting PDF...' });
  
    try {
      if (window.MathJax) {
        await window.MathJax.startup.promise;
        await window.MathJax.typesetPromise([editorRef.current]);
      }
  
      const pdf = new jsPDF({
        orientation: 'p',
        unit: 'pt',
        format: 'a4',
      });
  
      const contentToExport = editorRef.current.cloneNode(true) as HTMLElement;
      document.body.appendChild(contentToExport);
  
      contentToExport.style.backgroundColor = 'white';
      contentToExport.style.padding = '35px';
      contentToExport.style.width = '525pt';
      contentToExport.style.fontFamily = 'Inter, sans-serif';
      
      Array.from(contentToExport.querySelectorAll('*')).forEach(el => {
        const htmlEl = el as HTMLElement;
        htmlEl.style.color = 'black';
        htmlEl.style.fontFamily = 'Inter, sans-serif';
      });
      
      await pdf.html(contentToExport, {
        callback: function (doc) {
          doc.save('document.pdf');
          document.body.removeChild(contentToExport);
          dismiss();
          toast({ title: 'Success', description: 'PDF exported successfully.' });
        },
        width: 525,
        windowWidth: contentToExport.scrollWidth,
        autoPaging: 'text'
      });
  
    } catch (error) {
      console.error('Error exporting PDF:', error);
      dismiss();
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Could not export PDF. Please try again.',
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleExportWord = () => {
    if (!editorRef.current) return;
    let content = editorRef.current.innerHTML;

    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = content;
    const mathJaxElements = tempDiv.querySelectorAll('mjx-container');
    mathJaxElements.forEach((mjx) => {
        const mathml = mjx.querySelector('math');
        if(mathml) {
            const oMath = `<m:oMath>${mathml.outerHTML}</m:oMath>`;
            const parent = mjx.parentElement;
            if(parent) {
                const span = document.createElement('span');
                span.innerHTML = oMath;
                if (span.firstChild) {
                  parent.replaceChild(span.firstChild, mjx);
                }
            }
        }
    });

    content = tempDiv.innerHTML;

    const header = "<html xmlns:o='urn:schemas-microsoft-com:office:office' "+
        "xmlns:w='urn:schemas-microsoft-com:office:word' "+
        "xmlns:m='http://schemas.openxmlformats.org/office/2006/math' "+
        "xmlns='http://www.w3.org/TR/REC-html40'>"+
        `<head><meta charset='utf-8'><title>Export HTML to Word</title><style>body{font-family: 'Inter', sans-serif;} h1,h2,h3,h4,h5,h6{font-family: 'Playfair Display', serif;}</style></head><body>`;
    const footer = '</body></html>';
    const sourceHTML = header+content+footer;

    const source = 'data:application/vnd.ms-word;charset=utf-8,' + encodeURIComponent(sourceHTML);
    const fileDownload = document.createElement('a');
    document.body.appendChild(fileDownload);
    fileDownload.href = source;
    fileDownload.download = 'document.doc';
    fileDownload.click();
    document.body.removeChild(fileDownload);
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const fileContent = e.target?.result;
        if (fileContent) {
          if (file.name.endsWith('.docx')) {
            try {
              const mammothResult = await mammoth.convertToHtml({ arrayBuffer: fileContent as ArrayBuffer });
              if (editorRef.current) {
                editorRef.current.innerHTML += mammothResult.value;
              }
            } catch (error) {
              console.error('Error converting .docx to HTML:', error);
            }
          } else if (file.type.startsWith('image/')) {
            if (editorRef.current) {
              editorRef.current.innerHTML += `<img src="${fileContent}" />`;
            }
          } else {
            if (editorRef.current) {
              editorRef.current.innerHTML += fileContent as string;
            }
          }
        }
      };
      if (file.name.endsWith('.docx')) {
        reader.readAsArrayBuffer(file);
      } else if (file.type.startsWith('image/')) {
        reader.readAsDataURL(file);
      } else {
        reader.readAsText(file);
      }
    }
  };

  if (!isClient) {
    return null;
  }

  return (
    <div className='flex flex-col h-screen bg-gray-900 text-gray-100 font-sans'>
      <header className='flex items-center justify-between px-6 py-3 border-b border-gray-800 shrink-0'>
        <div className='flex items-center gap-3'>
          <Wand2 className='w-6 h-6 text-blue-500' />
          <h1 className="text-2xl font-['Playwrite_IT_Moderna'] font-bold text-white">
            B.A.M.B.A.I
          </h1>
        </div>
        <div className='flex items-center gap-4'>
          <Button variant='outline' className='border-gray-700' onClick={() => fileInputRef.current?.click()}>
            Upload
            <Upload className='w-4 h-4 ml-2' />
          </Button>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            className="hidden"
            accept=".txt,.md,.html,.docx,image/*"
          />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant='outline' className='border-gray-700'>
                Export
                <Download className='w-4 h-4 ml-2' />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={handleExportPdf}>
                <FileText className='w-4 h-4 mr-2' />
                Export to PDF
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleExportWord}>
                <FileText className='w-4 h-4 mr-2' />
                Export to Word
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <div className='flex-1 grid md:grid-cols-[300px_1fr] overflow-hidden'>
        <AiToolsSidebar />

        <main className='relative flex-1 flex flex-col overflow-hidden p-8 md:p-12' onMouseUp={handleMouseUp}>
          {showIcon && <TextSelectionIcon top={menuPosition.top} left={menuPosition.left} onClick={handleIconClick} />}
          {showMenu && (
            <TextSelectionMenu
              top={menuPosition.top}
              left={menuPosition.left}
              onAction={handleAIAction}
              onClose={() => setShowMenu(false)}
            />
          )}
          <div
            ref={editorRef}
            contentEditable
            suppressContentEditableWarning
            className={cn(
              'prose dark:prose-invert prose-lg max-w-[85%] w-full h-full focus:outline-none overflow-y-auto bg-gray-800/30 rounded-lg p-6',
              { 'opacity-60': isLoading }
            )}
          />
          <div className="floating-toolbar-container">
            <FloatingToolbar onAction={handleFloatingBarAction} />
          </div>
        </main>
      </div>
    </div>
  );
}
