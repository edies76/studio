import { Wand2, AlignJustify, Expand, CheckCircle, FileSignature } from 'lucide-react';

interface FloatingToolbarProps {
  onAction: (action: string) => void;
}

const actions = [
  { id: 'improve', icon: <Wand2 size={20} />, title: 'Improve' },
  { id: 'shorter', icon: <AlignJustify size={20} />, title: 'Shorter' },
  { id: 'expand', icon: <Expand size={20} />, title: 'Expand' },
  { id: 'grammar', icon: <CheckCircle size={20} />, title: 'Fix Grammar' },
  { id: 'suggest-changes', icon: <FileSignature size={20} />, title: 'Suggest Changes' },
];

export default function FloatingToolbar({ onAction }: FloatingToolbarProps) {
  return (
    <div
      className="fixed bottom-1/2 translate-y-1/2 right-10 z-50 flex flex-col items-center gap-2 p-2 bg-gray-800/80 backdrop-blur-sm rounded-full shadow-lg"
    >
      {actions.map((action) => (
        <button
          key={action.id}
          onClick={() => onAction(action.id)}
          className="w-12 h-12 flex items-center justify-center text-white rounded-full hover:bg-blue-500/50 transition-colors"
          title={action.title}
        >
          {action.icon}
        </button>
      ))}
    </div>
  );
}
