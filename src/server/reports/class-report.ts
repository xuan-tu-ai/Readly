import ExcelJS from "exceljs";
import { progressText } from "@/lib/teacher";
import type { ClassDashboard } from "@/server/services/teacher";
import { formatDate, formatDateTime } from "@/lib/vn-date";

/**
 * Class reading report as .xlsx (spec §10):
 * - "Chi tiết": one row per student, one column per assigned work
 *   (status / % / completion date), plus total reading time;
 * - "Tổng hợp": completion rate and average reading time per work.
 */

const FILL = {
  header: "FFE8F5EC",
  done: "FFDDF4E4",
  late: "FFFFF1CC",
  overdue: "FFFDE0DC",
} as const;

const fill = (argb: string): ExcelJS.Fill => ({ type: "pattern", pattern: "solid", fgColor: { argb } });

function styleHeader(row: ExcelJS.Row) {
  row.font = { bold: true };
  row.alignment = { vertical: "middle", wrapText: true };
  row.height = 34;
  row.eachCell((cell) => {
    cell.fill = fill(FILL.header);
    cell.border = { bottom: { style: "thin", color: { argb: "FF9CC9A8" } } };
  });
}

function titleRows(sheet: ExcelJS.Worksheet, title: string, lastColumn: number, generatedAt: Date) {
  sheet.addRow([title]).font = { bold: true, size: 14 };
  sheet.addRow([`Xuất lúc ${formatDateTime(generatedAt)} (giờ Việt Nam) · Readly`]).font = { italic: true, color: { argb: "FF666666" } };
  sheet.mergeCells(1, 1, 1, Math.max(1, lastColumn));
  sheet.mergeCells(2, 1, 2, Math.max(1, lastColumn));
  sheet.addRow([]);
}

export async function buildClassWorkbook(data: ClassDashboard, generatedAt = new Date()): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Readly";
  workbook.created = generatedAt;
  const className = data.class.name;

  // ── Chi tiết ──
  const detail = workbook.addWorksheet("Chi tiết", { views: [{ state: "frozen", xSplit: 3, ySplit: 4 }] });
  const detailHeaders = [
    "STT",
    "Họ tên",
    "Email",
    ...data.assignments.map((a) => `${a.work.title}\n(hạn ${formatDate(a.dueAt)})`),
    "Thời gian đọc bài giao (phút)",
  ];
  titleRows(detail, `Báo cáo đọc – lớp ${className}`, detailHeaders.length, generatedAt);
  styleHeader(detail.addRow(detailHeaders));
  data.members.forEach((member, index) => {
    const cells = data.assignments.map((a) => a.students.find((s) => s.id === member.id)!);
    const row = detail.addRow([
      index + 1,
      member.name,
      member.email,
      ...cells.map((c) => progressText(c, (d) => formatDate(d))),
      cells.reduce((sum, c) => sum + c.minutes, 0),
    ]);
    cells.forEach((c, i) => {
      const color = c.overdue ? FILL.overdue : c.late ? FILL.late : c.status === "done" ? FILL.done : null;
      if (color) row.getCell(4 + i).fill = fill(color);
    });
  });
  detail.columns.forEach((column, i) => {
    column.width = i === 0 ? 6 : i === 1 ? 26 : i === 2 ? 30 : i === detailHeaders.length - 1 ? 16 : 24;
  });

  // ── Tổng hợp ──
  const summary = workbook.addWorksheet("Tổng hợp", { views: [{ state: "frozen", ySplit: 4 }] });
  const summaryHeaders = [
    "Tác phẩm",
    "Tác giả",
    "Hạn đọc",
    "Số học sinh",
    "Hoàn thành",
    "Tỷ lệ hoàn thành",
    "Đúng hạn",
    "Trễ hạn",
    "Đang đọc",
    "Chưa đọc",
    "Quá hạn chưa xong",
    "Thời gian đọc TB (phút / HS đã đọc)",
  ];
  titleRows(summary, `Tổng hợp – lớp ${className} (${data.members.length} học sinh)`, summaryHeaders.length, generatedAt);
  styleHeader(summary.addRow(summaryHeaders));
  for (const a of data.assignments) {
    const s = a.summary;
    const row = summary.addRow([
      a.work.title,
      a.work.author,
      formatDate(a.dueAt),
      s.total,
      s.done,
      s.completionRate,
      s.onTime,
      s.late,
      s.reading,
      s.notStarted,
      s.overdue,
      a.avgMinutes,
    ]);
    row.getCell(6).numFmt = "0%";
  }
  if (data.assignments.length === 0) summary.addRow(["Lớp chưa có tác phẩm được giao."]);
  summary.columns.forEach((column, i) => {
    column.width = i === 0 ? 30 : i === 1 ? 22 : i === summaryHeaders.length - 1 ? 22 : 13;
  });

  return Buffer.from(await workbook.xlsx.writeBuffer());
}

/** "bao-cao-12a1-2026-11-12.xlsx": ASCII name for old clients, the Vietnamese one via filename*. */
export function reportFileName(className: string, date: string) {
  const ascii = className
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return {
    ascii: `bao-cao-${ascii || "lop"}-${date}.xlsx`,
    utf8: `Báo cáo đọc ${className} ${date}.xlsx`,
  };
}
