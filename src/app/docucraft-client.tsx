"use client";

import { useState, useEffect, useRef } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import {
  FileText,
  Bot,
  Sparkles,
  BookCheck,
  Loader2,
  Wand2,
  ChevronDown,
  Paperclip,
  Send,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { jsPDF } from "jspdf";

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

const initialContent = `<h1>The Future of Space Exploration</h1><p>Start writing your document here or generate content using the AI tools. You can include mathematical formulas like this: \\( F = G \\frac{m_1 m_2}{r^2} \\). The editor will render them beautifully.</p>`;

// MOCK
const useDocument = (id: string) => {
    const [document, setDocument] = useState({ 
        id: '1', 
        name: 'My Document', 
        content: initialContent,
    });
    
    // In a real scenario, this would use onSnapshot from Firestore
    // For now, we just return a static object.
    
    return document;
};


export default function DocuCraftClient() {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  
  const doc = useDocument("doc1"); // Hardcoded doc ID for now
  const [documentContent, setDocumentContent] = useState(initialContent);
  const previewRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setDocumentContent(doc.content);
  }, [doc.content]);

  useEffect(() => {
    const typesetMath = async () => {
      if (previewRef.current && window.MathJax) {
        try {
          await window.MathJax.startup.promise;
          await window.MathJax.typesetPromise([previewRef.current]);
        } catch (err) {
          console.error("MathJax typesetting failed:", err);
        }
      }
    };
    if (documentContent) {
        typesetMath();
    }
  }, [documentContent]);

  const handleUpdateContent = (content: string) => {
    // In the future, this will call update_textdoc() Cloud Function
    setDocumentContent(content);
  };
  
  const handleExportPdf = async () => {
    if (!previewRef.current) return;
    setIsLoading(true);
    const { id, dismiss } = toast({ description: "Exporting PDF..." });
  
    try {
      await window.MathJax.startup.promise;
      await window.MathJax.typesetPromise([previewRef.current]);
  
      const pdf = new jsPDF({
        orientation: "p",
        unit: "pt",
        format: "a4",
      });
  
      const contentToExport = previewRef.current.cloneNode(true) as HTMLElement;
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
    if (!previewRef.current) return;
    let content = previewRef.current.innerHTML;

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
                parent.replaceChild(span.firstChild!, mjx);
            }
        }
    });

    content = tempDiv.innerHTML;

    const header = "<html xmlns:o='urn:schemas-microsoft-com:office:office' "+
        "xmlns:w='urn:schemas-microsoft-com:office:word' "+
        "xmlns:m='http://schemas.openxmlformats.org/office/2006/math' "+
        "xmlns='http://www.w3.org/TR/REC-html40'>"+
        `<head><meta charset='utf-8'><title>Export HTML to Word</title><style>body{font-family: 'Inter', sans-serif;} h1,h2,h3,h4,h5,h6{font-family: 'Lora', serif;}</style></head><body>`;
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
          <Wand2 className="w-7 h-7 text-blue-500" />
          <h1 className="text-3xl font-['Great_Vibes'] text-white">
            bamba
          </h1>
        </div>
        <div className="flex items-center gap-4">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button>
                Export
                <ChevronDown className="w-4 h-4 ml-2" />
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
          <img
            src="https://picsum.photos/seed/user/32/32"
            alt="User"
            className="rounded-full w-8 h-8"
          />
        </div>
      </header>
      
      <div className="flex-1 grid grid-cols-2 overflow-hidden">
        {/* Left Panel: Chat */}
        <aside className="flex flex-col p-6 bg-gray-800/50 border-r border-gray-700">
            <div className="flex-1 overflow-y-auto space-y-4">
                {/* Chat messages will go here */}
                <div className="p-4 bg-gray-700/50 rounded-lg">
                    <p className="text-sm text-gray-300">Welcome to bamba! Give me instructions to edit the document.</p>
                </div>
            </div>
            <div className="mt-4 flex items-center gap-2">
                <Button variant="ghost" size="icon">
                    <Paperclip className="h-5 w-5" />
                </Button>
                <Textarea placeholder="e.g., 'Rewrite the first paragraph to be more concise.'" className="bg-gray-900 border-gray-600 focus:ring-blue-500 focus:border-blue-500" rows={1}/>
                <Button>
                    <Send className="h-5 w-5" />
                </Button>
            </div>
        </aside>

        {/* Editor Panel */}
        <main className="flex-1 grid grid-rows-2 overflow-hidden relative">
            {/* Source Editor */}
            <div className="flex flex-col h-full">
                <div className="p-2 border-b border-gray-700 text-sm font-medium text-gray-400">Editor</div>
                <Textarea 
                    value={documentContent}
                    onChange={(e) => handleUpdateContent(e.target.value)}
                    className="flex-1 w-full h-full bg-[#1e1e1e] border-0 rounded-none focus-visible:ring-0"
                    placeholder="Start writing your HTML content..."
                />
            </div>

            {/* Live Preview */}
            <div className="flex flex-col h-full border-t border-gray-700">
                <div className="p-2 border-b border-gray-700 text-sm font-medium text-gray-400">Preview</div>
                <div
                    ref={previewRef}
                    className={cn(
                        "prose dark:prose-invert prose-lg max-w-none w-full h-full focus:outline-none p-8 md:p-12 overflow-y-auto bg-[#1e1e1e]",
                        "prose-p:text-gray-300 prose-headings:text-white prose-headings:font-serif prose-h1:text-4xl prose-h2:text-3xl prose-h3:text-2xl prose-a:text-blue-400 prose-strong:text-white font-sans prose-code:text-blue-400 prose-code:bg-gray-700/50 prose-code:p-1 prose-code:rounded-sm",
                        { "opacity-60": isLoading }
                    )}
                    dangerouslySetInnerHTML={{ __html: documentContent }}
                />
            </div>
        </main>
      </div>
    </div>
  );
}
