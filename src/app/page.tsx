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
  FileDown,
  Bot,
  Sparkles,
  BookCheck,
  Loader2,
  Wand2,
  FileText,
  ChevronDown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { jsPDF } from "jspdf";
import html2canvas from "html2canvas";

declare global {
  interface Window {
    MathJax: {
      typesetPromise: () => Promise<void>;
    };
  }
}

export default function Home() {
  const [topic, setTopic] = useState("An essay about the future of space exploration");
  const [styleGuide, setStyleGuide] = useState<"APA" | "IEEE">("APA");
  const [documentContent, setDocumentContent] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const editorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setDocumentContent(`<h1>The Future of Space Exploration</h1><p>Start writing your document here or generate content using the AI tools. You can include mathematical formulas like this: \\( F = G \\frac{m_1 m_2}{r^2} \\). The editor will render them beautifully.</p>`);
  }, []);

  useEffect(() => {
    if (documentContent && typeof window !== "undefined" && window.MathJax) {
      window.MathJax.typesetPromise();
    }
  }, [documentContent]);
  
  const handleAiAction = async (
    action: () => Promise<any>,
    successCallback: (result: any) => void,
    loadingMessage: string
  ) => {
    setIsLoading(true);
    const toastId = toast({
      title: "Processing...",
      description: (
        <div className="flex items-center gap-2">
          <Loader2 className="animate-spin" />
          <span>{loadingMessage}</span>
        </div>
      ),
      duration: 120000,
    }).id;
    try {
      const result = await action();
      successCallback(result);
      toast({
        title: "Success",
        description: "Your document has been updated.",
      });
    } catch (error) {
      console.error(error);
      toast({
        variant: "destructive",
        title: "Error",
        description:
          "An error occurred while processing your request. Please try again.",
      });
    } finally {
      setIsLoading(false);
      toast({id: toastId, open: false});
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
     const selection = window.getSelection()?.toString();
     const feedback = selection && selection.length > 5 ? `Improve the following selected text: "${selection}"` : "Make the entire document more engaging.";
    
    handleAiAction(
      () => enhanceDocument({ documentContent, feedback }),
      (result) => setDocumentContent(result.enhancedDocumentContent),
      "Enhancing document..."
    );
  };

  const handleExportPdf = async () => {
    if (!editorRef.current) return;
    
    setIsLoading(true);
    toast({ title: "Exporting PDF...", description: "Please wait..." });

    try {
      const content = editorRef.current;
      const canvas = await html2canvas(content, {
          scale: 2,
          backgroundColor: null, 
          useCORS: true,
      });

      const pdf = new jsPDF({
          orientation: 'p',
          unit: 'px',
          format: [canvas.width, canvas.height]
      });
      
      const imgData = canvas.toDataURL('image/png');
      pdf.addImage(imgData, 'PNG', 0, 0, canvas.width, canvas.height);
      pdf.save("document.pdf");
      
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
    if (!documentContent) return;

    const header = "<html xmlns:o='urn:schemas-microsoft-com:office:office' "+
        "xmlns:w='urn:schemas-microsoft-com:office:word' "+
        "xmlns='http://www.w3.org/TR/REC-html40'>"+
        "<head><meta charset='utf-8'><title>Export HTML to Word</title></head><body>";
    const footer = "</body></html>";
    const sourceHTML = header+documentContent+footer;

    const source = 'data:application/vnd.ms-word;charset=utf-8,' + encodeURIComponent(sourceHTML);
    const fileDownload = document.createElement("a");
    document.body.appendChild(fileDownload);
    fileDownload.href = source;
    fileDownload.download = 'document.doc';
    fileDownload.click();
    document.body.removeChild(fileDownload);
  };


  return (
    <div className="flex flex-col h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 font-sans">
      <header className="flex items-center justify-between px-6 py-3 border-b border-gray-200 dark:border-gray-800">
        <div className="flex items-center gap-3">
          <Wand2 className="w-7 h-7 text-blue-600" />
          <h1 className="text-2xl font-serif font-bold text-gray-800 dark:text-white">
            DocuGen AI
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

      <main className="flex-1 flex justify-center p-4 sm:p-6 md:p-8 overflow-y-auto">
        <div className="w-full max-w-4xl">
          {/* AI Toolbar */}
          <div className="sticky top-0 z-10 mb-6 bg-gray-50/80 dark:bg-gray-900/80 backdrop-blur-sm p-4 rounded-lg border border-gray-200 dark:border-gray-700 shadow-md flex flex-wrap items-center gap-4 justify-between">
            <div className="flex-grow min-w-[200px]">
              <Textarea
                  id="topic"
                  placeholder="Enter a topic to generate content..."
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  className="bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600"
                  rows={1}
                />
            </div>
            <div className="flex items-center gap-2">
              <Select
                  value={styleGuide}
                  onValueChange={(value: "APA" | "IEEE") =>
                    setStyleGuide(value)
                  }
                  disabled={isLoading}
                >
                  <SelectTrigger id="style-guide" className="w-[120px] bg-white dark:bg-gray-800">
                    <SelectValue placeholder="Style" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="APA">APA</SelectItem>
                    <SelectItem value="IEEE">IEEE</SelectItem>
                  </SelectContent>
              </Select>
              <Button onClick={handleGenerate} disabled={isLoading} variant="outline" title="Generate Content">
                <Bot />
              </Button>
              <Button onClick={handleFormat} disabled={isLoading} variant="outline" title="Format Document">
                 <BookCheck />
              </Button>
              <Button onClick={handleEnhance} disabled={isLoading} variant="outline" title="Enhance with AI">
                <Sparkles />
              </Button>
            </div>
          </div>
          
          {/* Editor */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8 md:p-12 min-h-[calc(100vh-250px)]">
             <div
                ref={editorRef}
                contentEditable={!isLoading}
                onInput={(e) => setDocumentContent(e.currentTarget.innerHTML)}
                dangerouslySetInnerHTML={{ __html: documentContent }}
                className={cn(
                  "prose dark:prose-invert prose-lg max-w-full w-full h-full focus:outline-none",
                  "prose-headings:font-serif prose-h1:text-4xl prose-h2:text-3xl prose-h3:text-2xl",
                  { "opacity-60 cursor-not-allowed": isLoading }
                )}
              />
          </div>
        </div>
      </main>
    </div>
  );
}
