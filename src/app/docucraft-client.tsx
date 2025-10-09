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

// Dummy Rich Text Editor Component (simulating a real one)
const RichTextEditor = ({ value, onChange, className, disabled, editorRef }: { value: string, onChange: (value: string) => void, className?: string, disabled?: boolean, editorRef: React.RefObject<HTMLDivElement> }) => {
  
  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== value) {
      editorRef.current.innerHTML = value;
    }
  }, [value, editorRef]);

  const handleInput = (e: React.FormEvent<HTMLDivElement>) => {
    onChange(e.currentTarget.innerHTML);
  };
  
  return (
    <div
      ref={editorRef}
      contentEditable={!disabled}
      onInput={handleInput}
      className={className}
      suppressContentEditableWarning={true}
    />
  )
};

export default function DocuCraftClient() {
  const [topic, setTopic] = useState("An essay about the future of space exploration");
  const [styleGuide, setStyleGuide] = useState<"APA" | "IEEE">("APA");
  const [documentContent, setDocumentContent] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const { toast } = useToast();
  const editorRef = useRef<HTMLDivElement>(null);

  const [selection, setSelection] = useState<Range | null>(null);
  const [showAiToolbar, setShowAiToolbar] = useState(false);
  const [toolbarPosition, setToolbarPosition] = useState({ top: 0, left: 0 });

  useEffect(() => {
    const initialContent = `<h1>The Future of Space Exploration</h1><p>Start writing your document here or generate content using the AI tools. You can include mathematical formulas like this: \\( F = G \\frac{m_1 m_2}{r^2} \\). The editor will render them beautifully.</p>`;
    setDocumentContent(initialContent);
  }, []);

  useEffect(() => {
    const typesetMath = async () => {
      if (editorRef.current && window.MathJax) {
        try {
          await window.MathJax.startup.promise;
          await window.MathJax.typesetPromise([editorRef.current]);
        } catch (err) {
          console.error("MathJax typesetting failed:", err);
        }
      }
    };
    if (documentContent) {
        typesetMath();
    }
  }, [documentContent]);

  useEffect(() => {
    const handleMouseUp = () => {
      const sel = window.getSelection();
      if (sel && sel.rangeCount > 0) {
        const range = sel.getRangeAt(0);
        const editorDiv = editorRef.current;
        
        if (editorDiv && editorDiv.contains(range.commonAncestorContainer) && !range.collapsed) {
          setSelection(range.cloneRange());
          const rect = range.getBoundingClientRect();
          setToolbarPosition({
            top: window.scrollY + rect.top - 40, // Position toolbar above selection
            left: window.scrollX + rect.left + (rect.width / 2) - 30,
          });
          setShowAiToolbar(true);
        } else {
          setShowAiToolbar(false);
          setSelection(null);
        }
      }
    };
  
    const handleClickOutside = (event: MouseEvent) => {
        const editorDiv = editorRef.current;
        const toolbar = document.getElementById('ai-toolbar');
        if (editorDiv && !editorDiv.contains(event.target as Node) && toolbar && !toolbar.contains(event.target as Node)) {
            setShowAiToolbar(false);
            setSelection(null);
        }
    }

    document.addEventListener("mouseup", handleMouseUp);
    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      document.removeEventListener("mouseup", handleMouseUp);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);


  const handleAiAction = async (
    action: () => Promise<any>,
    successCallback: (result: any) => void,
    loadingMessage: string
  ) => {
    setIsLoading(true);
    const { id, dismiss } = toast({
      description: (
        <div className="flex items-center gap-2">
          <Loader2 className="animate-spin" />
          <span>{loadingMessage}</span>
        </div>
      ),
      duration: 120000,
    });
    try {
      const result = await action();
      successCallback(result);
      dismiss();
      toast({
        title: "Success",
        description: "Your document has been updated.",
        duration: 3000,
      });
    } catch (error) {
      console.error(error);
      dismiss();
      toast({
        variant: "destructive",
        title: "Error",
        description:
          "An error occurred while processing your request. Please try again.",
        duration: 5000,
      });
    } finally {
      setIsLoading(false);
      setShowAiToolbar(false);
    }
  };

  const handleGenerate = () => {
    handleAiAction(
      () => generateDocumentContent({ topic, includeFormulas: true }),
      (result) => setDocumentContent(result.content),
      "Generating content..."
    );
  };

  const handleFormat = () => {
    handleAiAction(
      () => autoFormatDocument({ documentContent, styleGuide }),
      (result) => setDocumentContent(result.formattedDocument),
      `Applying ${styleGuide} format...`
    );
  };
  
  const handleEnhance = () => {
    const activeSelection = selection || (window.getSelection()?.rangeCount || 0 > 0 ? window.getSelection()!.getRangeAt(0) : null);
    if (!activeSelection) return;

    const selectionText = activeSelection.toString();
    const feedback = `Make this more engaging and professional: "${selectionText}"`;
    
    handleAiAction(
      () => enhanceDocument({ documentContent: selectionText, feedback }),
      (result) => {
        if (!activeSelection.collapsed) {
            activeSelection.deleteContents();
            const enhancedNode = document.createElement('span');
            enhancedNode.innerHTML = result.enhancedDocumentContent;
            activeSelection.insertNode(enhancedNode);
            // After inserting, we need to update the main state
            setDocumentContent(editorRef.current?.innerHTML || "");
        } else {
            // This case might not be ideal if there's no selection,
            // but as a fallback, we replace the whole content.
            setDocumentContent(result.enhancedDocumentContent);
        }
      },
      "Enhancing selection..."
    );
  };

  const handleExportPdf = async () => {
    if (!editorRef.current) return;
    setIsLoading(true);
    toast({ description: "Exporting PDF..." });
  
    try {
      await window.MathJax.startup.promise;
      await window.MathJax.typesetPromise([editorRef.current]);
  
      const pdf = new jsPDF({
        orientation: "p",
        unit: "pt",
        format: "a4",
      });
      
      const contentToExport = editorRef.current.cloneNode(true) as HTMLElement;
      
      // Force white background and black text for PDF
      contentToExport.style.backgroundColor = 'white';
      contentToExport.style.padding = '35px';
      contentToExport.style.fontFamily = 'Times-Roman, serif'
      
      Array.from(contentToExport.querySelectorAll('*')).forEach(el => {
        const htmlEl = el as HTMLElement;
        htmlEl.style.color = 'black';
        htmlEl.style.fontFamily = 'Lora, serif'
      });
      
      // We need to append to body for jspdf to correctly render it.
      document.body.appendChild(contentToExport);
  
      await pdf.html(contentToExport, {
        callback: function (doc) {
          doc.save("document.pdf");
        },
        width: 525,
        windowWidth: contentToExport.offsetWidth,
        autoPaging: 'text'
      });
  
      document.body.removeChild(contentToExport);
  
      toast({ title: "Success", description: "PDF exported successfully." });
    } catch (error) {
      console.error("Error exporting PDF:", error);
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

    const header = "<html xmlns:o='urn:schemas-microsoft-com:office:office' "+
        "xmlns:w='urn:schemas-microsoft-com:office:word' "+
        "xmlns:m='http://schemas.openxmlformats.org/office/2006/math' "+
        "xmlns='http://www.w3.org/TR/REC-html40'>"+
        `<head><meta charset='utf-8'><title>Export HTML to Word</title><style>body{font-family: 'Lora', serif;} h1,h2,h3,h4,h5,h6{font-family: 'Lora', serif;}</style></head><body>`;
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
          <h1 className="text-2xl font-serif font-bold text-white">
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
      
      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel: AI Controls */}
        <aside className="w-1/3 max-w-[450px] min-w-[350px] flex flex-col p-6 bg-gray-800/50 border-r border-gray-700 overflow-y-auto">
          <h2 className="text-lg font-semibold mb-4 text-white flex items-center gap-2"><Bot size={20}/> AI Tools</h2>
          <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-2">
              <label htmlFor="topic" className="text-sm font-medium text-gray-400">Topic</label>
              <Textarea
                  id="topic"
                  placeholder="e.g., The history of artificial intelligence"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  className="bg-gray-900 border-gray-600 focus:ring-blue-500 focus:border-blue-500"
                  rows={3}
              />
            </div>

             <div className="flex flex-col gap-2">
                <label htmlFor="style-guide" className="text-sm font-medium text-gray-400">Style Guide</label>
                <Select
                  value={styleGuide}
                  onValueChange={(value: "APA" | "IEEE") => setStyleGuide(value)}
                  disabled={isLoading}
                >
                  <SelectTrigger id="style-guide" className="bg-gray-900 border-gray-600">
                    <SelectValue placeholder="Style" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="APA">APA</SelectItem>
                    <SelectItem value="IEEE">IEEE</SelectItem>
                  </SelectContent>
                </Select>
            </div>

            <div className="flex flex-col gap-2">
                <Button onClick={handleGenerate} disabled={isLoading} className="w-full justify-start">
                  <Sparkles className="mr-2"/> Generate Content
                </Button>
                <Button onClick={handleFormat} disabled={isLoading} variant="outline" className="w-full justify-start">
                   <BookCheck className="mr-2"/> Format Document
                </Button>
            </div>
          </div>
        </aside>

        {/* Editor Panel */}
        <main className="flex-1 flex flex-col overflow-hidden relative">
          {showAiToolbar && (
            <div
              id="ai-toolbar"
              className="absolute z-10 bg-gray-800 rounded-md shadow-lg p-1 flex gap-1"
              style={{ top: toolbarPosition.top, left: toolbarPosition.left }}
              onMouseDown={(e) => e.preventDefault()} // Prevent editor from losing focus
            >
              <Button variant="ghost" size="icon" onClick={handleEnhance} title="Enhance Selection" className="h-8 w-8">
                <Sparkles className="h-4 w-4" />
              </Button>
            </div>
          )}
          <RichTextEditor
            editorRef={editorRef}
            value={documentContent}
            onChange={setDocumentContent}
            disabled={isLoading}
            className={cn(
              "prose dark:prose-invert prose-lg max-w-none w-full h-full focus:outline-none p-8 md:p-12 overflow-y-auto bg-[#1e1e1e]",
              "prose-p:text-gray-300 prose-headings:text-white prose-headings:font-serif prose-h1:text-4xl prose-h2:text-3xl prose-h3:text-2xl prose-a:text-blue-400 prose-strong:text-white",
              { "opacity-60": isLoading }
            )}
          />
        </main>
      </div>
    </div>
  );
}
