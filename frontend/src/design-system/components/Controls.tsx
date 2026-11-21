import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { Link, type LinkProps } from "react-router";

type Variant = "solid" | "quiet";

const base =
  "inline-flex items-center justify-center gap-2 rounded-[var(--r-control)] px-4 h-10 text-sm font-semibold no-underline transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed";
const variants: Record<Variant, string> = {
  solid: "bg-text text-bg hover:bg-text-2",
  quiet: "border border-edge text-text hover:bg-sunk",
};

export const Button = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }>(
  function Button({ variant = "solid", className = "", ...rest }, ref) {
    return <button ref={ref} className={`${base} ${variants[variant]} ${className}`} {...rest} />;
  },
);

export function ButtonLink({ variant = "solid", className = "", ...rest }: LinkProps & { variant?: Variant }) {
  return <Link className={`${base} ${variants[variant]} ${className}`} {...rest} />;
}

/** Inline text link: underlined, so links never depend on colour alone. */
export function TextLink({ className = "", ...rest }: LinkProps) {
  return (
    <Link
      className={`font-medium text-text underline decoration-line-strong decoration-1 underline-offset-[3px] hover:decoration-text ${className}`}
      {...rest}
    />
  );
}

export function ExternalLink({ href, children, className = "" }: { href: string; children: ReactNode; className?: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className={`font-medium text-text underline decoration-line-strong decoration-1 underline-offset-[3px] hover:decoration-text ${className}`}
    >
      {children}
      <span className="sr-only"> (opens in a new tab)</span>
    </a>
  );
}

/** Two-option switch for routes (Simple / Advanced). Links, so it works without JavaScript state. */
export function Segmented({ options, label }: { options: { to: string; label: string; active: boolean }[]; label: string }) {
  return (
    <nav aria-label={label} className="inline-flex rounded-[var(--r-control)] border border-edge p-0.5">
      {options.map((o) => (
        <Link
          key={o.to}
          to={o.to}
          aria-current={o.active ? "page" : undefined}
          className={`rounded-[4px] px-3 py-1.5 text-sm font-medium no-underline ${
            o.active ? "bg-text text-bg" : "text-text-2 hover:text-text"
          }`}
        >
          {o.label}
        </Link>
      ))}
    </nav>
  );
}
