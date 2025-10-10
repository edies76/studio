"use client";

import { useState } from "react";
import { Button } from "./button";
import { Input } from "./input";
import {
  PenLine,
  Minimize2,
  Maximize2,
  Sparkles,
  ChevronDown,
  Loader2,
  Send,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./dropdown-menu";

// The action can be a predefined string or a custom prompt from the user
export type EnhancementAction =
  | { type: "predefined"; value: "improve" | "summarize" | "expand" | "tone-academic" | "tone-formal" | "tone-casual"; }
  | { type: "custom"; prompt: string; };

interface EnhancementToolbarProps {
  style: React.CSSProperties;
  onAction: (action: EnhancementAction) => void;
  isLoading: boolean;
}

export function EnhancementToolbar({
  style,
  onAction,
  isLoading,
}: EnhancementToolbarProps) {
  const [customPrompt, setCustomPrompt] = useState("");

  const handleCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (customPrompt.trim()) {
      onAction({ type: "custom", prompt: customPrompt });
      setCustomPrompt("");
    }
  };

  return (
    <div
      data-enhancement-toolbar
      className="absolute z-50 -translate-x-1/2 rounded-lg bg-gray-800 border border-gray-700 shadow-xl p-2 flex items-center gap-2 w-full max-w-md"
      style={style}
      onMouseDown={(e) => e.preventDefault()}
    >
      {isLoading ? (
        <div className="w-full flex justify-center items-center p-2">
          <Loader2 className="animate-spin" />
        </div>
      ) : (
        <>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" title="Quick Actions">
                <Sparkles className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="bg-gray-800 border-gray-700 text-gray-100">
              <DropdownMenuItem onClick={() => onAction({ type: "predefined", value: "improve" })}>Improve</DropdownMenuItem>
              <DropdownMenuItem onClick={() => onAction({ type: "predefined", value: "summarize" })}>Summarize</DropdownMenuItem>
              <DropdownMenuItem onClick={() => onAction({ type: "predefined", value: "expand" })}>Expand</DropdownMenuItem>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <div className="relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50 hover:bg-gray-700">
                    Change Tone <ChevronDown className="h-4 w-4 ml-auto" />
                  </div>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="bg-gray-800 border-gray-700 text-gray-100">
                  <DropdownMenuItem onClick={() => onAction({ type: "predefined", value: "tone-academic" })}>Academic</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onAction({ type: "predefined", value: "tone-formal" })}>Formal</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onAction({ type: "predefined", value: "tone-casual" })}>Casual</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </DropdownMenuContent>
          </DropdownMenu>

          <form onSubmit={handleCustomSubmit} className="flex-grow flex items-center gap-2">
            <Input
              type="text"
              placeholder="Ask AI to edit..."
              className="bg-gray-900/50 border-gray-700 h-8 flex-grow"
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
            />
            <Button type="submit" variant="ghost" size="icon" title="Submit">
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </>
      )}
    </div>
  );
}