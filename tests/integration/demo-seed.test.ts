import { beforeAll, describe, expect, it } from "vitest";
import { db } from "@/server/db";
import { seedContent } from "../../prisma/seed-content";
import { DEMO_STUDENT_COUNT, seedDemoClass } from "../../prisma/seed-demo-class";
import { getPlayer } from "@/server/services/gamification";
import { getHighlightFacets, getReadingHistory } from "@/server/services/profile";
import { getContinueReading } from "@/server/services/reading";
import { enroll, makeClass, makeUser, resetDatabase } from "../helpers/db";

// One full seed for the whole file: it is the slowest thing the tests do.
let classId = "";
let mainId = "";
let first: Awaited<ReturnType<typeof seedDemoClass>>;

beforeAll(async () => {
  await resetDatabase();
  const teacher = await makeUser("TEACHER");
  const cls = await makeClass(teacher.id, "DEMO12");
  const main = await makeUser("STUDENT", { email: "hocsinh@readly.local", name: "Trần Minh An" });
  await enroll(main.id, cls.id);
  classId = cls.id;
  mainId = main.id;
  await seedContent(db);
  first = await seedDemoClass(db, classId);
}, 240_000);

describe("demo seed", () => {
  it("fills the demo class on the real works, once", async () => {
    expect(first).toMatchObject({ students: DEMO_STUDENT_COUNT, assignments: 3, posts: 3 });
    expect(await db.classMembership.count({ where: { classId, leftAt: null } })).toBe(DEMO_STUDENT_COUNT + 1);
    expect(await db.workCompletion.count({ where: { work: { slug: "hai-dua-tre" } } })).toBeGreaterThan(5);
    expect(await db.highlight.count({ where: { work: { slug: "hai-dua-tre" } } })).toBeGreaterThan(10);
    expect(await db.aiReport.count()).toBe(1);
    expect(await seedDemoClass(db, classId)).toBeNull();
  });

  it("gives the demo student a full home page and reading profile", async () => {
    const history = await getReadingHistory(mainId);
    expect(history.completed.map((w) => w.slug)).toEqual(["cau-ca-mua-thu"]);
    expect(history.reading.map((w) => w.slug).sort()).toEqual(["day-thon-vi-da", "hai-dua-tre"]);
    expect(await getContinueReading(mainId)).toMatchObject({ slug: "day-thon-vi-da" });

    const facets = await getHighlightFacets(mainId);
    expect(facets.total).toBe(9);
    expect(Object.keys(facets.colors).sort()).toEqual(["BLUE", "PINK", "PURPLE", "YELLOW"]);
    expect(await db.highlight.count({ where: { userId: mainId, note: { not: null } } })).toBeGreaterThanOrEqual(6);

    const player = await getPlayer(mainId);
    expect(player.points).toBeGreaterThan(100);
    expect(player.badges).toBeGreaterThan(0);
    expect(player.streak.current).toBeGreaterThanOrEqual(4);
    expect(await db.answer.count({ where: { userId: mainId, feedback: { not: null } } })).toBe(1);
  });
});
