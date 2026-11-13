/** Light / dark mode for the app chrome (the reader keeps its own reading themes). */

export type ThemeMode = "light" | "dark";

export const THEME_KEY = "readly-theme";

/**
 * Runs in <head> before the first paint, so a dark page never flashes white.
 * Light is the default; only a saved "dark" turns dark mode on.
 * Kept tiny and dependency-free; mirrors `apply` in theme-toggle.tsx.
 */
export const THEME_SCRIPT = `(function(){try{if(localStorage.getItem("${THEME_KEY}")==="dark")document.documentElement.classList.add("dark")}catch(e){}})()`;
