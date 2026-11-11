/**
 * Idempotent seed. Creates the admin account (from env) and, when
 * SEED_DEMO=true, a demo teacher with class code DEMO12.
 * Run: npm run db:seed
 */
import "dotenv/config";
import { createPrismaClient } from "../src/server/db";
import { hashPassword } from "../src/server/auth/password";

const DEMO_TEACHER = {
  email: "giaovien@readly.local",
  name: "Cô Nguyễn Thị Demo",
  password: "readly-gv-123",
};
const DEMO_CLASS = { name: "12A1 (demo)", code: "DEMO12" };

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
      await db.class.upsert({
        where: { code: DEMO_CLASS.code },
        update: {},
        create: { ...DEMO_CLASS, teacherId: teacher.id },
      });
      console.log(`✔ Giáo viên demo: ${DEMO_TEACHER.email} · lớp ${DEMO_CLASS.name} (mã ${DEMO_CLASS.code})`);
    }
  } finally {
    await db.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
