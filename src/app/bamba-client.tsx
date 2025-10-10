"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { generateDocumentContent } from "@/ai/flows/generate-document-content";
import { autoFormatDocument } from "@/ai/flows/auto-format-document";
import { enhanceDocument, EnhancementAction } from "@/ai/flows/enhance-document";
import { generateConceptMap } from "@/ai/flows/generate-concept-map";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import ConceptMapView from "@/components/concept-map-view";
import type { Node as FlowNode, Edge, OnNodesChange, OnEdgesChange } from '@xyflow/react';
import { applyNodeChanges, applyEdgeChanges } from '@xyflow/react';
import { useToast } from "@/hooks/use-toast";
import {
  FileText,
  Bot,
  Sparkles,
  BookCheck,
  Loader2,
  Wand2,
  Download,
  Share2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import jsPDF from "jspdf";
import html2canvas from 'html2canvas';
import { Document, Packer, Paragraph, TextRun, ImageRun, HeadingLevel } from 'docx';
import { saveAs } from 'file-saver';

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


export default function BambaClient() {
  const [documentContent, setDocumentContent] = useState(initialContent);
  const [topic, setTopic] = useState("");
  const [styleGuide, setStyleGuide] = useState("APA");
  const [isLoading, setIsLoading] = useState(false);
  const [activeTool, setActiveTool] = useState<
    "generate" | "format" | "enhance" | "conceptMap" | null
  >(null);

  const [showToolbar, setShowToolbar] = useState(false);
  const [toolbarPosition, setToolbarPosition] = useState({ top: 0, left: 0 });
  
  const selectionRef = useRef<Range | null>(null);

  const [nodes, setNodes] = useState<FlowNode[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [isConceptMapOpen, setIsConceptMapOpen] = useState(false);

  const onNodesChange: OnNodesChange = useCallback(
    (changes) => setNodes((nds) => applyNodeChanges(changes, nds)),
    [setNodes]
  );

  const onEdgesChange: OnEdgesChange = useCallback(
    (changes) => setEdges((eds) => applyEdgeChanges(changes, eds)),
    [setEdges]
  );

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

  const handleEditorInput = () => {
    // This handler is intentionally left blank to prevent re-renders on every keystroke.
  };

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
      toast({
        variant: "destructive",
        title: "Topic is required",
        description: "Please enter a topic to generate content.",
      });
      return;
    }
    setIsLoading(true);
    setActiveTool("generate");
    setShowToolbar(false);
    const { dismiss } = toast({ description: "Generating content..." });
    try {
      const result = await generateDocumentContent({ topic, includeFormulas: true });
      setDocumentContent(result.documentContent);
      // TODO: Store result.presentationSlides and result.timelineEvents in state
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

  const handleGenerateConceptMap = async () => {
    if (!editorRef.current?.innerHTML) {
      toast({
        variant: "destructive",
        title: "Content is required",
        description: "Please add content to the editor to generate a map.",
      });
      return;
    }
    setIsLoading(true);
    setActiveTool("conceptMap");
    const { dismiss } = toast({ description: "Generating concept map..." });
    try {
      const result = await generateConceptMap({
        documentContent: editorRef.current.innerHTML,
      });
      setNodes(result.nodes as FlowNode[]);
      setEdges(result.edges as Edge[]);
      setIsConceptMapOpen(true);
      toast({ title: "Success", description: "Concept map generated." });
    } catch (error) {
      console.error(error);
      toast({
        variant: "destructive",
        title: "Uh oh! Something went wrong.",
        description: "Could not generate the concept map.",
      });
    } finally {
      setIsLoading(false);
      setActiveTool(null);
      dismiss();
    }
  };

  const handleFormatDocument = async () => {
    if (!editorRef.current?.innerHTML) return;
    setIsLoading(true);
    setActiveTool("format");
    setShowToolbar(false);
    const { dismiss } = toast({ description: "Formatting document..." });
    try {
      const result = await autoFormatDocument({
        documentContent: editorRef.current.innerHTML,
        styleGuide: styleGuide as "APA" | "IEEE",
      });
      setDocumentContent(result.formattedDocument);
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

  const handleEnhanceAction = async (action: EnhancementAction) => {
    const currentSelection = selectionRef.current;
    if (!currentSelection) {
      toast({
        variant: "destructive",
        title: "Selection Required",
        description: "Please select the text you want to enhance.",
      });
      return;
    }
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
      if (selection && selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        range.deleteContents();
        const newContentFragment = range.createContextualFragment(result.enhancedDocumentContent);
        range.insertNode(newContentFragment);
      }
      if(editorRef.current) {
        setDocumentContent(editorRef.current.innerHTML);
      }
      setShowToolbar(false);
      selectionRef.current = null;
      toast({ title: "Success", description: "Selection enhanced." });
    } catch (error) {
      console.error(error);
      toast({
        variant: "destructive",
        title: "Uh oh! Something went wrong.",
        description: "Could not enhance selection.",
      });
    } finally {
      setIsLoading(false);
      setActiveTool(null);
      dismiss();
    }
  };

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
    <>
      <Dialog open={isConceptMapOpen} onOpenChange={setIsConceptMapOpen}>
        <DialogContent className="max-w-4xl h-3/4">
          <DialogHeader>
            <DialogTitle>Concept Map</DialogTitle>
          </DialogHeader>
          <ConceptMapView
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
          />
        </DialogContent>
      </Dialog>
      <div className="flex flex-col h-screen bg-gray-900 text-gray-100 font-sans">
        <header className="flex items-center justify-between px-6 py-3 border-b border-gray-800 shrink-0">
          <div className="flex items-center gap-3">
          <Wand2 className="w-6 h-6 text-blue-500" />
          <h1 className="text-2xl font-['Playwrite_IT_Moderna'] font-bold text-white">
            Bamba
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
            <Button
              onClick={handleGenerateConceptMap}
              disabled={isLoading}
              variant="outline"
              className="w-full"
            >
              {isLoading && activeTool === "conceptMap" ? (
                <Loader2 className="animate-spin" />
              ) : (
                <Share2 className="mr-2" />
              )}
              Generate Concept Map
            </Button>
          </div>
        </aside>

        {/* Editor Panel */}
        <main className="relative flex-1 flex flex-col overflow-hidden p-8 md:p-12">
           {showToolbar && (
            <EnhancementToolbar
              style={toolbarPosition}
              onAction={handleEnhanceAction}
              isLoading={isLoading && activeTool === "enhance"}
            />
          )}
          <div
            ref={editorRef}
            contentEditable
            suppressContentEditableWarning
            onInput={handleEditorInput}
            onMouseUp={handleMouseUp}
            onBlur={() => {
              // We add a small delay to allow click events on the toolbar
              setTimeout(() => {
                if (
                  document.activeElement?.closest('[data-enhancement-toolbar]') === null
                ) {
                  setShowToolbar(false);
                }
              }, 200);
            }}
            className={cn(
              "prose dark:prose-invert prose-lg max-w-none w-full h-full focus:outline-none overflow-y-auto bg-gray-800/30 rounded-lg p-6",
              { "opacity-60": isLoading }
            )}
          />
        </main>
      </div>
    </>
  );
}