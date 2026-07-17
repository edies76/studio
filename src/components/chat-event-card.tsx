'use client';

import { cn } from '@/lib/utils';

export type ChatEventType = 'local_edit' | 'ai_change' | 'ai_draft' | 'ai_applied';

export type ChatEvent = {
  type: ChatEventType;
  title: string;
  summary?: string;
  details?: string[];
};

/** One-line micro event — no giant cards */
export default function ChatEventCard({ event }: { event: ChatEvent }) {
  const tone =
    event.type === 'ai_applied' || event.type === 'ai_change' || event.type === 'ai_draft'
      ? 'text-[#5c5346]'
      : 'text-neutral-400';

  return (
    <div className={cn('px-0.5 py-0.5 text-[11px] leading-none', tone)}>
      <span className="opacity-70">·</span>{' '}
      <span className="font-medium">{event.title}</span>
      {event.summary && (
        <span className="ml-1 opacity-60">{event.summary.slice(0, 72)}</span>
      )}
    </div>
  );
}
