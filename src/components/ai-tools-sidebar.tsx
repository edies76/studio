import FlashcardGenerator from "./ai-tools/flashcard-generator";
import MindMapGenerator from "./ai-tools/mind-map-generator";
import QuizGenerator from "./ai-tools/quiz-generator";

const ToolCard = ({ title, description, children }: { title: string, description: string, children: React.ReactNode }) => (
  <div className="bg-gray-800/50 p-4 rounded-lg border border-gray-700/50">
    <h3 className="font-semibold text-white mb-2">{title}</h3>
    <p className="text-sm text-gray-400 mb-4">{description}</p>
    {children}
  </div>
);

export default function AiToolsSidebar() {
  return (
    <aside className="p-6 bg-gray-900/50 border-r border-gray-800 flex flex-col gap-6">
      <h2 className="text-xl font-bold text-white">Student Tools</h2>
      <div className="space-y-6">
        <ToolCard title="Flashcard Generator" description="Create flashcards from your document content.">
          <FlashcardGenerator />
        </ToolCard>
        <ToolCard title="Quiz Generator" description="Generate quizzes to test your knowledge.">
          <QuizGenerator />
        </ToolCard>
        <ToolCard title="Mind Map Generator" description="Visualize your notes as a mind map.">
          <MindMapGenerator />
        </ToolCard>
      </div>
    </aside>
  );
}
