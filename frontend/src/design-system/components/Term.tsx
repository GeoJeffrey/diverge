import { useId, useState, type ReactNode } from "react";

/**
 * Jargon explained on hover or keyboard focus: plain English first, the term second.
 * A small dependency-free tooltip (WAI-ARIA tooltip pattern): linked with aria-describedby,
 * shown on hover and focus, dismissed with Escape.
 */
export function Term({ children, explain }: { children: ReactNode; explain: string }) {
  const id = useId();
  const [open, setOpen] = useState(false);
  return (
    <span className="relative inline-block" onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
      <button
        type="button"
        aria-describedby={id}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={(e) => e.key === "Escape" && setOpen(false)}
        className="cursor-help border-0 bg-transparent p-0 text-inherit underline decoration-dotted decoration-text-3 underline-offset-[3px]"
      >
        {children}
      </button>
      <span
        id={id}
        role="tooltip"
        className={`absolute bottom-full left-0 z-50 mb-2 w-max max-w-[min(280px,80vw)] rounded-[var(--r-control)] border border-line-strong bg-raise px-3 py-2 text-left text-[0.8125rem] font-normal normal-case leading-snug tracking-normal text-text shadow-[var(--shadow-pop)] ${
          open ? "visible opacity-100" : "invisible opacity-0"
        } transition-opacity duration-100`}
      >
        {explain}
      </span>
    </span>
  );
}
