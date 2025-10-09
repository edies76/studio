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
  Bold,
  Italic,
  Code,
  Heading1,
  Heading2,
  List,
  ListOrdered,
  Link,
  Quote
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

// Function to convert LaTeX to OMML for Word
const latexToOm = (latex: string): string => {
  let omml = latex;
  omml = omml.replace(/\\frac{([^}]+)}{([^}]+)}/g, `<m:f><m:num><m:r><m:t>$1</m:t></m:r></m:num><m:den><m:r><m:t>$2</m:t></m:r></m:den></m:f>`);
  omml = omml.replace(/([a-zA-Z0-9]+)\^{([^}]+)}/g, `<m:sSup><m:e><m:r><m:t>$1</m:t></m:r></m:e><m:sup><m:r><m:t>$2</m:t></m:r></m:sup></m:sSup>`);
  omml = omml.replace(/([a-zA-Z0-9]+)_{([^}]+)}/g, `<m:sSub><m:e><m:r><m:t>$1</m:t></m:r></m:e><m:sub><m:r><m:t>$2</m:t></m:r></m:sub></m:sSub>`);
  return `<m:oMathPara xmlns:m="http://schemas.openxmlformats.org/office/2006/math"><m:oMath><m:r><m:t>${omml}</m:t></m:r></m:oMath></m:oMathPara>`;
};

const ToolbarButton = ({ onClick, children }: { onClick: (e: React.MouseEvent<HTMLButtonElement>) => void, children: React.ReactNode }) => (
    <Button variant="ghost" size="icon" onClick={onClick} onMouseDown={e => e.preventDefault()} className="w-8 h-8">
        {children}
    </Button>
);

export default function DocuCraftClient() {
  const [topic, setTopic] = useState("An essay about the future of space exploration");
  const [styleGuide, setStyleGuide] = useState<"APA" | "IEEE">("APA");
  const [documentContent, setDocumentContent] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const { toast } = useToast();
  const editorRef = useRef<HTMLDivElement>(null);

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
    typesetMath();
  }, [documentContent]);

  const applyFormat = (command: string, value: string | undefined = undefined) => {
    document.execCommand(command, false, value);
    editorRef.current?.focus();
    setDocumentContent(editorRef.current?.innerHTML || '');
  };

  const handleAiAction = async (
    action: () => Promise<any>,
    successCallback: (result: any) => void,
    loadingMessage: string
  ) => {
    setIsLoading(true);
    const { dismiss, update } = toast({
      description: (
        <div className="flex items-center gap-2 text-white">
          <Loader2 className="animate-spin" />
          <span>{loadingMessage}</span>
        </div>
      ),
      duration: 120000,
    });
    try {
      const result = await action();
      successCallback(result);
      update({
        id: 'ai-action-toast',
        title: "Success",
        description: "Your document has been updated.",
        duration: 5000,
      });
    } catch (error) {
      console.error(error);
      update({
        id: 'ai-action-toast',
        variant: "destructive",
        title: "Error",
        description:
          "An error occurred while processing your request. Please try again.",
        duration: 5000,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleGenerate = () => {
    handleAiAction(
      () => generateDocumentContent({ topic, includeFormulas: true }),
      (result) => {
        setDocumentContent(result.content);
      },
      "Generating content..."
    );
  };

  const handleFormat = () => {
    const currentContent = editorRef.current?.innerHTML || documentContent;
    handleAiAction(
      () => autoFormatDocument({ documentContent: currentContent, styleGuide }),
      (result) => {
        setDocumentContent(result.formattedDocument);
      },
      `Applying ${styleGuide} format...`
    );
  };
  
  const handleEnhance = () => {
    const selection = window.getSelection();
    let contentToEnhance = editorRef.current?.innerHTML || documentContent;
    let isSelection = false;

    if (selection && selection.toString().trim().length > 0) {
       contentToEnhance = selection.toString();
       isSelection = true;
    }

    const feedback = "Make this more engaging and professional.";

    handleAiAction(
      () => enhanceDocument({ documentContent: contentToEnhance, feedback }),
      (result) => {
        const enhancedContent = result.enhancedDocumentContent;
        if (isSelection && editorRef.current) {
            const range = selection!.getRangeAt(0);
            range.deleteContents();
            const div = document.createElement('div');
            div.innerHTML = enhancedContent;
            const frag = document.createDocumentFragment();
            let node, lastNode;
            while ((node = div.firstChild)) {
                lastNode = frag.appendChild(node);
            }
            range.insertNode(frag);
            setDocumentContent(editorRef.current.innerHTML);
        } else {
            setDocumentContent(enhancedContent);
        }
      },
      "Enhancing document..."
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
        
        const styles = `
            <style>
              body { 
                font-family: 'Inter', sans-serif; 
                color: #111;
                background-color: white;
              }
              h1, h2, h3, h4, h5, h6 { 
                font-family: 'Lora', serif; 
                color: #000;
              }
              .mjx-chtml {
                color: #000 !important;
              }
            </style>
        `;
        
        const contentToExport = `
          <html>
            <head>
              ${styles}
            </head>
            <body>
              ${editorRef.current.innerHTML}
            </body>
          </html>
        `;

        await pdf.html(contentToExport, {
            callback: function (doc) {
                doc.save("document.pdf");
            },
            x: 35,
            y: 35,
            width: 525,
            windowWidth: 1000,
            autoPaging: 'text'
        });

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
    let content = editorRef.current?.innerHTML || documentContent;
    content = content.replace(/\\\((.*?)\\\)/g, (match, latex) => latexToOm(latex));
    content = content.replace(/\\\[(.*?)\\\]/g, (match, latex) => latexToOm(latex));

    const header = "<html xmlns:o='urn:schemas-microsoft-com:office:office' "+
        "xmlns:w='urn:schemas-microsoft-com:office:word' "+
        "xmlns:m='http://schemas.openxmlformats.org/office/2006/math' "+
        "xmlns='http://www.w3.org/TR/REC-html40'>"+
        "<head><meta charset='utf-8'><title>Export HTML to Word</title><style>body{font-family: 'Lora', serif;} h1,h2,h3,h4,h5,h6{font-family: 'Lora', serif;}</style></head><body>";
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
        <aside className="w-1/4 max-w-[400px] min-w-[300px] flex flex-col p-6 bg-gray-800/50 border-r border-gray-700 overflow-y-auto">
          <h2 className="text-lg font-semibold mb-4 text-white">AI Tools</h2>
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
                  <Bot className="mr-2"/> Generate Content
                </Button>
                <Button onClick={handleFormat} disabled={isLoading} variant="outline" className="w-full justify-start">
                   <BookCheck className="mr-2"/> Format Document
                </Button>
                <Button onClick={handleEnhance} disabled={isLoading} variant="outline" className="w-full justify-start">
                  <Sparkles className="mr-2"/> Enhance
                </Button>
            </div>
          </div>
        </aside>

        {/* Editor Panel */}
        <div className="flex-1 flex flex-col overflow-hidden">
            <div className="flex items-center p-2 border-b border-gray-700 bg-gray-800 space-x-1">
                <ToolbarButton onClick={() => applyFormat('bold')}><Bold /></ToolbarButton>
                <ToolbarButton onClick={() => applyFormat('italic')}><Italic /></ToolbarButton>
                <ToolbarButton onClick={() => applyFormat('formatBlock', '<h1>')}><Heading1 /></ToolbarButton>
                <ToolbarButton onClick={() => applyFormat('formatBlock', '<h2>')}><Heading2 /></ToolbarButton>
                <ToolbarButton onClick={() => applyFormat('insertUnorderedList')}><List /></ToolbarButton>
                <ToolbarButton onClick={() => applyFormat('insertOrderedList')}><ListOrdered /></ToolbarButton>
                <ToolbarButton onClick={() => applyFormat('formatBlock', '<blockquote>')}><Quote/></ToolbarButton>
                <ToolbarButton onClick={() => {
                    const url = prompt('Enter a URL:');
                    if (url) applyFormat('createLink', url);
                }}><Link /></ToolbarButton>
                 <ToolbarButton onClick={() => applyFormat('formatBlock', '<pre>')}><Code /></ToolbarButton>
            </div>
            <div
                ref={editorRef}
                contentEditable={!isLoading}
                onInput={(e) => setDocumentContent(e.currentTarget.innerHTML)}
                dangerouslySetInnerHTML={{ __html: documentContent }}
                className={cn(
                    "prose dark:prose-invert prose-lg max-w-full w-full h-full focus:outline-none p-8 md:p-12 overflow-y-auto",
                    "prose-p:text-gray-300 prose-headings:text-white prose-headings:font-serif prose-h1:text-4xl prose-h2:text-3xl prose-h3:text-2xl prose-a:text-blue-400 prose-strong:text-white",
                    { "opacity-60 bg-gray-800": isLoading }
                )}
            />
        </div>
      </div>
    </div>
  );
}
