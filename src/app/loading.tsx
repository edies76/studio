/** Soft dynamic load — no brand mark, no spinner icon */
export default function Loading() {
  return (
    <div className="studio-load-screen flex h-screen w-full flex-col items-center justify-center bg-white">
      {/* Ambient pulse */}
      <div className="studio-load-orb" aria-hidden />

      <div className="relative z-10 flex flex-col items-center gap-5">
        {/* Cascading lines — abstract “writing” */}
        <div className="studio-load-lines" aria-hidden>
          <span />
          <span />
          <span />
          <span />
          <span />
        </div>

        <p className="studio-shine-text text-[13px] font-medium tracking-wide">
          Preparando el lienzo…
        </p>
      </div>
    </div>
  );
}
