import { beforeEach, describe, expect, it, vi } from "vitest";
import { cleanClassCode, detectPlatform } from "@/lib/install";

const requestHeaders = new Headers();
vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ headers: async () => requestHeaders }));
const { qrSvg, requestOrigin } = await import("@/server/qr");

describe("cleanClassCode", () => {
  it("keeps a class code from a QR link, upper-cased", () => {
    expect(cleanClassCode("demo12", 6)).toBe("DEMO12");
  });

  it("drops anything a class code cannot contain and caps the length", () => {
    expect(cleanClassCode(" de-mo 12<script>", 6)).toBe("DEMO12");
    expect(cleanClassCode("ABCDEFGHIJ", 6)).toBe("ABCDEF");
  });

  it("returns nothing for a missing or empty code", () => {
    expect(cleanClassCode(undefined, 6)).toBeUndefined();
    expect(cleanClassCode("", 6)).toBeUndefined();
    expect(cleanClassCode("---", 6)).toBeUndefined();
  });

  it("uses the first value when the parameter repeats", () => {
    expect(cleanClassCode(["abc123", "zzz999"], 6)).toBe("ABC123");
  });
});

describe("detectPlatform", () => {
  it("recognises iPhone, and iPad that reports itself as a Mac", () => {
    expect(detectPlatform("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15")).toBe("ios");
    expect(detectPlatform("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15", 5)).toBe("ios");
  });

  it("recognises Android, and treats a Mac without touch as a computer", () => {
    expect(detectPlatform("Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/131.0 Mobile")).toBe("android");
    expect(detectPlatform("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15", 0)).toBe("desktop");
    expect(detectPlatform("Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/131.0")).toBe("desktop");
  });
});

describe("requestOrigin", () => {
  beforeEach(() => {
    for (const key of [...requestHeaders.keys()]) requestHeaders.delete(key);
  });

  it("uses the public host and scheme forwarded by the proxy", async () => {
    requestHeaders.set("host", "10.0.0.5:3000");
    requestHeaders.set("x-forwarded-host", "readly.up.railway.app");
    requestHeaders.set("x-forwarded-proto", "https");
    expect(await requestOrigin()).toBe("https://readly.up.railway.app");
  });

  it("falls back to http on localhost and https elsewhere", async () => {
    requestHeaders.set("host", "localhost:3000");
    expect(await requestOrigin()).toBe("http://localhost:3000");
    requestHeaders.set("host", "readly.example");
    expect(await requestOrigin()).toBe("https://readly.example");
  });
});

describe("qrSvg", () => {
  it("draws dark modules on white so it scans in dark mode too", async () => {
    const svg = await qrSvg("https://readly.example/register?code=DEMO12");
    expect(svg).toMatch(/^<svg[^>]*viewBox/);
    expect(svg).toContain('fill="#ffffff"');
    expect(svg).toContain('stroke="#2d2a36"');
  });
});
