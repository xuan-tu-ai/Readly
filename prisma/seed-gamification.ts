/**
 * Default badges and sample mini games. Idempotent: badges are upserted by
 * key; mini games are only created for works that have none yet. The admin
 * can change all of this in phase 8.
 */
import type { BadgeRule, Genre } from "../src/generated/prisma/enums";
import type { PrismaClient } from "../src/generated/prisma/client";
import type { BadgeEmblem, BadgeTier } from "../src/lib/art";
import { detailDataSchema, matchDataSchema, type DetailData } from "../src/lib/minigames";

type SeedBadge = {
  key: string;
  name: string;
  description: string;
  rule: BadgeRule;
  threshold?: number;
  workSlug?: string;
  emblem: BadgeEmblem;
  tier: BadgeTier;
};

export const DEFAULT_BADGES: SeedBadge[] = [
  { key: "works-1", name: "Trang sách đầu tiên", description: "Hoàn thành tác phẩm đầu tiên.", rule: "WORKS_COMPLETED", threshold: 1, emblem: "books", tier: "bronze" },
  { key: "works-5", name: "Mọt sách nhỏ", description: "Hoàn thành 5 tác phẩm.", rule: "WORKS_COMPLETED", threshold: 5, emblem: "books", tier: "silver" },
  { key: "works-15", name: "Kệ sách đầy", description: "Hoàn thành 15 tác phẩm.", rule: "WORKS_COMPLETED", threshold: 15, emblem: "books", tier: "gold" },
  { key: "works-45", name: "Đọc trọn chương trình", description: "Hoàn thành cả 45 tác phẩm.", rule: "WORKS_COMPLETED", threshold: 45, emblem: "books", tier: "diamond" },
  { key: "genres-3", name: "Nhà thám hiểm thể loại", description: "Hoàn thành tác phẩm thuộc 3 thể loại khác nhau.", rule: "GENRES_COMPLETED", threshold: 3, emblem: "genres", tier: "silver" },
  { key: "genres-6", name: "Đủ sáu sắc màu", description: "Hoàn thành tác phẩm thuộc cả 6 thể loại.", rule: "GENRES_COMPLETED", threshold: 6, emblem: "genres", tier: "gold" },
  { key: "streak-3", name: "Đốm lửa nhỏ", description: "Đọc 3 ngày liên tiếp.", rule: "STREAK_DAYS", threshold: 3, emblem: "flame", tier: "bronze" },
  { key: "streak-7", name: "Một tuần đều đặn", description: "Đọc 7 ngày liên tiếp.", rule: "STREAK_DAYS", threshold: 7, emblem: "flame", tier: "silver" },
  { key: "streak-30", name: "Ngọn lửa bền bỉ", description: "Đọc 30 ngày liên tiếp.", rule: "STREAK_DAYS", threshold: 30, emblem: "flame", tier: "gold" },
  { key: "deep-1", name: "Suy nghĩ sâu", description: "Có câu trả lời đầu tiên đạt mức Sâu sắc.", rule: "DEEP_ANSWERS", threshold: 1, emblem: "gem", tier: "bronze" },
  { key: "deep-10", name: "Ngòi bút tinh tế", description: "10 câu trả lời đạt mức Sâu sắc.", rule: "DEEP_ANSWERS", threshold: 10, emblem: "gem", tier: "silver" },
  { key: "deep-30", name: "Nhà phê bình trẻ", description: "30 câu trả lời đạt mức Sâu sắc.", rule: "DEEP_ANSWERS", threshold: 30, emblem: "gem", tier: "gold" },
  { key: "work-truyen-ngan-mau-01", name: "Người kể chuyện", description: "Hoàn thành “Truyện ngắn mẫu 01”.", rule: "WORK_COMPLETED", workSlug: "truyen-ngan-mau-01", emblem: "trophy", tier: "gold" },
];

export async function seedBadges(db: PrismaClient) {
  let count = 0;
  for (const { workSlug, threshold, ...badge } of DEFAULT_BADGES) {
    const workId = workSlug ? (await db.work.findUnique({ where: { slug: workSlug }, select: { id: true } }))?.id : null;
    if (workSlug && !workId) continue;
    const data = { ...badge, threshold: threshold ?? null, workId: workId ?? null };
    await db.badgeDefinition.upsert({ where: { key: badge.key }, update: data, create: data });
    count++;
  }
  return count;
}

/** Fill-in-the-blank items built from the placeholder segment text of each genre. */
function detailItems(genre: Genre, unlockOrder: number): DetailData["items"] {
  if (genre === "THO") {
    return [
      { id: "d1", text: "Dòng thơ mẫu thứ hai, gió qua hàng ___", options: ["tre", "cau", "dừa", "lúa"], answer: 0 },
      { id: "d2", text: "Dòng thơ mẫu thứ ba, ___ vàng trên đê", options: ["mây", "nắng", "lá"], answer: 1 },
      { id: "d3", text: "Dòng thơ mẫu thứ tư khép lại khổ ___", options: ["1", String(unlockOrder), "5"], answer: 1 },
    ];
  }
  if (genre === "KICH") {
    return [
      { id: "d1", text: "(Chỉ dẫn sân khấu mẫu: ánh đèn ___ xuống.)", options: ["tắt", "dịu", "rọi"], answer: 1 },
      { id: "d2", text: "Và đây là lời đáp mẫu, để kiểm tra cách trình bày ___.", options: ["kịch", "thơ", "truyện"], answer: 0 },
      { id: "d3", text: "Đây là lời thoại mẫu của cảnh ___.", options: [String(unlockOrder), "4", "5"], answer: 0 },
    ];
  }
  return [
    { id: "d1", text: "Câu văn này chỉ dùng để giữ ___, giúp kiểm tra bố cục trang đọc.", options: ["nhịp", "chỗ", "lời", "lửa"], answer: 1 },
    { id: "d2", text: "…giúp kiểm tra bố cục trang đọc, cỡ chữ và ___ dòng.", options: ["màu sắc", "độ dài", "khoảng cách"], answer: 2 },
    {
      id: "d3",
      text: "Nội dung thật của tác phẩm sẽ ___ đoạn này.",
      options: ["thay thế", "rút gọn", "dịch"],
      answer: 0,
      explanation: "Văn bản hiện tại chỉ là chữ giữ chỗ.",
    },
  ];
}

/** Two sample games per readable work: "Đoán chi tiết" after segment 2, "Ghép" after segment 4. */
export async function seedMiniGames(db: PrismaClient, workId: string, genre: Genre) {
  if ((await db.miniGame.count({ where: { workId } })) > 0) return 0;
  const segments = await db.segment.findMany({
    where: { workId, archivedAt: null },
    orderBy: { order: "asc" },
    select: { id: true, order: true, title: true },
  });
  if (segments.length < 2) return 0;
  const second = segments[1];
  const fourth = segments[Math.min(3, segments.length - 1)];

  const detail = detailDataSchema.parse({ items: detailItems(genre, second.order) });
  const match = matchDataSchema.parse({
    pairs: segments.slice(0, 4).map((s, i) => ({
      id: `p${i + 1}`,
      left: `Nhân vật ${String.fromCharCode(65 + i)}`,
      right: `Sự kiện mẫu ở ${s.title ?? `phần ${s.order}`}`,
    })),
  });

  await db.miniGame.createMany({
    data: [
      { workId, unlockSegmentId: second.id, type: "DETAIL", title: "[Mini game mẫu] Đoán chi tiết", data: detail, order: 1 },
      { workId, unlockSegmentId: fourth.id, type: "MATCH", title: "[Mini game mẫu] Ghép nhân vật – sự kiện", data: match, order: 2 },
    ],
  });
  return 2;
}
