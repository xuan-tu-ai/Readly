import type { BadgeInput } from "@/lib/content/schemas";
import type { PointTable } from "@/lib/gamification";
import { effectiveLevel } from "@/lib/questions/rules";
import { rubricSchema } from "@/lib/questions/rules";
import type { Actor } from "@/lib/roles";
import { assertRole } from "@/server/authz";
import { db } from "@/server/db";
import { DomainError, notFound } from "@/server/errors";
import { evaluateBadges, getPointTable, recalculateAll } from "@/server/services/gamification";

/** Admin: point table, badges from rule templates (spec §8, §13) and the AI report queue. */

export { getPointTable };

/**
 * Saves the point table and recalculates every student's ledger, so totals,
 * levels and the leaderboard follow the new values (corrections are written
 * as ledger entries, nothing is rewritten).
 */
export async function updatePointTable(actor: Actor, table: PointTable) {
  assertRole(actor, "ADMIN");
  await db.gamificationConfig.upsert({ where: { id: 1 }, update: table, create: { id: 1, ...table } });
  const students = await recalculateAll();
  return { students };
}

export async function listBadgeDefinitions(actor: Actor) {
  assertRole(actor, "ADMIN");
  const badges = await db.badgeDefinition.findMany({
    orderBy: [{ active: "desc" }, { rule: "asc" }, { threshold: "asc" }, { createdAt: "asc" }],
    include: { work: { select: { title: true } }, _count: { select: { awards: true } } },
  });
  return badges.map(({ _count, ...b }) => ({ ...b, awarded: _count.awards }));
}

export type AdminBadge = Awaited<ReturnType<typeof listBadgeDefinitions>>[number];

function badgeColumns(input: BadgeInput) {
  return {
    name: input.name,
    description: input.description,
    rule: input.rule,
    threshold: input.rule === "WORK_COMPLETED" ? null : input.threshold ?? null,
    workId: input.rule === "WORK_COMPLETED" ? input.workId ?? null : null,
    emblem: input.emblem,
    tier: input.tier,
    active: input.active,
  };
}

/** Students who already meet a new (or reactivated) badge receive it right away. */
async function awardExisting() {
  const students = await db.user.findMany({ where: { role: "STUDENT" }, select: { id: true } });
  let awarded = 0;
  for (const s of students) awarded += (await evaluateBadges(s.id)).length;
  return awarded;
}

export async function createBadge(actor: Actor, input: BadgeInput) {
  assertRole(actor, "ADMIN");
  if (input.workId && !(await db.work.findUnique({ where: { id: input.workId }, select: { id: true } }))) {
    throw new DomainError("INVALID_INPUT", "Không tìm thấy tác phẩm.");
  }
  const badge = await db.badgeDefinition.create({ data: badgeColumns(input), select: { id: true } });
  return { id: badge.id, awarded: input.active ? await awardExisting() : 0 };
}

/** Rules of a badge someone already holds stay fixed; name, art and the active flag can change. */
export async function updateBadge(actor: Actor, badgeId: string, input: BadgeInput) {
  assertRole(actor, "ADMIN");
  const badge = await db.badgeDefinition.findUnique({ where: { id: badgeId }, include: { _count: { select: { awards: true } } } });
  if (!badge) notFound("Không tìm thấy huy hiệu.");
  const columns = badgeColumns(input);
  const ruleChanged = badge.rule !== columns.rule || badge.threshold !== columns.threshold || badge.workId !== columns.workId;
  if (ruleChanged && badge._count.awards > 0) {
    throw new DomainError("INVALID_INPUT", "Huy hiệu đã được trao nên không đổi điều kiện được. Hãy tạo huy hiệu mới.");
  }
  await db.badgeDefinition.update({ where: { id: badgeId }, data: columns });
  return { awarded: input.active ? await awardExisting() : 0 };
}

export async function deleteBadge(actor: Actor, badgeId: string) {
  assertRole(actor, "ADMIN");
  const badge = await db.badgeDefinition.findUnique({ where: { id: badgeId }, include: { _count: { select: { awards: true } } } });
  if (!badge) notFound("Không tìm thấy huy hiệu.");
  if (badge._count.awards > 0) throw new DomainError("INVALID_INPUT", "Huy hiệu đã được trao, không xóa được. Hãy tắt nó.");
  await db.badgeDefinition.delete({ where: { id: badgeId } });
}

// ───────────────────────── AI feedback reported by teachers ─────────────────────────

export async function listAiReports(actor: Actor, show: "open" | "resolved" = "open") {
  assertRole(actor, "ADMIN");
  const reports = await db.aiReport.findMany({
    where: { resolvedAt: show === "open" ? null : { not: null } },
    orderBy: { createdAt: show === "open" ? "asc" : "desc" },
    take: 50,
    select: {
      id: true,
      reason: true,
      createdAt: true,
      resolvedAt: true,
      reporter: { select: { name: true } },
      answer: {
        select: {
          content: true,
          level: true,
          teacherLevel: true,
          strengths: true,
          improvements: true,
          question: {
            select: { id: true, type: true, prompt: true, rubric: true, keyPoints: true, work: { select: { id: true, title: true } } },
          },
        },
      },
    },
  });
  return reports.map((r) => {
    const rubric = rubricSchema.safeParse(r.answer.question.rubric);
    return {
      id: r.id,
      reason: r.reason,
      createdAt: r.createdAt,
      resolvedAt: r.resolvedAt,
      teacher: r.reporter.name,
      answer: {
        content: r.answer.content,
        aiLevel: r.answer.level,
        level: effectiveLevel(r.answer),
        strengths: r.answer.strengths,
        improvements: r.answer.improvements,
      },
      question: { ...r.answer.question, rubric: rubric.success ? rubric.data : null },
    };
  });
}

export function countOpenAiReports() {
  return db.aiReport.count({ where: { resolvedAt: null } });
}

export async function resolveAiReport(actor: Actor, reportId: string) {
  assertRole(actor, "ADMIN");
  const { count } = await db.aiReport.updateMany({ where: { id: reportId, resolvedAt: null }, data: { resolvedAt: new Date() } });
  if (count === 0) notFound("Báo cáo không còn chờ xử lý.");
}
