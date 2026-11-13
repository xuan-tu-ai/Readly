# Readly

Web đọc văn học lớp 12 có hướng dẫn đọc bằng AI: học sinh đọc theo từng phân đoạn, trả lời câu hỏi trước, trong và sau khi đọc, được AI nhận xét theo rubric và tích điểm, huy hiệu; giáo viên giao bài và theo dõi lớp; admin soạn nội dung. Đồ án kỹ thuật: mọi dữ liệu người dùng là dữ liệu mẫu.

- **Bản chạy online:** https://readly-production-3cec7280.up.railway.app (Railway: web + worker + Postgres)
- Mô tả sản phẩm: [docs/CONTEXT.md](docs/CONTEXT.md)
- Spec: [.plans/readly-reading-platform-spec.md](.plans/readly-reading-platform-spec.md)
- Kế hoạch triển khai: [.plans/readly-implementation-plan.md](.plans/readly-implementation-plan.md)

## Tài khoản demo

| Vai | Email | Mật khẩu |
|---|---|---|
| Học sinh | `hocsinh@readly.local` | `readly-hs-123` |
| Giáo viên (lớp 12A1, mã `DEMO12`) | `giaovien@readly.local` | `readly-gv-123` |
| 20 học sinh mẫu trong lớp | `hs01@demo.readly.local` … `hs20@demo.readly.local` | `readly-hs-123` |
| Admin | `admin@readly.local` | giá trị `SEED_ADMIN_PASSWORD` (không công khai) |

Học sinh mới có thể tự đăng ký ở `/register`, nhập mã lớp `DEMO12` để vào lớp demo. Giáo viên còn có **mã QR của lớp** ở trang Cài đặt lớp: học sinh quét là mở trang đăng ký với mã lớp điền sẵn.

**Cài như ứng dụng:** trang chủ có nút **Cài ứng dụng** (trong app thì nằm cạnh nút Giao diện):
- Android, máy tính (Chrome/Edge): bấm là hiện hộp cài một chạm.
- iPhone/iPad: hiện hướng dẫn Chia sẻ → Thêm vào MH chính.
- Trên máy tính, trang chủ có mã QR để mở Readly trên điện thoại.

**Gợi ý demo:**
1. Đăng nhập học sinh → trang chủ (đang đọc, bài được giao, streak, xếp hạng) → **Hồ sơ** (lịch sử đọc, highlight lọc theo màu/tác phẩm).
2. Mở "Hai đứa trẻ" → đọc tiếp, tô sáng, trả lời câu tự luận → AI chấm sau vài giây.
3. Đăng nhập giáo viên → lớp 12A1 → tiến độ bài giao, câu trả lời (duyệt nhận xét AI), bản đồ highlight, thảo luận, xuất báo cáo .xlsx.
4. Đăng nhập admin → Tác phẩm (sửa văn bản, nhập .docx, AI soạn câu hỏi), Báo cáo AI, Điểm & huy hiệu.

## Nội dung

- **4 tác phẩm có toàn văn** (thuộc phạm vi công cộng), mỗi tác phẩm có thẻ kiến thức nền, câu hỏi 3 giai đoạn kèm rubric và mini game. Câu hỏi do AI soạn nháp rồi được rà lại bằng tay. Nguồn văn bản ghi trong từng file `content/works/*.json`:
  - *Câu cá mùa thu* – Nguyễn Khuyến
  - *Thương vợ* – Trần Tế Xương
  - *Đây thôn Vĩ Dạ* – Hàn Mặc Tử
  - *Hai đứa trẻ* – Thạch Lam
- **45 tác phẩm giữ chỗ** (`content/works.sample.json`): tên và văn bản mẫu để thư viện đủ thể loại; thay bằng nội dung thật qua trang admin (nhập .docx) hoặc sửa file.

## Kiến trúc

```
Trình duyệt ──HTTPS──▶ Web (Next.js 16)  ──▶ PostgreSQL ◀── Worker (pg-boss)
                        server actions           ▲            │ chấm bài AI, so sánh dự đoán,
                        + services               │            │ nhắc hạn (cron), web push
                        gửi job ─────────────────┘ hàng đợi   ▼
                                                   pg-boss    AI (Token Harbor / Gemini / mock)
```

- **Một image Docker** cho cả web và worker; `docker/start.sh` chọn tiến trình theo `SERVICE_ROLE`. Web khi khởi động sẽ chạy migration và seed (chỉ khi DB còn trống).
- **Hàng đợi** nằm ngay trong Postgres (pg-boss), không cần Redis.
- **AI** chỉ chạy ở server; khóa API nằm trong biến môi trường.

## Công nghệ

Next.js 16 (App Router, Cache Components) · TypeScript · PostgreSQL + Prisma 7 · pg-boss · AI qua giao thức tương thích OpenAI (Token Harbor…) hoặc Google Gemini, có chế độ mock · Tailwind CSS 4 + shadcn/ui · Vitest.

## Chạy local

Yêu cầu: Node 24, Docker Desktop.

```bash
cp .env.example .env
docker compose up -d postgres     # Postgres ở cổng 5433 (DB readly + readly_test)
npm install
npm run db:migrate                # áp migration vào DB dev
npm run db:seed                   # admin + nội dung + (SEED_DEMO=true) lớp demo
npm run dev                       # http://localhost:3000
npm run worker                    # (cửa sổ khác) tiến trình xử lý hàng đợi
```

### Chạy toàn bộ bằng Docker

```bash
docker compose --profile app up -d --build   # postgres + migrate/seed + app + worker
```

Đổi cổng web bằng `APP_PORT` (mặc định 3000), cổng Postgres bằng `POSTGRES_PORT` (mặc định 5433).

## Deploy (Railway)

Project gồm 3 service: **Postgres** (plugin của Railway), **web** và **worker** (cùng repo, Railway tự build bằng `Dockerfile`).

1. Tạo Postgres, rồi tạo hai service từ repo này.
2. Đặt biến môi trường cho **cả web và worker**: `DATABASE_URL=${{Postgres.DATABASE_URL}}`, các biến AI, `WEB_PUSH_*`, `SEED_*` (bảng bên dưới). Riêng worker thêm `SERVICE_ROLE=worker`.
3. Tạo tên miền công khai cho web (Settings → Networking → Generate Domain).
4. Deploy: web tự chạy migration và seed lần đầu. Các lần deploy sau không seed lại.

Tạo khóa web push mới cho bản online: `npx web-push generate-vapid-keys`.

## Kiểm tra

```bash
npm run lint
npm run typecheck
npm test          # unit + integration (dùng DB readly_test, cần Postgres đang chạy)
npm run build
npm run ai:smoke  # gọi model AI thật cho mọi tác vụ (cần cấu hình AI, không chạy trong CI)
```

## Biến môi trường

| Biến | Ý nghĩa |
|---|---|
| `DATABASE_URL` | Postgres của app |
| `TEST_DATABASE_URL` | Postgres cho integration test |
| `AI_PROVIDER` | `mock` (mặc định, không cần mạng), `openai` (máy chủ tương thích OpenAI) hoặc `gemini` |
| `OPENAI_BASE_URL`, `OPENAI_API_KEY`, `OPENAI_MODEL` | dùng khi `AI_PROVIDER=openai`, ví dụ Token Harbor: `https://tokenharbor.ai/v1`, `deepseek-v4.1-flash:free` |
| `OPENAI_JSON_MODE`, `OPENAI_TIMEOUT_MS` | tùy chọn: `json_object` cho máy chủ không hỗ trợ structured outputs; thời gian chờ (mặc định 120000) |
| `GEMINI_API_KEY`, `GEMINI_MODEL` | dùng khi `AI_PROVIDER=gemini` |
| `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD` | tài khoản admin do seed tạo |
| `SEED_DEMO` | `true` để seed giáo viên, lớp demo và học sinh mẫu |
| `WEB_PUSH_PUBLIC_KEY`, `WEB_PUSH_PRIVATE_KEY`, `WEB_PUSH_SUBJECT` | khóa VAPID cho thông báo đẩy (bỏ trống thì chỉ có chuông trong app) |
| `SERVICE_ROLE` | trong container: `web` (mặc định) hoặc `worker` |
| `COOKIE_SECURE` | đặt `false` nếu chạy production qua HTTP thường (không HTTPS) |

## Cấu trúc

```
content/works/       tác phẩm có toàn văn (JSON: văn bản, câu hỏi, mini game)
content/             tags.json, works.sample.json (tác phẩm giữ chỗ)
docker/              start.sh (entrypoint), init DB cho Postgres local
prisma/              schema, migrations, seed (nội dung, huy hiệu, lớp demo)
src/app/             trang chủ (landing), route theo vai: (auth) /login /register, /student, /teacher, /admin
src/components/landing/  minh họa động của trang chủ (ảnh tách lớp trong art/, chuyển động bằng CSS)
src/app/actions/     server actions (luôn kiểm tra phiên + quyền trước khi gọi service)
src/server/auth/     phiên đăng nhập lưu DB, cookie, mật khẩu (argon2), DAL
src/server/authz.ts  quy tắc phân quyền (GV chỉ thấy HS đang ở lớp mình)
src/server/services/ nghiệp vụ: đọc, câu hỏi, điểm, giáo viên, thảo luận, admin…
src/server/jobs/     định nghĩa job chạy nền
src/lib/ai/          lớp AI: OpenAiCompatibleProvider, GeminiProvider, MockProvider
scripts/ai-smoke/    chạy thử mọi tác vụ AI với model thật
worker/              tiến trình pg-boss
tests/               unit + integration (Vitest)
```
