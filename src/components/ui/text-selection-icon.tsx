import { Sparkles } from 'lucide-react';

interface TextSelectionIconProps {
  top: number;
  left: number;
  onClick: () => void;
}

export default function TextSelectionIcon({ top, left, onClick }: TextSelectionIconProps) {
  return (
    <div
      style={{ top, left }}
      onClick={onClick}
      className="absolute z-50 w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center cursor-pointer shadow-lg animate-in fade-in zoom-in-95"
    >
      <Sparkles className="text-white w-5 h-5" />
    </div>
  );
}