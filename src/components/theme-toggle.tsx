"use client";

import { useEffect, useSyncExternalStore } from "react";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { THEME_KEY, type ThemeMode } from "@/lib/theme";

const LABEL: Record<ThemeMode, string> = { light: "Sáng", dark: "Tối" };
const ICON = { light: Sun, dark: Moon } satisfies Record<ThemeMode, unknown>;
const CHANGE = "readly-theme-change";

function read(): ThemeMode {
  try {
    return localStorage.getItem(THEME_KEY) === "dark" ? "dark" : "light";
  } catch {
    return "light";
  }
}

function apply(mode: ThemeMode) {
  document.documentElement.classList.toggle("dark", mode === "dark");
}

function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(CHANGE, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(CHANGE, onChange);
  };
}

/** Toggles between Sáng (default) and Tối. The choice lives in localStorage (per device). */
export function ThemeToggle({ withLabel = false }: { withLabel?: boolean }) {
  const mode = useSyncExternalStore(subscribe, read, () => "light" as ThemeMode);

  useEffect(() => {
    apply(mode);
  }, [mode]);

  const next: ThemeMode = mode === "dark" ? "light" : "dark";
  const Icon = ICON[mode];
  const choose = () => {
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch {
      // Storage blocked: the change still applies to this page.
    }
    apply(next);
    window.dispatchEvent(new Event(CHANGE));
  };

  const title = `Giao diện: ${LABEL[mode]}. Bấm để chuyển sang ${LABEL[next]}`;
  return withLabel ? (
    <Button type="button" variant="outline" size="sm" className="w-full justify-start gap-2" onClick={choose} title={title}>
      <Icon aria-hidden /> Giao diện: {LABEL[mode]}
    </Button>
  ) : (
    <Button type="button" variant="ghost" size="icon-sm" onClick={choose} aria-label={title} title={title}>
      <Icon aria-hidden />
    </Button>
  );
}
