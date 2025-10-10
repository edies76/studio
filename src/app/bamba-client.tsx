"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { generateDocumentContent } from "@/ai/flows/generate-document-content";
import { autoFormatDocument } from "@/ai/flows/auto-format-document";
import { enhanceDocument, EnhancementAction } from "@/ai/flows/enhance-document";

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
import { EnhancementToolbar } from "@/components/ui/enhancement-toolbar";
import { PresentationView } from "@/components/ui/presentation-view";
import { TimelineView } from "@/components/ui/timeline-view";
import { AutoResearcherView } from "@/components/ui/auto-researcher-view";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import {
  FileText,
  Bot,
  Sparkles,
  BookCheck,
  Loader2,
  Wand2,
  Download,
  Presentation,
  CalendarClock,
  FileEdit,
  FlaskConical, // New icon for the researcher
} from "lucide-react";
import { cn } from "@/lib/utils";
import jsPDF from "jspdf";
import html2canvas from 'html2canvas';
import { Document, Packer, Paragraph, TextRun, ImageRun, HeadingLevel } from 'docx';
import { saveAs } from 'file-saver';

// Define the types for the new data structures
interface Slide {
  title: string;
  bulletPoints: string[];
}

interface TimelineEvent {
  date: string;
  description: string;
}

// Declare MathJax on the window object for TypeScript
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
  const [documentContent, setDocumentContent] = useState(initialContent);
  const [presentationSlides, setPresentationSlides] = useState<Slide[]>([]);
  const [timelineEvents, setTimelineEvents] = useState<TimelineEvent[]>([]);

  const [topic, setTopic] = useState("");
  const [styleGuide, setStyleGuide] = useState("APA");
  const [isLoading, setIsLoading] = useState(false);
  const [activeTool, setActiveTool] = useState<"generate" | "format" | "enhance" | null>(null);

  const [showToolbar, setShowToolbar] = useState(false);
  const [toolbarPosition, setToolbarPosition] = useState({ top: 0, left: 0 });
  const selectionRef = useRef<Range | null>(null);

  const { toast } = useToast();
  const editorRef = useRef<HTMLDivElement>(null);

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

  // Placeholder for handleExportPdf and handleExportWord
  const handleExportPdf = () => toast({title: "Coming soon!"});
  const handleExportWord = () => toast({title: "Coming soon!"});

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
              <label htmlFor="topic">Topic</label>
              <Textarea id="topic" placeholder="e.g., 'The history of artificial intelligence'" value={topic} onChange={(e) => setTopic(e.target.value)} />
            </div>
            <div className="space-y-2">
              <label htmlFor="style-guide">Style Guide</label>
              <Select value={styleGuide} onValueChange={setStyleGuide}>
                <SelectTrigger id="style-guide"><SelectValue /></SelectTrigger>
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
          <Tabs defaultValue="editor" className="flex-1 flex flex-col">
            <TabsList className="shrink-0">
              <TabsTrigger value="editor"><FileEdit className="w-4 h-4 mr-2" />Editor</TabsTrigger>
              <TabsTrigger value="presentation"><Presentation className="w-4 h-4 mr-2" />Presentation</TabsTrigger>
              <TabsTrigger value="timeline"><CalendarClock className="w-4 h-4 mr-2" />Timeline</TabsTrigger>
              <TabsTrigger value="researcher"><FlaskConical className="w-4 h-4 mr-2" />Researcher</TabsTrigger>
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
            <TabsContent value="researcher" className="flex-1 overflow-hidden">
              <AutoResearcherView />
            </TabsContent>
          </Tabs>
        </main>
      </div>
    </div>
  );
}