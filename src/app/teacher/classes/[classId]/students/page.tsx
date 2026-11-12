import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { PageSkeleton } from "@/components/app-shell";
import { CatAvatar } from "@/components/art/avatars";
import { StreakFlame } from "@/components/art/game-icons";
import { LevelEmblem } from "@/components/art/level";
import { Mascot } from "@/components/mascot/mascot";
import { cn } from "@/lib/utils";
import { getClassStudents } from "@/server/services/teacher";
import { loadForTeacher } from "../load";
import { formatDayMonth } from "@/lib/vn-date";

export const metadata: Metadata = { title: "Học sinh" };

export default function ClassStudentsPage({ params }: PageProps<"/teacher/classes/[classId]/students">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Students params={params} />
    </Suspense>
  );
}

async function Students({ params }: Pick<PageProps<"/teacher/classes/[classId]/students">, "params">) {
  const { classId } = await params;
  const data = await loadForTeacher((user) => getClassStudents(user, classId));

  if (data.students.length === 0) {
    return (
      <div className="grid justify-items-center gap-3 rounded-2xl border-2 border-dashed p-10 text-center">
        <Mascot pose="wave" size={96} label="" />
        <p className="font-bold">Chưa có học sinh nào</p>
        <p className="max-w-sm text-sm text-muted-foreground">
          Gửi mã lớp <span className="font-mono font-bold tracking-widest">{data.class.code}</span> để các em đăng ký.
        </p>
      </div>
    );
  }

  return (
    <section className="grid gap-3" aria-labelledby="students-heading">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="students-heading" className="text-2xl font-semibold">
          {data.students.length} học sinh
        </h2>
        <p className="text-sm text-muted-foreground">Sắp xếp theo tên. Bấm vào một em để xem chi tiết và quản lý tài khoản.</p>
      </div>
      <div className="overflow-x-auto rounded-2xl border-2 bg-card">
        <table className="w-full min-w-[46rem] text-sm">
          <thead className="text-left text-xs text-muted-foreground">
            <tr className="border-b-2">
              <th className="px-4 py-3 font-bold">Học sinh</th>
              <th className="px-2 py-3 font-bold">Cấp độ</th>
              <th className="px-2 py-3 text-right font-bold">Điểm</th>
              <th className="px-2 py-3 font-bold">Streak</th>
              <th className="px-2 py-3 font-bold">Bài giao</th>
              <th className="px-2 py-3 text-right font-bold">Đọc bài giao</th>
              <th className="px-2 py-3 font-bold">Đọc gần nhất</th>
              <th className="w-8" aria-hidden />
            </tr>
          </thead>
          <tbody>
            {data.students.map((s) => (
              <tr key={s.id} className="group relative border-t hover:bg-muted/50">
                <td className="px-4 py-2.5">
                  <div className="flex items-center gap-3">
                    <CatAvatar avatar={s.avatar} size={36} label="" />
                    <div className="min-w-0">
                      <Link
                        href={`/teacher/classes/${classId}/students/${s.id}`}
                        className="font-bold after:absolute after:inset-0 hover:underline"
                      >
                        {s.name}
                      </Link>
                      <p className="truncate text-xs text-muted-foreground">{s.email}</p>
                    </div>
                  </div>
                </td>
                <td className="px-2 py-2.5">
                  <span className="flex items-center gap-1.5 whitespace-nowrap">
                    <LevelEmblem level={s.level.level} size={26} label="" />
                    {s.level.name}
                  </span>
                </td>
                <td className="px-2 py-2.5 text-right font-bold tabular-nums">{s.points}</td>
                <td className="px-2 py-2.5">
                  <span className="flex items-center gap-1 tabular-nums">
                    <StreakFlame size={18} lit={s.streak > 0} label="" /> {s.streak} ngày
                  </span>
                </td>
                <td className="px-2 py-2.5 whitespace-nowrap">
                  <span className="tabular-nums">
                    {s.done}/{data.assignmentCount} xong
                  </span>
                  {s.overdue > 0 ? (
                    <span className={cn("ml-2 rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-bold text-destructive")}>
                      {s.overdue} quá hạn
                    </span>
                  ) : null}
                </td>
                <td className="px-2 py-2.5 text-right tabular-nums">{s.minutes} ph</td>
                <td className="px-2 py-2.5 text-muted-foreground">{s.lastReadAt ? formatDayMonth(s.lastReadAt) : "–"}</td>
                <td className="pr-3">
                  <ChevronRight className="size-4 text-muted-foreground" aria-hidden />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
