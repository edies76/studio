import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export default function MindMapGenerator() {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Mind Map Generator</h3>
      <Textarea
        placeholder="Paste your text here to generate a mind map."
        className="bg-gray-800 border-gray-700 h-32"
      />
      <Button className="w-full">Generate Mind Map</Button>
    </div>
  );
}
