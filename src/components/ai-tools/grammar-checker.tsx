import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function GrammarChecker() {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Grammar Checker</h3>
      <Input
        type="text"
        placeholder="Enter a sentence to check grammar."
        className="bg-gray-800 border-gray-700"
      />
      <Button className="w-full">Check Grammar</Button>
    </div>
  );
}
