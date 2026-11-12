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
      `✔ Nội dung mẫu: ${content.works} tác phẩm, ${content.tags} tag, ${content.segmentsCreated} phân đoạn mới, ${content.questionsCreated} câu hỏi mới`,
    );
  } finally {
    await db.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
