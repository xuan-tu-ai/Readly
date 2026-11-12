import { Suspense } from "react";
import type { Metadata } from "next";
import { PageSkeleton } from "@/components/app-shell";
import { ClassCodeControls } from "@/components/teacher/class-controls";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { setLeaderboardAction } from "@/app/actions/gamification";
import { loadClass } from "../load";

export const metadata: Metadata = { title: "Cài đặt lớp" };

export default function ClassSettingsPage({ params }: PageProps<"/teacher/classes/[classId]/settings">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <ClassSettings params={params} />
    </Suspense>
  );
}

async function ClassSettings({ params }: Pick<PageProps<"/teacher/classes/[classId]/settings">, "params">) {
  const { classId } = await params;
  const { cls } = await loadClass(classId);
  return (
    <div className="grid max-w-2xl gap-6">
      <Card>
        <CardHeader>
          <CardDescription>Mã lớp</CardDescription>
          <CardTitle className="font-mono text-3xl tracking-[0.3em]">{cls.code}</CardTitle>
          <CardDescription>
            {cls.codeActive
              ? "Học sinh dùng mã này để đăng ký hoặc chuyển vào lớp."
              : "Mã đang bị khóa – không ai đăng ký thêm được."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ClassCodeControls classId={cls.id} codeActive={cls.codeActive} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Bảng xếp hạng tuần</CardTitle>
          <CardDescription>
            {cls.leaderboardEnabled
              ? "Đang bật: học sinh thấy điểm tuần của cả lớp (làm mới mỗi thứ Hai)."
              : "Đang tắt: học sinh vẫn nhận điểm, streak và huy hiệu nhưng không thấy bảng xếp hạng."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={setLeaderboardAction}>
            <input type="hidden" name="classId" value={cls.id} />
            <input type="hidden" name="enabled" value={cls.leaderboardEnabled ? "false" : "true"} />
            <Button type="submit" variant="outline">
              {cls.leaderboardEnabled ? "Tắt bảng xếp hạng" : "Bật bảng xếp hạng"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
