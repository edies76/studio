import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export default function DocumentSummarizer() {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Document Summarizer</h3>
      <Textarea
        placeholder="Paste your document here to get a summary."
        className="bg-gray-800 border-gray-700 h-32"
      />
      <Button className="w-full">Summarize</Button>
    </div>
  );
}
