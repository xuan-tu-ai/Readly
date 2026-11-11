# Readly

Web đọc 45 tác phẩm văn học lớp 12 với hướng dẫn đọc bằng AI. Đồ án kỹ thuật: không có người dùng thật, mọi dữ liệu người dùng là dữ liệu mẫu.

- Mô tả sản phẩm: [docs/CONTEXT.md](docs/CONTEXT.md)
- Spec: [.plans/readly-reading-platform-spec.md](.plans/readly-reading-platform-spec.md)
- Kế hoạch triển khai: [.plans/readly-implementation-plan.md](.plans/readly-implementation-plan.md)

## Công nghệ

Next.js 16 (App Router, Cache Components) · TypeScript · PostgreSQL + Prisma 7 · pg-boss (hàng đợi trên Postgres) · Google Gemini (có chế độ mock) · Tailwind CSS 4 + shadcn/ui · Vitest.

## Chạy local

Yêu cầu: Node 24, Docker Desktop.

```bash
cp .env.example .env
docker compose up -d postgres     # Postgres ở cổng 5433 (DB readly + readly_test)
npm install
npm run db:migrate                # áp migration vào DB dev
npm run db:seed                   # admin + giáo viên demo + lớp mã DEMO12
npm run dev                       # http://localhost:3000
npm run worker                    # (cửa sổ khác) tiến trình xử lý hàng đợi
```

Tài khoản mẫu (chỉ dùng local, định nghĩa trong `.env.example` và `prisma/seed.ts`):

| Vai | Email | Mật khẩu |
|---|---|---|
| Admin | `admin@readly.local` | giá trị `SEED_ADMIN_PASSWORD` |
| Giáo viên demo | `giaovien@readly.local` | xem `prisma/seed.ts` |
| Học sinh | tự đăng ký tại `/register` với mã lớp `DEMO12` | |

### Chạy toàn bộ bằng Docker

```bash
docker compose --profile app up -d --build   # postgres + migrate/seed + app + worker
```

Đổi cổng web bằng `APP_PORT` (mặc định 3000), cổng Postgres bằng `POSTGRES_PORT` (mặc định 5433).

## Kiểm tra

```bash
npm run lint
npm run typecheck
npm test          # unit + integration (dùng DB readly_test, cần Postgres đang chạy)
npm run build
```

## Cấu trúc

```
prisma/              schema, migrations, seed
src/app/             route theo vai: (auth) /login /register, /student, /teacher, /admin
src/app/actions/     server actions (luôn kiểm tra phiên + quyền trước khi gọi service)
src/server/auth/     phiên đăng nhập lưu DB, cookie, mật khẩu (argon2), DAL
src/server/authz.ts  quy tắc phân quyền (GV chỉ thấy HS đang ở lớp mình)
src/server/services/ nghiệp vụ: tài khoản, lớp học
src/server/jobs/     định nghĩa job chạy nền
src/lib/ai/          lớp AI: GeminiProvider, MockProvider
worker/              tiến trình pg-boss
tests/               unit + integration (Vitest)
```

## Biến môi trường

| Biến | Ý nghĩa |
|---|---|
| `DATABASE_URL` | Postgres của app |
| `TEST_DATABASE_URL` | Postgres cho integration test |
| `AI_PROVIDER` | `mock` (mặc định, không cần mạng) hoặc `gemini` |
| `GEMINI_API_KEY`, `GEMINI_MODEL` | dùng khi `AI_PROVIDER=gemini` |
| `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD` | tài khoản admin do seed tạo |
| `SEED_DEMO` | `true` để seed giáo viên + lớp demo |
| `COOKIE_SECURE` | đặt `false` nếu chạy production qua HTTP thường (không HTTPS) |
