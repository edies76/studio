"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { generateDocumentContent } from "@/ai/flows/generate-document-content";
import { enhanceDocument, EnhancementAction } from "@/ai/flows/enhance-document";
import { PresentationView } from "@/components/ui/presentation-view";
import { TimelineView } from "@/components/ui/timeline-view";
import { EnhancementToolbar } from "@/components/ui/enhancement-toolbar";

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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import {
  Bot,
  Sparkles,
  Loader2,
  Wand2,
  Download,
  Presentation,
  CalendarClock,
  FileEdit,
} from "lucide-react";
import { cn } from "@/lib/utils";
import jsPDF from "jspdf";
import html2canvas from 'html2canvas';
import { Document, Packer, Paragraph, TextRun, ImageRun, HeadingLevel } from 'docx';
import { saveAs } from 'file-saver';

// Data structure interfaces
interface Slide {
  title: string;
  bulletPoints: string[];
}
interface TimelineEvent {
  date: string;
  description: string;
}

// Type declaration for MathJax on the window object
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

const initialContent = `<h1>Welcome to Bamba!</h1><p>Enter a topic on the left and click 'Generate Content' to begin your journey from idea to professional results.</p>`;

export default function BambaClient() {
  // State Management
  const [documentContent, setDocumentContent] = useState(initialContent);
  const [presentationSlides, setPresentationSlides] = useState<Slide[]>([]);
  const [timelineEvents, setTimelineEvents] = useState<TimelineEvent[]>([]);
  const [topic, setTopic] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [activeTool, setActiveTool] = useState<"generate" | "enhance" | null>(null);
  const [showToolbar, setShowToolbar] = useState(false);
  const [toolbarPosition, setToolbarPosition] = useState({ top: 0, left: 0 });

  // Refs
  const selectionRef = useRef<Range | null>(null);
  const editorRef = useRef<HTMLDivElement>(null);

  // Hooks
  const { toast } = useToast();

  // Callbacks
  const typesetMath = useCallback(() => {
    if (editorRef.current && window.MathJax) {
      window.MathJax.startup.promise.then(() => {
        window.MathJax.typesetPromise([editorRef.current!]).catch((err: any) => {
          console.error("MathJax typesetting failed:", err);
        });
      });
    }
  }, []);

  const handleEditorInput = () => { /* Intentionally blank */ };

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
          setToolbarPosition({
            top: rect.top - editorRect.top - 50,
            left: rect.left - editorRect.left + rect.width / 2,
          });
          setShowToolbar(true);
        }
      } else {
        setShowToolbar(false);
      }
    }, 10);
  };

  // Core AI Functions
  const handleGenerateContent = async () => {
    if (!topic) {
      toast({ variant: "destructive", title: "Topic is required" });
      return;
    }
    setIsLoading(true);
    setActiveTool("generate");
    setShowToolbar(false);
    const { dismiss } = toast({ description: "Generating content package..." });
    try {
      const result = await generateDocumentContent({ topic, includeFormulas: true });
      setDocumentContent(result.documentContent);
      setPresentationSlides(result.presentationSlides);
      setTimelineEvents(result.timelineEvents);
      toast({ title: "Success", description: "Content package generated successfully." });
    } catch (error) {
      console.error(error);
      toast({ variant: "destructive", title: "Uh oh! Something went wrong." });
    } finally {
      setIsLoading(false);
      setActiveTool(null);
      dismiss();
    }
  };

  const handleEnhanceAction = async (action: EnhancementAction) => {
    const currentSelection = selectionRef.current;
    if (!currentSelection) return;
    setIsLoading(true);
    setActiveTool("enhance");
    const { dismiss } = toast({ description: "Enhancing selection..." });
    try {
      const selectedHtml = currentSelection.cloneContents();
      const tempDiv = document.createElement("div");
      tempDiv.appendChild(selectedHtml);
      const result = await enhanceDocument({
        documentContent: tempDiv.innerHTML,
        action: action,
      });
      const selection = window.getSelection();
      if (selection?.rangeCount) {
        const range = selection.getRangeAt(0);
        range.deleteContents();
        range.insertNode(range.createContextualFragment(result.enhancedDocumentContent));
      }
      if(editorRef.current) setDocumentContent(editorRef.current.innerHTML);
      setShowToolbar(false);
      selectionRef.current = null;
      toast({ title: "Success", description: "Selection enhanced." });
    } catch (error) {
      console.error(error);
      toast({ variant: "destructive", title: "Uh oh! Something went wrong." });
    } finally {
      setIsLoading(false);
      setActiveTool(null);
      dismiss();
    }
  };

  // Export Functions
  const handleExportPdf = async () => {
    if (!editorRef.current) return;
    setIsLoading(true);
    const { dismiss } = toast({ description: "Preparing document for export..." });

    try {
      if (window.MathJax) {
        await window.MathJax.startup.promise;
        await window.MathJax.typesetPromise([editorRef.current]);
      }

      toast({ description: "Generating high-fidelity PDF..." });

      const editor = editorRef.current;
      const canvas = await html2canvas(editor, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'pt',
        format: 'a4',
      });

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const canvasWidth = canvas.width;
      const canvasHeight = canvas.height;
      const ratio = canvasWidth / pdfWidth;
      const imgHeight = canvasHeight / ratio;

      let heightLeft = imgHeight;
      let position = 0;

      pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, imgHeight);
      heightLeft -= pdfHeight;

      while (heightLeft > 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, imgHeight);
        heightLeft -= pdfHeight;
      }

      pdf.save("document.pdf");
      dismiss();
      toast({ title: "Success", description: "PDF exported successfully." });

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

  const handleExportWord = async () => {
    if (!editorRef.current) return;
    setIsLoading(true);
    const { dismiss } = toast({ description: "Generating professional .docx file..." });

    try {
      if (window.MathJax) {
        await window.MathJax.startup.promise;
        await window.MathJax.typesetPromise([editorRef.current]);
      }

      const editor = editorRef.current.cloneNode(true) as HTMLElement;
      const docxChildren = [];

      const parseNode = async (node: ChildNode): Promise<any> => {
        switch (node.nodeName) {
          case 'H1':
            return new Paragraph({ text: node.textContent || '', heading: HeadingLevel.HEADING_1 });
          case 'H2':
            return new Paragraph({ text: node.textContent || '', heading: HeadingLevel.HEADING_2 });
          case 'H3':
            return new Paragraph({ text: node.textContent || '', heading: HeadingLevel.HEADING_3 });
          case 'P': {
            const paragraphRuns: (TextRun | ImageRun)[] = [];
            for (const pChild of Array.from(node.childNodes)) {
              if (pChild.nodeType === Node.TEXT_NODE) {
                paragraphRuns.push(new TextRun(pChild.textContent || ''));
              } else if (pChild.nodeType === Node.ELEMENT_NODE) {
                const element = pChild as HTMLElement;
                if (element.tagName === 'MJX-CONTAINER') {
                  const canvas = await html2canvas(element, { backgroundColor: 'white', scale: 3 });
                  const imageBuffer = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png'));
                  if (imageBuffer) {
                    const buffer = await imageBuffer.arrayBuffer();
                    paragraphRuns.push(new ImageRun({
                      type: 'png',
                      data: buffer,
                      transformation: { width: canvas.width / 3, height: canvas.height / 3 },
                    }));
                  }
                } else {
                  paragraphRuns.push(new TextRun(element.textContent || ''));
                }
              }
            }
            return new Paragraph({ children: paragraphRuns });
          }
          default:
            return null;
        }
      };

      for (const child of Array.from(editor.childNodes)) {
        const docxChild = await parseNode(child);
        if (docxChild) {
          docxChildren.push(docxChild);
        }
      }

      const doc = new Document({
        sections: [{
          children: docxChildren,
        }],
      });

      const blob = await Packer.toBlob(doc);
      saveAs(blob, 'Bamba-Document.docx');

      dismiss();
      toast({ title: "Success", description: "Word document exported successfully." });

    } catch (error) {
      console.error("Error exporting Word document:", error);
      dismiss();
      toast({
        variant: "destructive",
        title: "Error",
        description: "Could not export Word document.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-gray-900 text-gray-100 font-sans">
      <header className="flex items-center justify-between px-6 py-3 border-b border-gray-800 shrink-0">
        <div className="flex items-center gap-3">
          <Wand2 className="w-6 h-6 text-blue-500" />
          <h1 className="text-2xl font-['Playwrite_IT_Moderna'] font-bold text-white">Bamba</h1>
        </div>
        <div className="flex items-center gap-4">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline"><Download className="w-4 h-4 mr-2" />Export</Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={handleExportPdf}>Export to PDF</DropdownMenuItem>
              <DropdownMenuItem onClick={handleExportWord}>Export to Word</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <div className="flex-1 grid md:grid-cols-[400px_1fr] overflow-hidden">
        <aside className="p-6 bg-gray-900/50 border-r border-gray-800 flex flex-col gap-6">
          <h2 className="text-lg font-semibold flex items-center gap-2"><Bot className="w-5 h-5" /> AI Tools</h2>
          <div className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="topic" className="font-medium">Topic</label>
              <Textarea id="topic" placeholder="e.g., 'The history of artificial intelligence'" value={topic} onChange={(e) => setTopic(e.target.value)} />
            </div>
            <div className="space-y-2">
              <label htmlFor="style-guide" className="font-medium">Style Guide</label>
              <Select>
                <SelectTrigger id="style-guide"><SelectValue placeholder="Select style..." /></SelectTrigger>
                <SelectContent><SelectItem value="APA">APA</SelectItem><SelectItem value="IEEE">IEEE</SelectItem></SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex flex-col gap-3 mt-auto">
            <Button onClick={handleGenerateContent} disabled={isLoading} className="w-full">
              {isLoading && activeTool === "generate" ? <Loader2 className="animate-spin" /> : <Sparkles className="mr-2" />}
              Generate Content
            </Button>
          </div>
        </aside>

        <main className="flex-1 flex flex-col overflow-hidden">
          <Tabs defaultValue="editor" className="flex-1 flex flex-col h-full">
            <TabsList className="shrink-0">
              <TabsTrigger value="editor"><FileEdit className="w-4 h-4 mr-2" />Editor</TabsTrigger>
              <TabsTrigger value="presentation"><Presentation className="w-4 h-4 mr-2" />Presentation</TabsTrigger>
              <TabsTrigger value="timeline"><CalendarClock className="w-4 h-4 mr-2" />Timeline</TabsTrigger>
            </TabsList>

            <TabsContent value="editor" className="flex-1 relative overflow-hidden p-4">
              {showToolbar && <EnhancementToolbar style={toolbarPosition} onAction={handleEnhanceAction} isLoading={isLoading && activeTool === "enhance"} />}
              <div
                ref={editorRef}
                contentEditable
                suppressContentEditableWarning
                onInput={handleEditorInput}
                onMouseUp={handleMouseUp}
                onSelect={handleMouseUp}
                className={cn("prose dark:prose-invert prose-lg max-w-none w-full h-full focus:outline-none overflow-y-auto bg-gray-800/30 rounded-lg p-6", { "opacity-60": isLoading })}
              />
            </TabsContent>
            <TabsContent value="presentation" className="flex-1 overflow-hidden">
              <PresentationView slides={presentationSlides} />
            </TabsContent>
            <TabsContent value="timeline" className="flex-1 overflow-hidden">
              <TimelineView events={timelineEvents} />
            </TabsContent>
          </Tabs>
        </main>
      </div>
    </div>
  );
}