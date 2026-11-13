import { qrSvg } from "@/server/qr";
import { cn } from "@/lib/utils";

/** Server-rendered QR code (inline SVG, no client JS). Always on white so it scans in dark mode too. */
export async function QrCode({ value, label, className }: { value: string; label: string; className?: string }) {
  const svg = await qrSvg(value);
  return (
    <div
      role="img"
      aria-label={label}
      className={cn("aspect-square rounded-2xl bg-white p-1.5 [&_svg]:block [&_svg]:size-full", className)}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
