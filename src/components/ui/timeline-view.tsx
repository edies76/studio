"use client";

import React from 'react';

interface TimelineEvent {
  date: string;
  description: string;
}

interface TimelineViewProps {
  events: TimelineEvent[];
}

export function TimelineView({ events }: TimelineViewProps) {
  if (!events || events.length === 0) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-900 text-gray-400">
        <p>No timeline content available. Generate content first.</p>
      </div>
    );
  }

  return (
    <div className="h-full w-full bg-gray-900 p-8 overflow-y-auto">
      <div className="relative border-l-2 border-blue-500 ml-4">
        {events.map((event, index) => (
          <div key={index} className="mb-8 pl-8 relative">
            <div className="absolute -left-2 top-1 h-4 w-4 bg-blue-500 rounded-full border-2 border-gray-900"></div>
            <p className="text-blue-400 font-mono text-sm">{event.date}</p>
            <p className="text-gray-200 mt-1">{event.description}</p>
          </div>
        ))}
      </div>
    </div>
  );
}