"use client";

import { useState, useEffect } from "react";
import { generateDocumentContent } from "@/ai/flows/generate-document-content";
import { autoFormatDocument } from "@/ai/flows/auto-format-document";
import { enhanceDocument } from "@/ai/flows/enhance-document";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
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
  ClipboardPlus,
  Loader2,
  FileSignature,
  Wand2,
  Type,
  Mic,
  BrainCircuit,
  Lightbulb,
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
  const [topic, setTopic] = useState("An essay about artificial intelligence and ethics");
  const [includeFormulas, setIncludeFormulas] = useState(false);
  const [styleGuide, setStyleGuide] = useState<"APA" | "IEEE">("APA");
  const [feedback, setFeedback] = useState(
    "Make the introduction more engaging and add a concluding paragraph that summarizes the key points."
  );
  const [documentContent, setDocumentContent] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    setDocumentContent(`<h2>Essay on Artificial Intelligence and Ethics</h2><p>Start writing your document here or generate content using the AI tools.</p><p>You can include mathematical formulas like this: \\( E = mc^2 \\). The editor will render them beautifully.</p>`);
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
    const toastRef = toast({
      title: "Processing...",
      description: loadingMessage,
      duration: 120000, // 2 minutes
    });
    try {
      const result = await action();
      successCallback(result);
      toastRef.dismiss();
      toast({
        title: "Success",
        description: "Your document has been updated.",
      });
    } catch (error) {
      console.error(error);
      toastRef.dismiss();
      toast({
        variant: "destructive",
        title: "Error",
        description:
          "An error occurred while processing your request. Please try again.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleGenerate = () => {
    handleAiAction(
      () => generateDocumentContent({ topic, includeFormulas }),
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
    handleAiAction(
      () => enhanceDocument({ documentContent, feedback }),
      (result) => setDocumentContent(result.enhancedDocumentContent),
      "Enhancing document..."
    );
  };

  const handleExportPdf = async () => {
    const editorElement = document.getElementById('final-preview-content');
    if (!editorElement) return;

    setIsLoading(true);
    const toastRef = toast({
      title: "Exporting PDF...",
      description: "Please wait while we generate your document.",
    });

    try {
      const canvas = await html2canvas(editorElement, {
        scale: 2, // Higher scale for better quality
        useCORS: true,
        backgroundColor: '#ffffff',
      });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'p',
        unit: 'px',
        format: [canvas.width, canvas.height],
      });
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
      toastRef.dismiss();
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-gray-900 text-white font-body">
      <header className="flex items-center justify-between px-6 py-3 border-b border-gray-700">
        <div className="flex items-center gap-3">
          <Wand2 className="w-8 h-8 text-blue-400" />
          <h1 className="text-2xl font-headline font-bold text-white">
            DocuGen AI
          </h1>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-400">Asistencia</span>
          <Button variant="ghost" size="icon"><Sparkles className="w-5 h-5"/></Button>
          <img src="https://picsum.photos/seed/user/32/32" alt="User" className="rounded-full w-8 h-8" />
        </div>
      </header>

      <main className="flex-1 grid md:grid-cols-[350px_1fr_1fr] gap-6 p-6 overflow-hidden">
        {/* Left Sidebar - Magic Editor */}
        <div className="flex flex-col gap-6">
          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg text-blue-400"><Wand2/> Magic Editor</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button variant="outline" className="w-full justify-start border-gray-600 hover:bg-gray-700"><Type className="mr-2"/> Tipo de Documento</Button>
              <Button variant="outline" className="w-full justify-start border-gray-600 hover:bg-gray-700"><Mic className="mr-2"/> Tono/Estilo</Button>
              <Button variant="outline" className="w-full justify-start border-gray-600 hover:bg-gray-700"><BrainCircuit className="mr-2"/> Resumen de Firmas (IA)</Button>
               <Button variant="outline" className="w-full justify-start border-gray-600 hover:bg-gray-700"><Lightbulb className="mr-2"/> Sugerencias</Button>
            </CardContent>
          </Card>
           <Button onClick={handleExportPdf} disabled={isLoading} className="bg-blue-600 hover:bg-blue-700 text-white">
             {isLoading ? <Loader2 className="animate-spin" /> : <FileDown className="mr-2"/>}
             Descargar (.pdf)
          </Button>
        </div>

        {/* Center Panel - The Writer */}
        <Card className="flex flex-col overflow-hidden bg-gray-800 border-gray-700">
          <CardHeader>
            <CardTitle>La Escritora: Borrador de contento</CardTitle>
          </CardHeader>
          <CardContent className="flex-1 overflow-y-auto p-4 bg-gray-900/50">
             <Textarea
                id="topic"
                placeholder="e.g., The impact of AI on modern society"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                className="bg-transparent border-gray-600 mb-4"
              />
            <div
              contentEditable={!isLoading}
              onInput={(e) => setDocumentContent(e.currentTarget.innerHTML)}
              dangerouslySetInnerHTML={{ __html: documentContent }}
              className={cn(
                "prose prose-invert max-w-full w-full h-full focus:outline-none rounded-md p-4 bg-gray-800/50 border border-gray-600",
                {"opacity-50 cursor-not-allowed": isLoading}
              )}
            />
          </CardContent>
          <div className="p-4 border-t border-gray-700 flex justify-between items-center">
             <Select
                value={styleGuide}
                onValueChange={(value: "APA" | "IEEE") =>
                  setStyleGuide(value)
                }
              >
                <SelectTrigger id="style-guide" className="w-[180px] bg-gray-700 border-gray-600">
                  <SelectValue placeholder="Select style" />
                </SelectTrigger>
                <SelectContent className="bg-gray-800 border-gray-700 text-white">
                  <SelectItem value="APA">APA Style</SelectItem>
                  <SelectItem value="IEEE">IEEE Style</SelectItem>
                </SelectContent>
              </Select>
            <div className="flex gap-2">
              <Button onClick={handleGenerate} disabled={isLoading} variant="secondary">
                {isLoading ? <Loader2 className="animate-spin" /> : <Bot/>}
              </Button>
              <Button onClick={handleFormat} disabled={isLoading} variant="secondary">
                 {isLoading ? <Loader2 className="animate-spin" /> : <BookCheck/>}
              </Button>
              <Button onClick={handleEnhance} disabled={isLoading} variant="secondary">
                {isLoading ? <Loader2 className="animate-spin" /> : <Sparkles/>}
              </Button>
            </div>
          </div>
        </Card>

        {/* Right Panel - Final Preview */}
        <Card className="flex flex-col overflow-hidden bg-gray-800 border-gray-700">
          <CardHeader>
            <CardTitle>Vista Previa Final</CardTitle>
          </CardHeader>
          <CardContent id="final-preview-content" className="flex-1 overflow-y-auto bg-white p-8">
            <div
              dangerouslySetInnerHTML={{ __html: documentContent }}
              className={cn(
                "prose max-w-full w-full h-full",
                "prose-headings:font-headline prose-h1:text-4xl prose-h2:text-3xl prose-h3:text-2xl",
              )}
            />
          </CardContent>
           <div className="p-4 border-t border-gray-700 flex justify-end">
             <Button variant="ghost">Soporte IA <Lightbulb className="ml-2"/></Button>
          </div>
        </Card>
      </main>
    </div>
  );
}
