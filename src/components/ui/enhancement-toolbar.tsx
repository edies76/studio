"use client";

import { Button } from "./button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import {
  PenLine,
  Minimize2,
  Maximize2,
  Sparkles,
  ChevronDown,
  Loader2,
} from "lucide-react";

export type EnhancementAction =
  | "improve"
  | "summarize"
  | "expand"
  | "tone-academic"
  | "tone-formal"
  | "tone-casual";

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
  return (
    <div
      data-enhancement-toolbar
      className="absolute z-10 -translate-x-1/2 rounded-lg bg-gray-800 border border-gray-700 shadow-xl p-1 flex items-center gap-1"
      style={style}
      onMouseDown={(e) => e.preventDefault()} // Prevent editor from losing focus
    >
      {isLoading ? (
        <div className="p-2">
          <Loader2 className="animate-spin" />
        </div>
      ) : (
        <>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onAction("improve")}
            title="Improve Writing"
          >
            <Sparkles className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onAction("summarize")}
            title="Summarize"
          >
            <Minimize2 className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onAction("expand")}
            title="Expand"
          >
            <Maximize2 className="h-4 w-4" />
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" title="Change Tone">
                <PenLine className="h-4 w-4" />
                <ChevronDown className="h-4 w-4 ml-1" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="bg-gray-800 border-gray-700 text-gray-100">
              <DropdownMenuItem onClick={() => onAction("tone-academic")}>
                Academic
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onAction("tone-formal")}>
                Formal
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onAction("tone-casual")}>
                Casual
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </>
      )}
    </div>
  );
}