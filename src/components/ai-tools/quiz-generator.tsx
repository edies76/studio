import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export default function QuizGenerator() {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Quiz Generator</h3>
      <Textarea
        placeholder="Paste your notes here to generate a quiz."
        className="bg-gray-800 border-gray-700 h-32"
      />
      <Button className="w-full">Generate Quiz</Button>
    </div>
  );
}
