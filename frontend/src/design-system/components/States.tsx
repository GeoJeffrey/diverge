import type { ReactNode } from "react";
import { Button } from "./Controls";

/** Placeholder with the final layout's dimensions, so data arriving causes no layout shift. */
export function Skeleton({ className = "", label }: { className?: string; label?: string }) {
  return (
    <div className={`skeleton ${className}`} role={label ? "status" : undefined} aria-label={label} aria-busy={label ? true : undefined} />
  );
}

/** "Not available" is a first-class state: hatched, calm, and says what's missing. */
export function Unavailable({ title, children, className = "" }: { title: string; children?: ReactNode; className?: string }) {
  return (
    <div className={`hatch rounded-[var(--r-panel)] border border-dashed border-line-strong px-5 py-4 ${className}`}>
      <p className="text-sm font-semibold text-text">{title}</p>
      {children && <div className="t-small mt-1 text-text-2">{children}</div>}
    </div>
  );
}

export function ErrorBlock({ title = "This view didn't load", message, onRetry }: { title?: string; message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="border-l-2 border-down py-2 pl-4">
      <p className="font-semibold text-text">{title}</p>
      <p className="t-small mt-1 text-text-2">{message}</p>
      {onRetry && (
        <Button variant="quiet" className="mt-3" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}
