import { useState } from 'react';
import { Wand2, Text, Pilcrow, MessageSquare, CheckCircle } from 'lucide-react';

interface FloatingToolbarProps {
  onAction: (action: string) => void;
}

const actions = [
  { id: 'improve', label: 'Improve', icon: <Wand2 size={18} /> },
  { id: 'summarize', label: 'Summarize', icon: <Pilcrow size={18} /> },
  { id: 'shorter', label: 'Shorter', icon: <Text size={18} /> },
  { id: 'grammar', label: 'Fix Grammar', icon: <CheckCircle size={18} /> },
];

export default function FloatingToolbar({ onAction }: FloatingToolbarProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div 
      className="fixed bottom-10 right-10 z-50 flex items-center justify-end"
      onMouseEnter={() => setIsExpanded(true)}
      onMouseLeave={() => setIsExpanded(false)}
    >
      <div className={`flex items-center gap-2 transition-all duration-300 ease-in-out ${isExpanded ? 'w-auto p-2 bg-gray-800/80 backdrop-blur-sm rounded-full' : 'w-0'}`}>
        {actions.map(action => (
           <button 
             key={action.id} 
             onClick={() => onAction(action.id)} 
             className="flex items-center gap-2 text-white px-3 py-2 rounded-full hover:bg-blue-500/50 transition-colors text-sm whitespace-nowrap"
           >
             {action.icon}
             <span className={isExpanded ? 'max-w-xs' : 'max-w-0 hidden'}>{action.label}</span>
           </button>
        ))}
      </div>
      <div className="w-14 h-14 bg-blue-500 rounded-full flex items-center justify-center cursor-pointer shadow-lg ml-2 flex-shrink-0">
        <MessageSquare className="text-white w-7 h-7" />
      </div>
    </div>
  );
}