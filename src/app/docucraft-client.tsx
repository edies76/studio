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
import html2canvas from "html2canvas";

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
  // This is a simplified converter. A real implementation might need a more robust library.
  // For now, we'll handle basic fractions and superscripts/subscripts.
  let omml = latex;
  // Basic fraction \frac{a}{b} -> <m:f><m:num><m:r><m:t>a</m:t></m:r></m:num><m:den><m:r><m:t>b</m:t></m:r></m:den></m:f>
  omml = omml.replace(/\\frac{([^}]+)}{([^}]+)}/g, `<m:f><m:num><m:r><m:t>$1</m:t></m:r></m:num><m:den><m:r><m:t>$2</m:t></m:r></m:den></m:f>`);
  // Superscript x^y -> <m:sSup><m:e><m:r><m:t>x</m:t></m:r></m:e><m:sup><m:r><m:t>y</m:t></m:r></m:sup></m:sSup>
  omml = omml.replace(/([a-zA-Z0-9]+)\^{([^}]+)}/g, `<m:sSup><m:e><m:r><m:t>$1</m:t></m:r></m:e><m:sup><m:r><m:t>$2</m:t></m:r></m:sup></m:sSup>`);
  // Subscript x_y -> <m:sSub><m:e><m:r><m:t>x</m:t></m:r></m:e><m:sub><m:r><m:t>y</m:t></m:r></m:sub></m:sSub>
  omml = omml.replace(/([a-zA-Z0-9]+)_{([^}]+)}/g, `<m:sSub><m:e><m:r><m:t>$1</m:t></m:r></m:e><m:sub><m:r><m:t>$2</m:t></m:r></m:sub></m:sSub>`);

  return `<m:oMathPara xmlns:m="http://schemas.openxmlformats.org/office/2006/math"><m:oMath><m:r><m:t>${omml}</m:t></m:r></m:oMath></m:oMathPara>`;
};


export default function DocuCraftClient() {
  const [topic, setTopic] = useState("An essay about the future of space exploration");
  const [styleGuide, setStyleGuide] = useState<"APA" | "IEEE">("APA");
  const [documentContent, setDocumentContent] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [editedContent, setEditedContent] = useState("");
  const [isEditing, setIsEditing] = useState(true);

  const { toast } = useToast();
  const previewRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const initialContent = `<h1>The Future of Space Exploration</h1><p>Start writing your document here or generate content using the AI tools. You can include mathematical formulas like this: \\( F = G \\frac{m_1 m_2}{r^2} \\). The editor will render them beautifully.</p>`;
    setDocumentContent(initialContent);
    setEditedContent(initialContent);
  }, []);

  useEffect(() => {
    if (previewRef.current && window.MathJax) {
      window.MathJax.startup.promise.then(() => {
        window.MathJax.typesetPromise([previewRef.current!]).catch((err) =>
          console.error("MathJax typesetting failed:", err)
        );
      });
    }
  }, [documentContent]);

  const handleAiAction = async (
    action: () => Promise<any>,
    successCallback: (result: any) => void,
    loadingMessage: string
  ) => {
    setIsLoading(true);
    const { id: toastId } = toast({
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
      // toast({id: toastId, open: false}); // This line was causing issues, removing it.
    }
  };

  const handleGenerate = () => {
    handleAiAction(
      () => generateDocumentContent({ topic, includeFormulas: true }),
      (result) => {
        setDocumentContent(result.content);
        setEditedContent(result.content);
      },
      "Generating content..."
    );
  };

  const handleFormat = () => {
    const currentContent = editedContent;
    handleAiAction(
      () => autoFormatDocument({ documentContent: currentContent, styleGuide }),
      (result) => {
        setDocumentContent(result.formattedDocument);
        setEditedContent(result.formattedDocument);
      },
      `Applying ${styleGuide} format...`
    );
  };
  
  const handleEnhance = () => {
    const selection = window.getSelection();
    const feedback = "Make this more engaging and professional.";
    let contentToEnhance = editedContent;
    
    if (selection && !selection.isCollapsed && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      const selectedText = range.toString();
      if(selectedText.trim().length > 0) {
         contentToEnhance = selectedText;
      }
    }

    handleAiAction(
      () => enhanceDocument({ documentContent: contentToEnhance, feedback }),
      (result) => {
        if (selection && !selection.isCollapsed && selection.rangeCount > 0) {
            const originalContent = editedContent;
            const enhancedContent = result.enhancedDocumentContent;
            const newContent = originalContent.replace(contentToEnhance, enhancedContent);
            setDocumentContent(newContent);
            setEditedContent(newContent);
        } else {
            setDocumentContent(result.enhancedDocumentContent);
            setEditedContent(result.enhancedDocumentContent);
        }
      },
      "Enhancing document..."
    );
  };


  const handleExportPdf = async () => {
    if (!previewRef.current) return;
    
    setIsLoading(true);
    toast({ description: "Exporting PDF..." });

    try {
        if (window.MathJax) {
            await window.MathJax.startup.promise;
            await window.MathJax.typesetPromise();
        }

        const content = previewRef.current;
        const canvas = await html2canvas(content, {
            scale: 2, 
            backgroundColor: '#111827', // Match dark theme bg-gray-900
            useCORS: true,
             onclone: (document) => {
                const head = document.head;
                if(head) {
                  const style = document.createElement('style');
                  style.innerHTML = `
                    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&family=Lora:wght@400;700&display=swap');
                    body { font-family: 'Inter', sans-serif; color: #e5e5e5; background-color: #111827; }
                    h1, h2, h3, h4, h5, h6 { font-family: 'Lora', serif; color: white; }
                  `;
                  head.appendChild(style);
                }
              }
        });

        const pdf = new jsPDF({
            orientation: 'p',
            unit: 'px',
            format: [canvas.width, canvas.height]
        });
      
        const imgData = canvas.toDataURL('image/png');
        pdf.addImage(imgData, 'PNG', 0, 0, canvas.width, canvas.height);
        pdf.save("document.pdf");
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
    let content = documentContent;

    // Convert LaTeX formulas to OMML
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
            DocuCraft AI
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
        <aside className="w-1/3 flex flex-col p-6 bg-gray-800/50 border-r border-gray-700 overflow-y-auto">
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
                  <Sparkles className="mr-2"/> Enhance Selected
                </Button>
            </div>
             <div className="flex flex-col gap-2 mt-4">
              <label className="text-sm font-medium text-gray-400">Edit Document</label>
               <Textarea
                value={editedContent}
                onChange={(e) => {
                    setEditedContent(e.target.value);
                    setDocumentContent(e.target.value);
                }}
                className="bg-gray-900 border-gray-600 focus:ring-blue-500 focus:border-blue-500 h-64"
                placeholder="Edit the generated content here..."
              />
            </div>
          </div>
        </aside>

        {/* Right Panel: Document Preview */}
        <main className="flex-1 p-8 md:p-12 overflow-y-auto bg-gray-900">
           <div
              ref={previewRef}
              dangerouslySetInnerHTML={{ __html: documentContent }}
              className={cn(
                "prose dark:prose-invert prose-lg max-w-full w-full h-full focus:outline-none",
                "prose-p:text-gray-300 prose-headings:text-white prose-headings:font-serif prose-h1:text-4xl prose-h2:text-3xl prose-h3:text-2xl prose-a:text-blue-400 prose-strong:text-white",
                { "opacity-60": isLoading }
              )}
            />
        </main>
      </div>
    </div>
  );
}
