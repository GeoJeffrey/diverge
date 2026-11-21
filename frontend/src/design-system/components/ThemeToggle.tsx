import { useTheme } from "@/lib/theme";

export function ThemeToggle() {
  const { resolved, choice, toggle } = useTheme();
  const next = resolved === "ink" ? "light" : "dark";
  return (
    <button
      type="button"
      onClick={toggle}
      className="inline-flex h-9 w-9 items-center justify-center rounded-[var(--r-control)] text-text-2 hover:bg-sunk hover:text-text"
      aria-label={`Switch to ${next} theme${choice === "system" ? " (currently following your system setting)" : ""}`}
      title={`Switch to ${next} theme`}
    >
      <svg viewBox="0 0 20 20" className="h-[18px] w-[18px]" aria-hidden="true">
        <circle cx="10" cy="10" r="6.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
        <path d="M10 3.5 A6.5 6.5 0 0 1 10 16.5 Z" fill="currentColor" />
      </svg>
    </button>
  );
}
