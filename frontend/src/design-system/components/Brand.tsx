import { Link } from "react-router";

/** The mark is a tiny fork: one line that splits. Same drawing as the signature chart. */
export function ForkMark({ className = "h-5 w-6" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 20" className={className} aria-hidden="true" fill="none" strokeLinecap="round">
      <path d="M1 10 H10" stroke="currentColor" strokeWidth="2.2" />
      <path d="M10 10 C15 10 17 4 23 3" stroke="var(--up)" strokeWidth="2.6" />
      <path d="M10 10 C15 10 17 16 23 17" stroke="var(--down)" strokeWidth="1.8" />
    </svg>
  );
}

export function Wordmark() {
  return (
    <Link to="/" className="inline-flex items-center gap-2 text-text no-underline" aria-label="Diverge home">
      <ForkMark />
      <span className="text-[1.0625rem] font-semibold tracking-[-0.02em]">Diverge</span>
    </Link>
  );
}
