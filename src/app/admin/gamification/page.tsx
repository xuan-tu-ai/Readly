import { Suspense } from "react";
import type { Metadata } from "next";
import { PageSkeleton } from "@/components/app-shell";
import { BadgeRow, NewBadge, PointTableForm } from "@/components/admin/gamification-forms";
import { BADGE_EMBLEMS, BADGE_TIERS, type BadgeEmblem, type BadgeTier } from "@/lib/art";
import { requireUser } from "@/server/auth/dal";
import { db } from "@/server/db";
import { getPointTable, listBadgeDefinitions } from "@/server/services/admin/gamification";

export const metadata: Metadata = { title: "Điểm & huy hiệu" };

const asEmblem = (k: string) => (BADGE_EMBLEMS.some((e) => e.key === k) ? k : "books") as BadgeEmblem;
const asTier = (k: string) => (BADGE_TIERS.some((t) => t.key === k) ? k : "bronze") as BadgeTier;

export default function GamificationPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Gamification />
    </Suspense>
  );
}

async function Gamification() {
  const user = await requireUser("ADMIN");
  const [table, badges, works] = await Promise.all([
    getPointTable(),
    listBadgeDefinitions(user),
    db.work.findMany({ where: { status: "PUBLISHED" }, orderBy: { title: "asc" }, select: { id: true, title: true } }),
  ]);
  return (
    <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] xl:items-start">
      <section className="grid gap-3 rounded-2xl border-2 bg-card p-5" aria-labelledby="points-heading">
        <h1 id="points-heading" className="text-2xl font-semibold">
          Bảng điểm
        </h1>
        <p className="text-sm text-muted-foreground">
          Điểm được lưu dạng sổ cái: đổi bảng điểm sẽ ghi bút toán điều chỉnh cho mọi học sinh (cộng hoặc trừ), không sửa lịch sử.
        </p>
        <PointTableForm table={table} />
      </section>
      <section className="grid gap-3" aria-labelledby="badges-heading">
        <h2 id="badges-heading" className="text-2xl font-semibold">
          Huy hiệu ({badges.length})
        </h2>
        <p className="text-sm text-muted-foreground">
          Mỗi huy hiệu theo một trong 5 mẫu điều kiện. Học sinh nhận một lần, ngay khi đủ điều kiện (kể cả với điều kiện đã đạt từ trước).
        </p>
        <NewBadge works={works} />
        <div className="grid gap-2">
          {badges.map((b) => (
            <BadgeRow
              key={b.id}
              works={works}
              badge={{
                id: b.id,
                name: b.name,
                description: b.description,
                rule: b.rule,
                threshold: b.threshold,
                workId: b.workId,
                emblem: asEmblem(b.emblem),
                tier: asTier(b.tier),
                active: b.active,
                awarded: b.awarded,
                workTitle: b.work?.title ?? null,
              }}
            />
          ))}
        </div>
      </section>
    </div>
  );
}
