/** Light / dark mode for the app chrome (the reader keeps its own reading themes). */

export type ThemeMode = "light" | "dark";

export const THEME_KEY = "readly-theme";

/**
 * Runs in <head> before the first paint, so a dark page never flashes white.
 * Kept tiny and dependency-free; mirrors `apply` in theme-toggle.tsx.
 */
export const THEME_SCRIPT = `(function(){var d=true;try{d=localStorage.getItem("${THEME_KEY}")!=="light"}catch(e){}if(d)document.documentElement.classList.add("dark")})()`;
