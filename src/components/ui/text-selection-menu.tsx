import { useState, useEffect, useRef } from 'react';
import { ArrowRight } from 'lucide-react';

interface TextSelectionMenuProps {
  top: number;
  left: number;
  onAction: (action: string, value?: string) => void;
  onClose: () => void;
}

export default function TextSelectionMenu({ top, left, onAction, onClose }: TextSelectionMenuProps) {
  const [inputValue, setInputValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
  };

  const handleSubmit = () => {
    if (inputValue.trim()) {
      onAction('custom_prompt', inputValue);
      onClose();
    }
  };

  return (
    <div 
      style={{ top, left }} 
      className="absolute z-[60] bg-gray-800/80 backdrop-blur-sm rounded-full p-1 flex items-center shadow-2xl animate-in fade-in slide-in-from-top-4 duration-300 w-80"
    >
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
          placeholder="Ask AI to do something with the text..."
          className="w-full bg-transparent text-white placeholder-gray-400 focus:outline-none px-4 py-2"
        />
        <button onClick={handleSubmit} className="ml-auto text-white bg-blue-500 hover:bg-blue-600 rounded-full p-2 flex-shrink-0">
          <ArrowRight size={20} />
        </button>
    </div>
  );
}