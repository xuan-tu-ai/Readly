/**
 * Idempotent seed. Creates the admin account (from env) and, when
 * SEED_DEMO=true, a demo teacher with class code DEMO12; then the sample
 * library from content/*.json (see seed-content.ts).
 * Run: npm run db:seed
 */
import "dotenv/config";
import { createPrismaClient } from "../src/server/db";
import { hashPassword } from "../src/server/auth/password";
import { seedContent } from "./seed-content";
import { DEMO_STUDENT_COUNT, seedDemoClass } from "./seed-demo-class";

const DEMO_TEACHER = {
  email: "giaovien@readly.local",
  name: "Cô Nguyễn Thị Demo",
  password: "readly-gv-123",
};
const DEMO_CLASS = { name: "12A1 (demo)", code: "DEMO12" };
const DEMO_STUDENT = {
  email: "hocsinh@readly.local",
  name: "Trần Minh An",
  password: "readly-hs-123",
};

async function main() {
  const db = createPrismaClient();
  try {
    // Production containers seed on every start; only a brand-new database is filled.
    if (process.env.SEED_ONLY_IF_EMPTY === "true" && (await db.user.count()) > 0) {
      console.log("✔ Cơ sở dữ liệu đã có dữ liệu, bỏ qua seed");
      return;
    }
    const adminEmail = process.env.SEED_ADMIN_EMAIL?.trim().toLowerCase();
    const adminPassword = process.env.SEED_ADMIN_PASSWORD;
    if (!adminEmail || !adminPassword) {
      throw new Error("Cần đặt SEED_ADMIN_EMAIL và SEED_ADMIN_PASSWORD để tạo tài khoản admin.");
    }

    await db.user.upsert({
      where: { email: adminEmail },
      update: {},
      create: {
        email: adminEmail,
        name: "Quản trị viên",
        role: "ADMIN",
        passwordHash: await hashPassword(adminPassword),
        settings: { create: {} },
      },
    });
    console.log(`✔ Admin: ${adminEmail}`);

    let demoClassId: string | null = null;
    if (process.env.SEED_DEMO === "true") {
      const teacher = await db.user.upsert({
        where: { email: DEMO_TEACHER.email },
        update: {},
        create: {
          email: DEMO_TEACHER.email,
          name: DEMO_TEACHER.name,
          role: "TEACHER",
          passwordHash: await hashPassword(DEMO_TEACHER.password),
          settings: { create: {} },
        },
      });
      const demoClass = await db.class.upsert({
        where: { code: DEMO_CLASS.code },
        update: {},
        create: { ...DEMO_CLASS, teacherId: teacher.id },
      });
      demoClassId = demoClass.id;
      console.log(`✔ Giáo viên demo: ${DEMO_TEACHER.email} · lớp ${DEMO_CLASS.name} (mã ${DEMO_CLASS.code})`);

      const existing = await db.user.findUnique({ where: { email: DEMO_STUDENT.email }, select: { id: true } });
      if (!existing) {
        await db.user.create({
          data: {
            email: DEMO_STUDENT.email,
            name: DEMO_STUDENT.name,
            role: "STUDENT",
            passwordHash: await hashPassword(DEMO_STUDENT.password),
            settings: { create: {} },
            memberships: { create: { classId: demoClass.id } },
          },
        });
      }
      console.log(`✔ Học sinh demo: ${DEMO_STUDENT.email} (lớp ${DEMO_CLASS.code})`);
    }

    const content = await seedContent(db);
    console.log(
      `✔ Nội dung mẫu: ${content.works} tác phẩm, ${content.tags} tag, ${content.segmentsCreated} phân đoạn mới, ${content.questionsCreated} câu hỏi mới, ${content.gamesCreated} mini game mới, ${content.realWorks} tác phẩm có toàn văn, ${content.badges} huy hiệu`,
    );

    if (demoClassId) {
      const demo = await seedDemoClass(db, demoClassId);
      console.log(
        demo
          ? `✔ Lớp demo: ${demo.students} học sinh mẫu (hs01…hs${DEMO_STUDENT_COUNT}@demo.readly.local), ${demo.assignments} bài giao, ${demo.posts} bài thảo luận`
          : "✔ Lớp demo: dữ liệu mẫu đã có, bỏ qua",
      );
    }
  } finally {
    await db.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
