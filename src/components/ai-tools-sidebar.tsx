import DocumentSummarizer from "./ai-tools/document-summarizer";
import FlashcardGenerator from "./ai-tools/flashcard-generator";
import GrammarChecker from "./ai-tools/grammar-checker";
import MindMapGenerator from "./ai-tools/mind-map-generator";
import QuizGenerator from "./ai-tools/quiz-generator";

export default function AiToolsSidebar() {
  return (
    <aside className="p-6 bg-gray-900/50 border-r border-gray-800 flex flex-col gap-6">
      <h2 className="text-lg font-semibold">Student AI Tools</h2>
      <div className="space-y-6">
        <DocumentSummarizer />
        <FlashcardGenerator />
        <GrammarChecker />
        <QuizGenerator />
        <MindMapGenerator />
      </div>
    </aside>
  );
}
