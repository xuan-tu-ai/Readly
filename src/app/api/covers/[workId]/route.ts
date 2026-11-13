import { getCoverImage } from "@/server/services/admin/covers";

/**
 * Serves an uploaded cover. The URL carries `?v=<updatedAt>`, so the image can
 * be cached for a year: a new upload gets a new URL.
 */
export async function GET(request: Request, ctx: RouteContext<"/api/covers/[workId]">) {
  const { workId } = await ctx.params;
  const image = await getCoverImage(workId);
  if (!image) return new Response(null, { status: 404 });
  const versioned = new URL(request.url).searchParams.get("v") === String(image.updatedAt.getTime());
  return new Response(new Uint8Array(image.data), {
    headers: {
      "Content-Type": image.mime,
      "Cache-Control": versioned ? "public, max-age=31536000, immutable" : "public, max-age=300",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
