"use client";

import React from 'react';
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface Slide {
  title: string;
  bulletPoints: string[];
}

interface PresentationViewProps {
  slides: Slide[];
}

export function PresentationView({ slides }: PresentationViewProps) {
  const [currentSlide, setCurrentSlide] = React.useState(0);

  const nextSlide = () => {
    setCurrentSlide((prev) => (prev === slides.length - 1 ? 0 : prev + 1));
  };

  const prevSlide = () => {
    setCurrentSlide((prev) => (prev === 0 ? slides.length - 1 : prev - 1));
  };

  if (!slides || slides.length === 0) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-900 text-gray-400">
        <p>No presentation content available. Generate content first.</p>
      </div>
    );
  }

  const slide = slides[currentSlide];

  return (
    <div className="flex flex-col h-full w-full bg-gray-900 p-8 relative">
      <div className="flex-1 flex flex-col items-center justify-center bg-black rounded-lg p-8 shadow-2xl">
        <h2 className="text-4xl font-bold text-white mb-6 text-center">{slide.title}</h2>
        <ul className="list-disc list-inside text-gray-300 text-xl space-y-4">
          {slide.bulletPoints.map((point, index) => (
            <li key={index}>{point}</li>
          ))}
        </ul>
      </div>
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-4">
        <Button onClick={prevSlide} variant="outline" size="icon">
          <ChevronLeft className="h-6 w-6" />
        </Button>
        <span className="text-white font-mono">{currentSlide + 1} / {slides.length}</span>
        <Button onClick={nextSlide} variant="outline" size="icon">
          <ChevronRight className="h-6 w-6" />
        </Button>
      </div>
    </div>
  );
}