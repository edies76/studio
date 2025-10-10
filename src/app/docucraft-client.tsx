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
  Download,
} from "lucide-react";
import { cn } from "@/lib/utils";
import jsPDF from "jspdf";
import { EnhancementToolbar } from "@/components/ui/enhancement-toolbar";


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
  const [documentContent, setDocumentContent] = useState("");
  const [topic, setTopic] = useState("");
  const [styleGuide, setStyleGuide] = useState("APA");
  const [enhancementFeedback, setEnhancementFeedback] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [activeTool, setActiveTool] = useState<
    "generate" | "format" | "enhance" | null
  >(null);
  const { toast } = useToast();
  
  const editorRef = useRef<HTMLDivElement>(null);

  const [selection, setSelection] = useState<Selection | null>(null);
  const [toolbarPosition, setToolbarPosition] = useState<{ top: number; left: number } | null>(null);


  useEffect(() => {
    setDocumentContent(initialContent);
  }, []);

  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== documentContent) {
        editorRef.current.innerHTML = documentContent;
    }
  }, [documentContent]);


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

  const handleUpdateContent = (content: string) => {
    setDocumentContent(content);
  };

  const handleGenerateContent = async () => {
    if (!topic) {
      toast({
        variant: "destructive",
        title: "Topic is required",
        description: "Please enter a topic to generate content.",
      });
      return;
    }
    setIsLoading(true);
    setActiveTool("generate");
    const { dismiss } = toast({ description: "Generating content..." });
    try {
      const result = await generateDocumentContent({ topic });
      handleUpdateContent(result.content);
      toast({ title: "Success", description: "Content generated successfully." });
    } catch (error) {
      console.error(error);
      toast({
        variant: "destructive",
        title: "Uh oh! Something went wrong.",
        description: "Could not generate content.",
      });
    } finally {
      setIsLoading(false);
      setActiveTool(null);
      dismiss();
    }
  };

  const handleFormatDocument = async () => {
    setIsLoading(true);
    setActiveTool("format");
    const { dismiss } = toast({ description: "Formatting document..." });
    try {
      const result = await autoFormatDocument({
        documentContent: editorRef.current?.innerHTML || documentContent,
        styleGuide: styleGuide as "APA" | "IEEE",
      });
      handleUpdateContent(result.formattedDocument);
      toast({ title: "Success", description: "Document formatted." });
    } catch (error) {
      console.error(error);
      toast({
        variant: "destructive",
        title: "Uh oh! Something went wrong.",
        description: "Could not format document.",
      });
    } finally {
      setIsLoading(false);
      setActiveTool(null);
      dismiss();
    }
  };

  const handleSelectionChange = () => {
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
      const range = sel.getRangeAt(0);
      if (!range.collapsed && editorRef.current?.contains(range.commonAncestorContainer)) {
        setSelection(sel);
        const rect = range.getBoundingClientRect();
        if (editorRef.current) {
          const editorRect = editorRef.current.getBoundingClientRect();
          setToolbarPosition({
            top: rect.top - editorRect.top - 40, // Position above the selection
            left: rect.left - editorRect.left + rect.width / 2,
          });
        }
      } else {
        setSelection(null);
        setToolbarPosition(null);
      }
    }
  };

  const handleEnhanceSelection = async () => {
    if (!selection || !enhancementFeedback) {
      toast({
        variant: "destructive",
        title: "Selection and Feedback required",
        description: "Please select text and provide enhancement feedback.",
      });
      return;
    }

    const selectedText = selection.toString();
    setIsLoading(true);
    setActiveTool("enhance");
    const { dismiss } = toast({ description: "Enhancing selection..." });

    try {
      const result = await enhanceDocument({
        documentContent: selectedText,
        feedback: enhancementFeedback,
      });

      const range = selection.getRangeAt(0);
      range.deleteContents();
      const newContentNode = document.createElement("span");
      newContentNode.innerHTML = result.enhancedDocumentContent;
      // Insert all children of the new node at the range
      // This is to avoid inserting a span into a block element like a p
      Array.from(newContentNode.childNodes).reverse().forEach(child => {
          range.insertNode(child);
      });
      
      handleUpdateContent(editorRef.current?.innerHTML || "");
      toast({ title: "Success", description: "Selection enhanced." });
    } catch (error) {
      console.error("Enhancement failed", error);
      toast({
        variant: "destructive",
        title: "Enhancement failed",
        description: "Could not enhance the selected text.",
      });
    } finally {
      setIsLoading(false);
      setActiveTool(null);
      setSelection(null);
      setToolbarPosition(null);
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
          <Wand2 className="w-6 h-6 text-blue-500" />
          <h1 className="text-2xl font-['Playwrite_IT_Moderna'] font-bold text-white">
            bamba
          </h1>
        </div>
        <div className="flex items-center gap-4">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon">
                <Download className="w-5 h-5" />
                <span className="sr-only">Export</span>
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

      <div className="flex-1 grid md:grid-cols-[500px_1fr] overflow-hidden">
        {/* AI Tools Panel */}
        <aside className="p-6 bg-gray-900/50 border-r border-gray-800 flex flex-col gap-6">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Bot className="w-5 h-5" /> AI Tools
          </h2>
          <div className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="topic" className="text-sm font-medium">
                Topic
              </label>
              <Textarea
                id="topic"
                placeholder="e.g., 'The history of artificial intelligence'"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                className="bg-gray-800 border-gray-700 h-24"
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="style-guide" className="text-sm font-medium">
                Style Guide
              </label>
              <Select
                value={styleGuide}
                onValueChange={setStyleGuide}
              >
                <SelectTrigger id="style-guide" className="bg-gray-800 border-gray-700">
                  <SelectValue placeholder="Select style" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="APA">APA</SelectItem>
                  <SelectItem value="IEEE">IEEE</SelectItem>
                </SelectContent>
              </Select>
            </div>
             <div className="space-y-2">
              <label htmlFor="enhancement-feedback" className="text-sm font-medium">
                Enhancement Feedback
              </label>
              <Textarea
                id="enhancement-feedback"
                placeholder="e.g., 'Make this sound more professional'"
                value={enhancementFeedback}
                onChange={(e) => setEnhancementFeedback(e.target.value)}
                className="bg-gray-800 border-gray-700 h-24"
              />
            </div>
          </div>
          <div className="flex flex-col gap-3 mt-auto">
            <Button
              onClick={handleGenerateContent}
              disabled={isLoading}
              className="w-full"
            >
              {isLoading && activeTool === "generate" ? (
                <Loader2 className="animate-spin" />
              ) : (
                <Sparkles className="mr-2" />
              )}
              Generate Content
            </Button>
            <Button
              onClick={handleFormatDocument}
              disabled={isLoading}
              variant="outline"
              className="w-full"
            >
              {isLoading && activeTool === "format" ? (
                <Loader2 className="animate-spin" />
              ) : (
                <BookCheck className="mr-2" />
              )}
              Format Document
            </Button>
          </div>
        </aside>

        {/* Editor Panel */}
        <main className="flex-1 flex flex-col overflow-hidden p-8 md:p-12">
          <div className="relative w-full h-full">
            {toolbarPosition && (
              <EnhancementToolbar
                style={{ top: toolbarPosition.top, left: toolbarPosition.left }}
                onEnhance={handleEnhanceSelection}
                isLoading={isLoading && activeTool === 'enhance'}
              />
            )}
            <div
              ref={editorRef}
              contentEditable
              suppressContentEditableWarning
              onInput={(e) => handleUpdateContent(e.currentTarget.innerHTML)}
              onMouseUp={handleSelectionChange}
              onKeyUp={handleSelectionChange}
              className={cn(
                "prose dark:prose-invert prose-lg max-w-none w-full h-full focus:outline-none overflow-y-auto bg-gray-800/30 rounded-lg p-6",
                { "opacity-60": isLoading }
              )}
            />
          </div>
        </main>
      </div>
    </div>
  );
}

    