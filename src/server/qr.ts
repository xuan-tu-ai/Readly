import "server-only";
import { headers } from "next/headers";
import QRCode from "qrcode";

/** Public origin of this request ("https://…"), as seen through Railway's proxy. */
export async function requestOrigin(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host")?.split(",")[0].trim() || h.get("host") || "localhost:3000";
  const local = /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(host);
  const proto = h.get("x-forwarded-proto")?.split(",")[0].trim() || (local ? "http" : "https");
  return `${proto}://${host}`;
}

/** QR code as an SVG string: dark modules on white so any phone camera reads it, in light or dark mode. */
export function qrSvg(text: string): Promise<string> {
  return QRCode.toString(text, {
    type: "svg",
    margin: 1,
    errorCorrectionLevel: "M",
    color: { dark: "#2d2a36", light: "#ffffff" },
  });
}
