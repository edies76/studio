"use client";

import { useState, useEffect, useRef } from "react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
} from "lucide-react";
import { cn } from "@/lib/utils";

declare global {
  interface Window {
    MathJax: {
      typesetPromise: () => Promise<void>;
    };
  }
}

export default function Home() {
  const [topic, setTopic] = useState("An essay about artificial intelligence");
  const [includeFormulas, setIncludeFormulas] = useState(false);
  const [styleGuide, setStyleGuide] = useState<"APA" | "IEEE">("APA");
  const [feedback, setFeedback] = useState(
    "Make the introduction more engaging and add a concluding paragraph that summarizes the key points."
  );
  const [documentContent, setDocumentContent] = useState(
    "<h2>Welcome to DocuCraft AI</h2><p>Your intelligent document creation assistant. Enter a topic and let our AI writer generate the initial draft. Then, use the format and enhance tools to perfect your document.</p><p>For example, you can include mathematical formulas like this: \\( E = mc^2 \\). The editor will render them beautifully.</p>"
  );
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (typeof window !== "undefined" && window.MathJax) {
      window.MathJax.typesetPromise();
    }
  }, [documentContent]);

  const handleAiAction = async (
    action: () => Promise<any>,
    successCallback: (result: any) => void,
    loadingMessage: string
  ) => {
    setIsLoading(true);
    const_toast_ref_current_var = toast({
      title: "Processing...",
      description: loadingMessage,
    });
    try {
      const result = await action();
      successCallback(result);
      const_toast_ref_current_var.dismiss();
      toast({
        title: "Success",
        description: "Your document has been updated.",
      });
    } catch (error) {
      console.error(error);
      const_toast_ref_current_var.dismiss();
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

  const handleExportWord = () => {
    const header =
      "<html xmlns:o='urn:schemas-microsoft-com:office:office' " +
      "xmlns:w='urn:schemas-microsoft-com:office:word' " +
      "xmlns='http://www.w3.org/TR/REC-html40'>" +
      "<head><meta charset='utf-8'><title>Export HTML to Word</title></head><body>";
    const footer = "</body></html>";
    const sourceHTML = header + documentContent + footer;

    const source =
      "data:application/vnd.ms-word;charset=utf-8," +
      encodeURIComponent(sourceHTML);
    const fileDownload = document.createElement("a");
    document.body.appendChild(fileDownload);
    fileDownload.href = source;
    fileDownload.download = "document.doc";
    fileDownload.click();
    document.body.removeChild(fileDownload);
  };

  const handleExportPdf = () => {
    window.print();
  };
  
  const insertFormula = () => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;
    const range = selection.getRangeAt(0);
    const formulaNode = document.createTextNode(' \\( a^2 + b^2 = c^2 \\) ');
    range.deleteContents();
    range.insertNode(formulaNode);
    range.setStartAfter(formulaNode);
    range.setEndAfter(formulaNode);
    selection.removeAllRanges();
    selection.addRange(range);
    
    if (range.commonAncestorContainer.parentElement) {
      setDocumentContent(range.commonAncestorContainer.parentElement.innerHTML);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-background text-foreground font-body">
      <header className="flex items-center justify-between px-6 py-3 border-b bg-card no-print">
        <div className="flex items-center gap-3">
          <FileSignature className="w-8 h-8 text-primary" />
          <h1 className="text-2xl font-headline font-bold text-primary">
            DocuCraft AI
          </h1>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleExportPdf}>
            <FileDown className="mr-2" /> Export PDF
          </Button>
          <Button onClick={handleExportWord}>
            <FileDown className="mr-2" /> Export Word
          </Button>
        </div>
      </header>

      <main className="flex-1 grid md:grid-cols-[400px_1fr] gap-6 p-6 overflow-hidden">
        <Card className="flex flex-col no-print">
          <CardHeader>
            <CardTitle className="text-xl">AI Toolkit</CardTitle>
            <CardDescription>
              Generate, format, and enhance your document.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex-1">
            <Tabs defaultValue="generate" className="flex flex-col h-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="generate">
                  <Bot className="mr-2" /> Generate
                </TabsTrigger>
                <TabsTrigger value="format">
                  <BookCheck className="mr-2" /> Format
                </TabsTrigger>
                <TabsTrigger value="enhance">
                  <Sparkles className="mr-2" /> Enhance
                </TabsTrigger>
              </TabsList>
              <div className="mt-4 flex-1">
              <TabsContent value="generate" className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="topic">Topic</Label>
                  <Textarea
                    id="topic"
                    placeholder="e.g., The impact of AI on modern society"
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                  />
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="include-formulas"
                    checked={includeFormulas}
                    onCheckedChange={(checked) =>
                      setIncludeFormulas(checked as boolean)
                    }
                  />
                  <Label htmlFor="include-formulas">
                    Include mathematical formulas
                  </Label>
                </div>
                <Button
                  onClick={handleGenerate}
                  disabled={isLoading}
                  className="w-full"
                >
                  {isLoading ? (
                    <Loader2 className="animate-spin" />
                  ) : (
                    "Generate Document"
                  )}
                </Button>
              </TabsContent>
              <TabsContent value="format" className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="style-guide">Style Guide</Label>
                  <Select
                    value={styleGuide}
                    onValueChange={(value: "APA" | "IEEE") =>
                      setStyleGuide(value)
                    }
                  >
                    <SelectTrigger id="style-guide">
                      <SelectValue placeholder="Select a style guide" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="APA">APA Style</SelectItem>
                      <SelectItem value="IEEE">IEEE Style</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  onClick={handleFormat}
                  disabled={isLoading}
                  className="w-full"
                >
                  {isLoading ? (
                    <Loader2 className="animate-spin" />
                  ) : (
                    "Format Document"
                  )}
                </Button>
              </TabsContent>
              <TabsContent value="enhance" className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="feedback">Enhancement Feedback</Label>
                  <Textarea
                    id="feedback"
                    placeholder="e.g., Make the tone more professional"
                    value={feedback}
                    onChange={(e) => setFeedback(e.target.value)}
                    rows={4}
                  />
                </div>
                <Button
                  onClick={handleEnhance}
                  disabled={isLoading}
                  className="w-full"
                >
                  {isLoading ? (
                    <Loader2 className="animate-spin" />
                  ) : (
                    "Enhance Document"
                  )}
                </Button>
              </TabsContent>
              </div>
            </Tabs>
          </CardContent>
        </Card>

        <Card className="flex flex-col overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between no-print">
            <div className="space-y-1.5">
              <CardTitle>Editor</CardTitle>
              <CardDescription>
                View and edit your document in real-time.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={insertFormula}>
                <ClipboardPlus className="mr-2 h-4 w-4"/> Insert Formula
              </Button>
            </div>
          </CardHeader>
          <CardContent id="printable-area" className="flex-1 overflow-y-auto bg-white dark:bg-gray-900/50 p-4 md:p-8">
            <div
              contentEditable={!isLoading}
              onInput={(e) => setDocumentContent(e.currentTarget.innerHTML)}
              dangerouslySetInnerHTML={{ __html: documentContent }}
              className={cn(
                "prose dark:prose-invert max-w-full w-full h-full focus:outline-none rounded-md",
                "prose-headings:font-headline prose-h1:text-4xl prose-h2:text-3xl prose-h3:text-2xl",
                {"opacity-50 cursor-not-allowed": isLoading}
              )}
              style={{'--tw-prose-body': 'hsl(var(--foreground))', '--tw-prose-headings': 'hsl(var(--foreground))', '--tw-prose-bold': 'hsl(var(--foreground))'}}
            />
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
