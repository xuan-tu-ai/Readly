import { vnDateString } from "@/lib/teacher";
import { requireUser } from "@/server/auth/dal";
import { DomainError } from "@/server/errors";
import { buildClassWorkbook, reportFileName } from "@/server/reports/class-report";
import { getClassDashboard } from "@/server/services/teacher";

/** Downloads the class reading report (.xlsx). */
export async function GET(_request: Request, ctx: RouteContext<"/teacher/classes/[classId]/export">) {
  const user = await requireUser("TEACHER");
  const { classId } = await ctx.params;
  const now = new Date();
  let data;
  try {
    data = await getClassDashboard(user, classId, now);
  } catch (error) {
    if (error instanceof DomainError) return new Response("Không tìm thấy lớp.", { status: 404 });
    throw error;
  }
  const buffer = await buildClassWorkbook(data, now);
  const name = reportFileName(data.class.name, vnDateString(now));
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${name.ascii}"; filename*=UTF-8''${encodeURIComponent(name.utf8)}`,
      "Cache-Control": "private, no-store",
    },
  });
}
