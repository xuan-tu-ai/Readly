"use client";

import { useEffect, useSyncExternalStore } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { THEME_KEY, type ThemeMode } from "@/lib/theme";

const ORDER: ThemeMode[] = ["system", "light", "dark"];
const LABEL: Record<ThemeMode, string> = { system: "Theo máy", light: "Sáng", dark: "Tối" };
const ICON = { system: Monitor, light: Sun, dark: Moon } satisfies Record<ThemeMode, unknown>;
const CHANGE = "readly-theme-change";

function read(): ThemeMode {
  try {
    const value = localStorage.getItem(THEME_KEY);
    return value === "light" || value === "dark" ? value : "system";
  } catch {
    return "system";
  }
}

function apply(mode: ThemeMode) {
  const dark = mode === "dark" || (mode === "system" && matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", dark);
}

function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(CHANGE, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(CHANGE, onChange);
  };
}

/** Cycles Theo máy → Sáng → Tối. The choice lives in localStorage (per device). */
export function ThemeToggle({ withLabel = false }: { withLabel?: boolean }) {
  const mode = useSyncExternalStore(subscribe, read, () => "system" as ThemeMode);

  // Follow the system setting live while in "Theo máy".
  useEffect(() => {
    apply(mode);
    if (mode !== "system") return;
    const media = matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => apply("system");
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [mode]);

  const next = ORDER[(ORDER.indexOf(mode) + 1) % ORDER.length];
  const Icon = ICON[mode];
  const choose = () => {
    try {
      if (next === "system") localStorage.removeItem(THEME_KEY);
      else localStorage.setItem(THEME_KEY, next);
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
