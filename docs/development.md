# Phát triển

## Yêu cầu

- Node.js 24
- Docker Desktop (cho PostgreSQL)

## Chạy local

```bash
cp .env.example .env
docker compose up -d postgres     # Postgres ở cổng 5433 (DB readly + readly_test)
npm install
npm run db:migrate                # áp migration vào DB dev
npm run db:seed                   # admin + nội dung + (SEED_DEMO=true) lớp demo
npm run dev                       # http://localhost:3000
npm run worker                    # (cửa sổ khác) tiến trình xử lý hàng đợi
```

Mặc định `AI_PROVIDER=mock`: mọi tính năng AI chạy được mà không cần mạng hay khóa API. Muốn dùng model thật, xem [Biến môi trường](configuration.md#ai).

Chạy toàn bộ (Postgres, migrate/seed, web, worker) bằng Docker:

```bash
docker compose --profile app up -d --build
```

## Kiểm tra

```bash
npm run lint
npm run typecheck
npm test          # unit + integration (dùng DB readly_test, cần Postgres đang chạy)
npm run build
```

CI (`.github/workflows/ci.yml`) chạy đúng bốn lệnh này trên mỗi pull request và mỗi lần push vào `main`, với Postgres và `AI_PROVIDER=mock`.

Integration test chạy trên database thật, mỗi test bắt đầu từ database trống, các file test chạy lần lượt. Nếu máy ít RAM, có thể chạy theo nhóm, ví dụ `npx vitest run tests/unit`.

## Thử AI với model thật

`npm run ai:smoke` gọi model đang cấu hình cho mọi tác vụ AI (chấm câu ngắn và tự luận, so sánh dự đoán, soạn bộ câu hỏi, rubric, mini game) trên một bộ dữ liệu mẫu cố định, rồi kiểm tra kết quả: đúng schema, đủ rubric, câu trắc nghiệm không để đáp án đúng dài nổi bật so với các phương án nhiễu. Báo cáo ghi thời gian và số lần thử lại của từng tác vụ, để so sánh các model.

```bash
npm run ai:smoke -- --model=deepseek-v4.1-flash-1017-fast --out=report.json
npm run ai:smoke -- --only=grade,draft --repeat=3
```

Script này tốn lượt gọi API nên không chạy trong CI.

## Nội dung

- **Tác phẩm có toàn văn:** mỗi tác phẩm là một file `content/works/<slug>.json` (siêu dữ liệu, kiến thức nền, phân đoạn HTML, câu hỏi 3 giai đoạn kèm rubric, mini game). Seed kiểm tra file bằng zod và chỉ thêm phần còn thiếu, nên chạy lại seed không tạo trùng.
- **Ảnh bìa:** `content/covers/<slug>.webp`, 600×900. Seed gắn bìa cho tác phẩm chưa có bìa.
- **Tác phẩm giữ chỗ:** `content/works.sample.json`.
- Trên bản đang chạy, admin sửa nội dung trực tiếp: nhập văn bản từ `.docx`, soạn câu hỏi bằng AI rồi duyệt, tải ảnh bìa.

## Quy ước

- Mỗi thao tác ghi là một server action trong `src/app/actions`: kiểm tra phiên và vai trò, kiểm tra dữ liệu bằng zod, gọi service, rồi `refresh()`.
- Logic nghiệp vụ nằm trong `src/server/services` và có integration test tương ứng trong `tests/integration`.
- Next.js trong repo là bản 16, có nhiều thay đổi so với các bản trước; tài liệu đi kèm nằm trong `node_modules/next/dist/docs/`.
