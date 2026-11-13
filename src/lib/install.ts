/** "Cài ứng dụng" (PWA install) support shared by the head script and the install button. */

export const INSTALL_CHANGE = "readly-install-change";

/**
 * Runs in <head>: Chrome/Edge fire `beforeinstallprompt` once, early, often
 * before React hydrates. Keep the event so the install button can show the
 * browser's own install dialog later. Mirrors `InstallWindow` in install-app.tsx.
 */
export const INSTALL_SCRIPT = `(function(){function c(){dispatchEvent(new Event("${INSTALL_CHANGE}"))}addEventListener("beforeinstallprompt",function(e){e.preventDefault();window.__readlyInstall=e;c()});addEventListener("appinstalled",function(){window.__readlyInstall=null;window.__readlyInstalled=true;c()})})()`;

export type InstallPlatform = "ios" | "android" | "desktop";

export function detectPlatform(userAgent: string, maxTouchPoints = 0): InstallPlatform {
  // iPadOS reports itself as a Mac; touch support gives it away.
  if (/iPhone|iPad|iPod/i.test(userAgent) || (/Macintosh/i.test(userAgent) && maxTouchPoints > 1)) return "ios";
  if (/Android/i.test(userAgent)) return "android";
  return "desktop";
}

/** Keeps only what a class code can contain, so a pasted QR link never injects odd input. */
export function cleanClassCode(raw: string | string[] | undefined, maxLength: number): string | undefined {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (!value) return undefined;
  const code = value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, maxLength);
  return code || undefined;
}
