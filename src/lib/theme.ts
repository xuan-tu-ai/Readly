/** Light / dark mode for the app chrome (the reader keeps its own reading themes). */

export type ThemeMode = "system" | "light" | "dark";

export const THEME_KEY = "readly-theme";

/**
 * Runs in <head> before the first paint, so a dark page never flashes white.
 * Kept tiny and dependency-free; mirrors `apply` in theme-toggle.tsx.
 */
export const THEME_SCRIPT = `(function(){try{var m=localStorage.getItem("${THEME_KEY}");var d=m==="dark"||(m!=="light"&&matchMedia("(prefers-color-scheme: dark)").matches);if(d)document.documentElement.classList.add("dark")}catch(e){}})()`;
