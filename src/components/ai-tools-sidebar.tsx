"use client";

import { useState } from 'react';
import { ArrowLeft, BookOpen, BrainCircuit, FileQuestion } from 'lucide-react';
import FlashcardGenerator from "./ai-tools/flashcard-generator";
import MindMapGenerator from "./ai-tools/mind-map-generator";
import QuizGenerator from "./ai-tools/quiz-generator";

const tools = [
    {
        id: 'flashcards',
        title: 'Flashcard Generator',
        description: 'Create flashcards from your notes.',
        icon: <BookOpen className="w-5 h-5" />,
        component: <FlashcardGenerator />
    },
    {
        id: 'quiz',
        title: 'Quiz Generator',
        description: 'Generate quizzes to test your knowledge.',
        icon: <FileQuestion className="w-5 h-5" />,
        component: <QuizGenerator />
    },
    {
        id: 'mindmap',
        title: 'Mind Map Generator',
        description: 'Visualize your notes as a mind map.',
        icon: <BrainCircuit className="w-5 h-5" />,
        component: <MindMapGenerator />
    }
];

export default function AiToolsSidebar() {
  const [selectedTool, setSelectedTool] = useState<string | null>(null);

  const currentTool = tools.find(t => t.id === selectedTool);

  return (
    <aside className="bg-gray-900/50 border-r border-gray-800 flex flex-col overflow-y-auto">
      <div className="p-6 flex-1 flex flex-col">
        {!currentTool ? (
            <>
                <h2 className="text-xl font-bold text-white mb-6">Student Tools</h2>
                <div className="flex flex-col gap-3">
                    {tools.map(tool => (
                        <button 
                            key={tool.id} 
                            onClick={() => setSelectedTool(tool.id)}
                            className="flex items-center gap-4 p-4 rounded-lg bg-gray-800/50 hover:bg-gray-700/70 transition-colors text-left w-full"
                        >
                            <div className="text-blue-400 p-2 bg-gray-700/50 rounded-lg">{tool.icon}</div>
                            <div>
                                <h3 className="font-semibold text-white">{tool.title}</h3>
                                <p className="text-sm text-gray-400">{tool.description}</p>
                            </div>
                        </button>
                    ))}
                </div>
            </>
        ) : (
            <div className="flex flex-col h-full">
                <button 
                    onClick={() => setSelectedTool(null)}
                    className="flex items-center gap-2 mb-6 text-sm text-gray-300 hover:text-white transition-colors"
                >
                    <ArrowLeft size={16} />
                    Back to Tools
                </button>
                <div className="flex items-center gap-4 mb-4">
                     <div className="text-blue-400 p-2 bg-gray-700/50 rounded-lg">{currentTool.icon}</div>
                     <div>
                        <h3 className="font-semibold text-lg text-white">{currentTool.title}</h3>
                     </div>
                </div>
                <div className="flex-1 overflow-y-auto -mr-6 pr-4">
                    {currentTool.component}
                </div>
            </div>
        )}
      </div>
    </aside>
  );
}
