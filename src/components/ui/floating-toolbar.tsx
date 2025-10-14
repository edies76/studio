import { useState } from 'react';
import { Wand2, Text, Pilcrow, CheckCircle, MessageSquare } from 'lucide-react';

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
      className="fixed bottom-10 right-10 z-50 flex flex-col items-center gap-3"
      onMouseEnter={() => setIsExpanded(true)}
      onMouseLeave={() => setIsExpanded(false)}
    >
        {/* Action Buttons */}
        <div className="flex flex-col-reverse items-center gap-3">
            {actions.map((action, index) => (
                <div 
                    key={action.id} 
                    className={`transition-all duration-300 ease-in-out ${isExpanded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
                    style={{ transitionDelay: `${isExpanded ? (actions.length - index - 1) * 40 : 0}ms` }}
                >
                    <button 
                        onClick={() => onAction(action.id)} 
                        className="flex items-center justify-end gap-3 w-40 text-white px-3 py-2 rounded-full bg-gray-800/80 backdrop-blur-sm hover:bg-blue-500/50 transition-colors text-sm whitespace-nowrap shadow-lg"
                    >
                        <span>{action.label}</span>
                        {action.icon}
                    </button>
                </div>
            ))}
        </div>

        {/* Main Trigger Button */}
        <div className="w-14 h-14 bg-blue-500 rounded-full flex items-center justify-center cursor-pointer shadow-lg flex-shrink-0 mt-3">
            <MessageSquare className="text-white w-7 h-7" />
        </div>
    </div>
  );
}
