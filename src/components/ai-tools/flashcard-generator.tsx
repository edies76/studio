import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export default function FlashcardGenerator() {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Flashcard Generator</h3>
      <Textarea
        placeholder="Paste your notes here to generate flashcards."
        className="bg-gray-800 border-gray-700 h-32"
      />
      <Button className="w-full">Generate Flashcards</Button>
    </div>
  );
}
