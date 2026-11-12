/**
 * Keys for the illustration library (src/components/art). Badges, levels and
 * avatars are stored in the database by these keys, so a key must never be
 * renamed once used; add new ones instead.
 */

export const BADGE_EMBLEMS = [
  { key: "books", label: "Chồng sách", hint: "Hoàn thành N tác phẩm" },
  { key: "genres", label: "Bánh xe thể loại", hint: "Hoàn thành tác phẩm thuộc N thể loại" },
  { key: "flame", label: "Ngọn lửa", hint: "Streak N ngày" },
  { key: "gem", label: "Viên ngọc", hint: "N câu trả lời mức Sâu sắc" },
  { key: "trophy", label: "Cúp", hint: "Hoàn thành một tác phẩm cụ thể" },
  { key: "quill", label: "Bút lông ngỗng", hint: "Viết đoạn cảm nhận" },
  { key: "magnifier", label: "Kính lúp", hint: "Khám phá, đoán chi tiết" },
  { key: "moon", label: "Trăng sao", hint: "Đọc buổi tối" },
  { key: "lotus", label: "Hoa sen", hint: "Văn học Việt Nam" },
  { key: "scroll", label: "Cuộn giấy", hint: "Tác phẩm cổ điển" },
  { key: "highlighter", label: "Bút dạ quang", hint: "Tô sáng" },
  { key: "speech", label: "Bong bóng thoại", hint: "Thảo luận" },
] as const;

export type BadgeEmblem = (typeof BADGE_EMBLEMS)[number]["key"];

export const BADGE_TIERS = [
  { key: "bronze", label: "Đồng" },
  { key: "silver", label: "Bạc" },
  { key: "gold", label: "Vàng" },
  { key: "diamond", label: "Kim cương" },
] as const;

export type BadgeTier = (typeof BADGE_TIERS)[number]["key"];

/** Reading levels (spec §8.2): default point thresholds, adjustable by the admin later. */
export const LEVELS = [
  { level: 1, name: "Tân thủ", minPoints: 0 },
  { level: 2, name: "Người đọc", minPoints: 300 },
  { level: 3, name: "Mọt sách", minPoints: 1000 },
  { level: 4, name: "Học giả", minPoints: 2500 },
  { level: 5, name: "Văn nhân", minPoints: 5000 },
] as const;

export type LevelNumber = (typeof LEVELS)[number]["level"];

export const AVATARS = [
  { key: "muop", label: "Mướp" },
  { key: "tro", label: "Tro" },
  { key: "mun", label: "Mun" },
  { key: "bong", label: "Bông" },
  { key: "tam-the", label: "Tam thể" },
  { key: "xiem", label: "Xiêm" },
  { key: "mi-mi", label: "Mi Mi" },
  { key: "gung", label: "Gừng" },
  { key: "khoai", label: "Khoai" },
  { key: "suong", label: "Sương" },
  { key: "dau", label: "Đậu" },
  { key: "cam", label: "Cam" },
] as const;

export type AvatarKey = (typeof AVATARS)[number]["key"];

/** A stable avatar for students who have not picked one yet. */
export function avatarFor(userId: string, chosen?: string | null): AvatarKey {
  if (chosen && AVATARS.some((a) => a.key === chosen)) return chosen as AvatarKey;
  let h = 0;
  for (const ch of userId) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return AVATARS[h % AVATARS.length].key;
}

/** In-app notification kinds (spec §11) and discussion markers (spec §7). */
export const NOTIFICATION_KINDS = [
  { key: "assignment", label: "Giao tác phẩm mới" },
  { key: "reminder", label: "Nhắc đọc / sắp đến hạn" },
  { key: "graded", label: "AI chấm xong" },
  { key: "teacher-review", label: "Giáo viên sửa mức" },
  { key: "badge", label: "Huy hiệu mới" },
  { key: "reply", label: "Có trả lời thảo luận" },
  { key: "level-up", label: "Lên cấp" },
  { key: "streak", label: "Giữ streak" },
] as const;

export type NotificationKind = (typeof NOTIFICATION_KINDS)[number]["key"];

export const DISCUSSION_MARKERS = [
  { key: "question", label: "Câu hỏi" },
  { key: "reflection", label: "Cảm nhận" },
  { key: "pinned", label: "Đã ghim" },
  { key: "resolved", label: "Đã giải đáp" },
  { key: "reported", label: "Bị báo cáo" },
] as const;

export type DiscussionMarker = (typeof DISCUSSION_MARKERS)[number]["key"];
