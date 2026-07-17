'use client';

/** Shine text like chatbot-standalone thinking indicator */
export default function ThinkingShine({
  label = 'Pensando…',
  detail,
}: {
  label?: string;
  detail?: string;
}) {
  return (
    <div className="py-1">
      <span className="studio-shine-text text-[13px] font-medium tracking-tight">
        {label}
      </span>
      {detail && (
        <p className="mt-1 max-h-24 overflow-y-auto text-[11px] leading-relaxed text-neutral-400">
          {detail}
        </p>
      )}
    </div>
  );
}
