import { useCallback, useEffect, useSyncExternalStore } from "react";

/**
 * One shared theme store, so the header toggle and the settings page always agree.
 * "system" follows prefers-color-scheme; a saved choice is a per-viewer convenience in localStorage.
 */
export type ThemeChoice = "system" | "ink" | "paper";
const KEY = "diverge.theme";
const listeners = new Set<() => void>();

function readSaved(): ThemeChoice {
  try {
    const v = localStorage.getItem(KEY);
    return v === "ink" || v === "paper" ? v : "system";
  } catch {
    return "system";
  }
}

let current: ThemeChoice = typeof window === "undefined" ? "system" : readSaved();

function systemTheme(): "ink" | "paper" {
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-color-scheme: light)").matches ? "paper" : "ink";
}

export function applyTheme(choice: ThemeChoice) {
  const root = document.documentElement;
  if (choice === "system") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", choice);
}

export function setTheme(choice: ThemeChoice) {
  current = choice;
  applyTheme(choice);
  try {
    if (choice === "system") localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, choice);
  } catch {
    /* storage unavailable: the choice still applies for this visit */
  }
  listeners.forEach((l) => l());
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  const mq = window.matchMedia?.("(prefers-color-scheme: light)");
  mq?.addEventListener("change", cb);
  return () => {
    listeners.delete(cb);
    mq?.removeEventListener("change", cb);
  };
}

export function useTheme() {
  const choice = useSyncExternalStore(subscribe, () => current, () => "system" as ThemeChoice);
  const resolved = useSyncExternalStore(subscribe, () => (current === "system" ? systemTheme() : current), () => "ink" as const);
  useEffect(() => applyTheme(choice), [choice]);

  /** Flip the visible theme; landing on the system's own theme goes back to "follow the system". */
  const toggle = useCallback(() => {
    const next = resolved === "ink" ? "paper" : "ink";
    setTheme(next === systemTheme() ? "system" : next);
  }, [resolved]);

  return { choice, resolved, setChoice: setTheme, toggle };
}
