import type { Metadata } from "next";
import Image from "next/image";
import { Suspense, type ReactNode } from "react";
import { PageSkeleton } from "@/components/app-shell";
import { BadgeArt } from "@/components/art/badge";
import { CatAvatar } from "@/components/art/avatars";
import { Confetti, Sunburst } from "@/components/art/celebration";
import {
  ChestIcon,
  CrownIcon,
  DetailGameIcon,
  LockIcon,
  MatchGameIcon,
  RankMedal,
  StarIcon,
  StreakFlame,
  XpIcon,
} from "@/components/art/game-icons";
import { LevelEmblem } from "@/components/art/level";
import { DiscussionIcon, NotificationIcon } from "@/components/art/notification-icons";
import { MASCOT_POSES, Mascot } from "@/components/mascot/mascot";
import {
  AVATARS,
  BADGE_EMBLEMS,
  BADGE_TIERS,
  DISCUSSION_MARKERS,
  LEVELS,
  NOTIFICATION_KINDS,
} from "@/lib/art";
import { requireUser } from "@/server/auth/dal";

export const metadata: Metadata = { title: "Thư viện hình ảnh" };

/**
 * Every illustration in the art library, with the key stored in the
 * database. Used to review the set now and to pick badge icons later.
 */
export default function AssetsPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Assets />
    </Suspense>
  );
}

async function Assets() {
  await requireUser("ADMIN");
  return (
    <div className="grid gap-10">
      <div>
        <h1 className="text-3xl font-semibold">Thư viện hình ảnh</h1>
        <p className="text-muted-foreground">
          Toàn bộ hình dùng cho game hóa, thông báo và hồ sơ. Mã (key) bên dưới mỗi hình là giá trị lưu trong cơ sở dữ liệu.
        </p>
      </div>

      <Section title="Cấp độ" description="Ngưỡng điểm mặc định theo spec §8.2.">
        <div className="flex flex-wrap gap-6 rounded-2xl border-2 bg-card p-5">
          {LEVELS.map((l) => (
            <figure key={l.level} className="grid justify-items-center gap-1 text-center">
              <LevelEmblem level={l.level} size={110} label="" />
              <figcaption className="text-sm font-bold">{l.name}</figcaption>
              <span className="text-xs text-muted-foreground">
                cấp {l.level} · từ {l.minPoints} điểm
              </span>
            </figure>
          ))}
        </div>
      </Section>

      <Section title="Game hóa" description="Streak, điểm, bảng xếp hạng, đánh giá và mini game.">
        <Grid>
          <Item name="Streak đang giữ" code="StreakFlame">
            <StreakFlame size={56} />
          </Item>
          <Item name="Streak đã tắt" code="StreakFlame lit={false}">
            <StreakFlame lit={false} size={56} />
          </Item>
          <Item name="Điểm (XP)" code="XpIcon">
            <XpIcon size={56} />
          </Item>
          <Item name="Hạng 1" code="RankMedal rank={1}">
            <RankMedal rank={1} size={56} />
          </Item>
          <Item name="Hạng 2" code="RankMedal rank={2}">
            <RankMedal rank={2} size={56} />
          </Item>
          <Item name="Hạng 3" code="RankMedal rank={3}">
            <RankMedal rank={3} size={56} />
          </Item>
          <Item name="Đứng đầu tuần" code="CrownIcon">
            <CrownIcon size={56} />
          </Item>
          <Item name="Sao (có / chưa)" code="StarIcon">
            <span className="flex">
              <StarIcon size={36} />
              <StarIcon size={36} />
              <StarIcon size={36} filled={false} />
            </span>
          </Item>
          <Item name="Ghép nhân vật – sự kiện" code="MatchGameIcon">
            <MatchGameIcon size={56} />
          </Item>
          <Item name="Đoán chi tiết" code="DetailGameIcon">
            <DetailGameIcon size={56} />
          </Item>
          <Item name="Chưa mở" code="LockIcon">
            <LockIcon size={56} />
          </Item>
          <Item name="Phần thưởng" code="ChestIcon">
            <ChestIcon size={56} />
          </Item>
        </Grid>
      </Section>

      <Section title="Hiệu ứng ăn mừng" description="Confetti rơi một lần và tia sáng xoay chậm; tắt khi người dùng chọn giảm chuyển động.">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="relative grid h-64 place-items-center overflow-hidden rounded-2xl border-2 bg-card">
            <Confetti loop />
            <p className="font-heading text-2xl font-semibold">Confetti</p>
          </div>
          <div className="grid h-64 place-items-center overflow-hidden rounded-2xl border-2 bg-card">
            <Sunburst size={230}>
              <LevelEmblem level={3} size={110} label="" />
            </Sunburst>
          </div>
        </div>
      </Section>

      <Section title="Mướp" description="Các tư thế của linh vật và chỗ nên dùng.">
        <Grid>
          {MASCOT_POSES.map((p) => (
            <Item key={p.pose} name={p.label} code={p.pose} note={p.use}>
              <Mascot pose={p.pose} size={110} label="" />
            </Item>
          ))}
        </Grid>
      </Section>

      <Section title="Avatar" description="Học sinh chọn một avatar cho hồ sơ đọc.">
        <Grid>
          {AVATARS.map((a) => (
            <Item key={a.key} name={a.label} code={a.key}>
              <CatAvatar avatar={a.key} size={88} label="" />
            </Item>
          ))}
        </Grid>
      </Section>

      <Section title="Thông báo & thảo luận">
        <Grid>
          {NOTIFICATION_KINDS.map((n) => (
            <Item key={n.key} name={n.label} code={n.key}>
              <NotificationIcon kind={n.key} size="lg" />
            </Item>
          ))}
          {DISCUSSION_MARKERS.map((d) => (
            <Item key={d.key} name={d.label} code={d.key}>
              <DiscussionIcon marker={d.key} size="lg" />
            </Item>
          ))}
        </Grid>
      </Section>

      <Section
        title="App icon"
        description="Tạo từ assets/brand/*.svg bằng npm run icons. Dùng cho tab trình duyệt, màn hình chính và thông báo đẩy."
      >
        <Grid>
          {[
            { src: "/icons/icon-512.png", name: "Icon PWA", code: "public/icons/icon-512.png", dark: false },
            { src: "/icons/icon-maskable-512.png", name: "Icon maskable", code: "public/icons/icon-maskable-512.png", dark: false },
            { src: "/apple-icon.png", name: "Apple touch icon", code: "src/app/apple-icon.png", dark: false },
            { src: "/icon.svg", name: "Favicon (SVG)", code: "src/app/icon.svg", dark: false },
            { src: "/icons/badge-96.png", name: "Badge thông báo", code: "public/icons/badge-96.png", dark: true },
          ].map((i) => (
            <Item key={i.code} name={i.name} code={i.code}>
              <span className={i.dark ? "rounded-xl bg-neutral-800 p-2" : undefined}>
                <Image src={i.src} alt="" width={72} height={72} unoptimized className="rounded-xl" />
              </span>
            </Item>
          ))}
        </Grid>
      </Section>

      <Section title="Huy hiệu" description="Mỗi hình chính có 4 bậc khung: đồng, bạc, vàng, kim cương; và trạng thái chưa mở khóa.">
        <div className="grid gap-6">
          {BADGE_EMBLEMS.map((e) => (
            <div key={e.key} className="grid gap-2 rounded-2xl border-2 bg-card p-4">
              <p className="text-sm">
                <span className="font-bold">{e.label}</span> · <code className="text-xs">{e.key}</code> ·{" "}
                <span className="text-muted-foreground">{e.hint}</span>
              </p>
              <div className="flex flex-wrap items-end gap-4">
                {BADGE_TIERS.map((t) => (
                  <figure key={t.key} className="grid justify-items-center gap-1">
                    <BadgeArt emblem={e.key} tier={t.key} size={84} label={`${e.label} – ${t.label}`} />
                    <figcaption className="text-xs text-muted-foreground">{t.label}</figcaption>
                  </figure>
                ))}
                <figure className="grid justify-items-center gap-1">
                  <BadgeArt emblem={e.key} tier="gold" locked size={84} label={`${e.label} – chưa mở khóa`} />
                  <figcaption className="text-xs text-muted-foreground">Chưa mở</figcaption>
                </figure>
                <figure className="grid justify-items-center gap-1">
                  <BadgeArt emblem={e.key} tier="diamond" caption="30 NGÀY" size={84} label={`${e.label} có ruy băng`} />
                  <figcaption className="text-xs text-muted-foreground">Có ruy băng</figcaption>
                </figure>
              </div>
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
}

function Grid({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">{children}</div>;
}

function Item({ name, code, note, children }: { name: string; code: string; note?: string; children: ReactNode }) {
  return (
    <figure className="grid content-start justify-items-center gap-2 rounded-2xl border-2 bg-card p-4 text-center">
      <div className="grid min-h-24 place-items-center">{children}</div>
      <figcaption className="grid gap-0.5">
        <span className="text-sm font-bold">{name}</span>
        <code className="text-[0.7rem] text-muted-foreground">{code}</code>
        {note ? <span className="text-xs text-muted-foreground">{note}</span> : null}
      </figcaption>
    </figure>
  );
}

function Section({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <section className="grid gap-4">
      <div>
        <h2 className="font-heading text-2xl font-semibold">{title}</h2>
        {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {children}
    </section>
  );
}
