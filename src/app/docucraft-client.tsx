"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { generateDocumentContent } from "@/ai/flows/generate-document-content";
import { autoFormatDocument } from "@/ai/flows/auto-format-document";
import { enhanceDocument } from "@/ai/flows/enhance-document";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import AiToolsSidebar from "@/components/ai-tools-sidebar";
import FloatingToolbar from "@/components/ui/floating-toolbar";
import TextSelectionIcon from "@/components/ui/text-selection-icon";
import TextSelectionMenu from "@/components/ui/text-selection-menu";
import { useToast } from "@/hooks/use-toast";
import {
  FileText,
  Download,
  Wand2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import jsPDF from "jspdf";

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

const initialContent = `<h1>The Future of Space Exploration</h1><p>Start writing your document here or generate content using the AI tools.</p>`;

export default function DocuCraftClient() {
  const [documentContent, setDocumentContent] = useState(initialContent);
  const [isLoading, setIsLoading] = useState(false);
  const [showIcon, setShowIcon] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });
  
  const selectionRef = useRef<Range | null>(null);
  const { toast } = useToast();
  const editorRef = useRef<HTMLDivElement>(null);

  const typesetMath = useCallback(() => {
    if (editorRef.current && window.MathJax) {
        window.MathJax.startup.promise.then(() => {
            window.MathJax.typesetPromise([editorRef.current!]).catch((err) => {
                console.error("MathJax typesetting failed:", err);
            });
        });
    }
  }, []);

  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== documentContent) {
      editorRef.current.innerHTML = documentContent;
      typesetMath();
    }
  }, [documentContent, typesetMath]);


  const handleMouseUp = () => {
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
    if (action === 'grammar') {
        handleGrammarCheck();
    } else {
        handleAIAction(action);
    }
  };

  const handleGrammarCheck = async () => {
    if (!editorRef.current) return;
    setIsLoading(true);
    const { dismiss } = toast({ description: "Checking grammar for the entire document..." });
    try {
      const result = await enhanceDocument({
        documentContent: editorRef.current.innerText,
        feedback: "Fix all grammar and spelling mistakes in the text. Only return the corrected text.",
      });
      setDocumentContent(result.enhancedDocumentContent);
      toast({ title: "Success", description: "Grammar check completed." });
    } catch (error) {
      console.error(error);
      toast({ variant: "destructive", title: "Error", description: "Could not perform grammar check." });
    } finally {
      setIsLoading(false);
      dismiss();
    }
  };

  const handleAIAction = async (action: string, value?: string) => {
    let prompt = '';
    const selectedText = selectionRef.current?.toString() || '';

    if (!selectedText && action !== 'grammar') {
        toast({ variant: "destructive", description: "Please select text to perform this action." });
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
      case 'custom_prompt':
        prompt = value || '';
        break;
    }

    if (!prompt) return;

    setIsLoading(true);
    const { dismiss } = toast({ description: "AI is thinking..." });

    try {
      const result = await enhanceDocument({
        documentContent: selectedText,
        feedback: prompt,
      });

      if (editorRef.current && selectionRef.current) {
        const range = selectionRef.current;
        range.deleteContents();
        // Instead of inserting a text node, create a temporary element
        // to parse the HTML string and insert the nodes.
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = result.enhancedDocumentContent;
        const nodes = Array.from(tempDiv.childNodes);
        nodes.reverse().forEach(node => range.insertNode(node));
        // Reselect the newly inserted content
        const newRange = document.createRange();
        newRange.setStartBefore(nodes[nodes.length - 1]);
        newRange.setEndAfter(nodes[0]);
        const selection = window.getSelection();
        selection?.removeAllRanges();
        selection?.addRange(newRange);
        selectionRef.current = newRange;
      }

      toast({ title: "Success", description: "Text updated successfully." });
    } catch (error) {
      console.error(error);
      toast({
        variant: "destructive",
        title: "Uh oh! Something went wrong.",
        description: "Could not enhance text.",
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
    const { dismiss } = toast({ description: "Exporting PDF..." });
  
    try {
      if (window.MathJax) {
        await window.MathJax.startup.promise;
        await window.MathJax.typesetPromise([editorRef.current]);
      }
  
      const pdf = new jsPDF({
        orientation: "p",
        unit: "pt",
        format: "a4",
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
          doc.save("document.pdf");
          document.body.removeChild(contentToExport);
          dismiss();
          toast({ title: "Success", description: "PDF exported successfully." });
        },
        width: 525,
        windowWidth: contentToExport.scrollWidth,
        autoPaging: 'text'
      });
  
    } catch (error) {
      console.error("Error exporting PDF:", error);
      dismiss();
      toast({
        variant: "destructive",
        title: "Error",
        description: "Could not export PDF. Please try again.",
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
    const footer = "</body></html>";
    const sourceHTML = header+content+footer;

    const source = 'data:application/vnd.ms-word;charset=utf-8,' + encodeURIComponent(sourceHTML);
    const fileDownload = document.createElement("a");
    document.body.appendChild(fileDownload);
    fileDownload.href = source;
    fileDownload.download = 'document.doc';
    fileDownload.click();
    document.body.removeChild(fileDownload);
  };
  
  return (
    <div className="flex flex-col h-screen bg-gray-900 text-gray-100 font-sans">
      <header className="flex items-center justify-between px-6 py-3 border-b border-gray-800 shrink-0">
        <div className="flex items-center gap-3">
          <Wand2 className="w-6 h-6 text-blue-500" />
          <h1 className="text-2xl font-['Playwrite_IT_Moderna'] font-bold text-white">
            B.A.M.B.A.I
          </h1>
        </div>
        <div className="flex items-center gap-4">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="border-gray-700">
                Export
                <Download className="w-4 h-4 ml-2" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={handleExportPdf}>
                <FileText className="w-4 h-4 mr-2" />
                Export to PDF
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleExportWord}>
                <FileText className="w-4 h-4 mr-2" />
                Export to Word
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <div className="flex-1 grid md:grid-cols-[300px_1fr] overflow-hidden">
        <AiToolsSidebar />

        <main className="relative flex-1 flex flex-col overflow-hidden p-8 md:p-12" onMouseUp={handleMouseUp}>
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
              "prose dark:prose-invert prose-lg max-w-[85%] w-full h-full focus:outline-none overflow-y-auto bg-gray-800/30 rounded-lg p-6",
              { "opacity-60": isLoading }
            )}
          />
          <FloatingToolbar onAction={handleFloatingBarAction} />
        </main>
      </div>
    </div>
  );
}
