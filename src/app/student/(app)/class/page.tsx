import { Suspense } from "react";
import { PageSkeleton } from "@/components/app-shell";
import type { Metadata } from "next";
import { MascotSays } from "@/components/mascot/mascot";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireUser } from "@/server/auth/dal";
import { getActiveClass } from "@/server/services/classes";
import { JoinClassForm } from "./join-class-form";

export const metadata: Metadata = { title: "Lớp học" };

const dateFormat = new Intl.DateTimeFormat("vi-VN", { dateStyle: "medium", timeZone: "Asia/Ho_Chi_Minh" });

export default function StudentClassPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <StudentClass />
    </Suspense>
  );
}

async function StudentClass() {
  const user = await requireUser("STUDENT");
  const activeClass = await getActiveClass(user.id);

  return (
    <div className="grid gap-6">
      <MascotSays pose={activeClass ? "idle" : "think"} size={96}>
        <span className="block font-heading text-2xl font-semibold">Lớp học</span>
        <span className="text-muted-foreground">
          {activeClass ? `Bạn đang học lớp ${activeClass.name}.` : "Nhập mã lớp để nhận bài giao từ giáo viên nhé."}
        </span>
      </MascotSays>

      <Card>
        <CardHeader>
          <CardDescription>Lớp hiện tại</CardDescription>
          <CardTitle>{activeClass?.name ?? "Chưa có lớp"}</CardTitle>
        </CardHeader>
        {activeClass ? (
          <CardContent className="text-sm text-muted-foreground">
            Giáo viên {activeClass.teacher.name} · tham gia từ {dateFormat.format(activeClass.joinedAt)}
          </CardContent>
        ) : null}
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{activeClass ? "Chuyển lớp" : "Tham gia lớp"}</CardTitle>
          <CardDescription>
            Nhập mã lớp mới do giáo viên cung cấp. Tiến độ đọc, điểm, huy hiệu và các đoạn đã tô
            sáng của bạn được giữ nguyên.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <JoinClassForm />
        </CardContent>
      </Card>
    </div>
  );
}
