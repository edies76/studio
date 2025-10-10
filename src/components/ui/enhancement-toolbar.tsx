"use client";

import { cn } from "@/lib/utils";
import { Button } from "./button";
import { Loader2, Sparkles } from "lucide-react";

interface EnhancementToolbarProps {
  style: React.CSSProperties;
  onEnhance: () => void;
  isLoading: boolean;
}

export function EnhancementToolbar({ style, onEnhance, isLoading }: EnhancementToolbarProps) {
  return (
    <div
      data-enhancement-toolbar
      className="absolute z-10 -translate-x-1/2 rounded-lg bg-gray-800 border border-gray-700 shadow-xl p-1 flex items-center gap-1"
      style={style}
      onMouseDown={(e) => e.preventDefault()} // Prevent editor from losing focus
    >
      <Button
        variant="ghost"
        size="sm"
        onClick={onEnhance}
        disabled={isLoading}
        className="text-sm"
      >
        {isLoading ? (
          <Loader2 className="animate-spin" />
        ) : (
          <Sparkles className="mr-2 h-4 w-4" />
        )}
        Enhance
      </Button>
    </div>
  );
}

    