"use client";

import { Button } from "./button";
import {
  Sparkles,
  Book,
  ArrowRight,
  Mic,
  Volume2,
  ChevronDown,
  Check,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./dropdown-menu";
import { useState } from "react";

interface EnhancementToolbarProps {
  style: React.CSSProperties;
  onAction: (
    action: "improve" | "summarize" | "shorter" | "tone",
    option?: string
  ) => void;
  isLoading: boolean;
}

const toneOptions = [
  "Professional",
  "Casual",
  "Friendly",
  "Direct",
  "Confident",
];

export function EnhancementToolbar({
  style,
  onAction,
  isLoading,
}: EnhancementToolbarProps) {
  const [currentTone, setCurrentTone] = useState("Professional");

  return (
    <div
      data-enhancement-toolbar
      className="absolute z-10 -translate-x-1/2 rounded-lg bg-gray-800 border border-gray-700 shadow-xl p-2 flex items-center gap-2"
      style={style}
      onMouseDown={(e) => e.preventDefault()}
    >
      <Button
        variant="ghost"
        size="sm"
        onClick={() => onAction("improve")}
        disabled={isLoading}
        className="text-sm"
      >
        <Sparkles className="mr-2 h-4 w-4" />
        Improve writing
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => onAction("summarize")}
        disabled={isLoading}
        className="text-sm"
      >
        <Book className="mr-2 h-4 w-4" />
        Summarize
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => onAction("shorter")}
        disabled={isLoading}
        className="text-sm"
      >
        <ArrowRight className="mr-2 h-4 w-4" />
        Make shorter
      </Button>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="text-sm">
            <Volume2 className="mr-2 h-4 w-4" />
            Change tone
            <ChevronDown className="ml-2 h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          {toneOptions.map((tone) => (
            <DropdownMenuItem
              key={tone}
              onClick={() => {
                setCurrentTone(tone);
                onAction("tone", tone);
              }}
            >
              {tone}
              {currentTone === tone && <Check className="ml-auto h-4 w-4" />}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

    