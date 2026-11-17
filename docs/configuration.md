# Biến môi trường

Bản local đọc từ `.env` (sao chép từ `.env.example`). Trên Railway, đặt các biến này cho **cả web và worker**, trừ khi ghi khác.

## Cơ sở dữ liệu

| Biến | Ý nghĩa |
|---|---|
| `DATABASE_URL` | Postgres của app. Trên Railway: `${{Postgres.DATABASE_URL}}`. |
| `TEST_DATABASE_URL` | Postgres cho integration test (chỉ cần ở máy dev và CI). |

## AI

| Biến | Ý nghĩa |
|---|---|
| `AI_PROVIDER` | `mock` (mặc định, không cần mạng), `openai` (máy chủ tương thích OpenAI) hoặc `gemini`. |
| `OPENAI_BASE_URL`, `OPENAI_API_KEY`, `OPENAI_MODEL` | Dùng khi `AI_PROVIDER=openai`. Ví dụ Token Harbor: `https://tokenharbor.ai/v1`, model `deepseek-v4.1-flash-1017-fast`. |
| `OPENAI_JSON_MODE` | Tùy chọn: `json_object` cho máy chủ không hỗ trợ structured outputs. |
| `OPENAI_TIMEOUT_MS` | Thời gian chờ mỗi lần gọi, mặc định `120000`. |
| `GEMINI_API_KEY`, `GEMINI_MODEL` | Dùng khi `AI_PROVIDER=gemini`. |

Đổi model chỉ cần đổi `OPENAI_MODEL` rồi khởi động lại web và worker. Trước khi đổi, nên chạy `npm run ai:smoke -- --model=<tên-model>` để thử mọi tác vụ AI với model mới (xem [Phát triển](development.md#thử-ai-với-model-thật)).

## Seed

| Biến | Ý nghĩa |
|---|---|
| `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD` | Tài khoản admin do seed tạo. Bắt buộc khi deploy. |
| `SEED_DEMO` | `true` để seed giáo viên, lớp demo `DEMO12` và 20 học sinh mẫu. |
| `SEED_ONLY_IF_EMPTY` | Do `docker/start.sh` đặt: bỏ qua seed khi database đã có người dùng. |

## Thông báo đẩy

| Biến | Ý nghĩa |
|---|---|
| `WEB_PUSH_PUBLIC_KEY`, `WEB_PUSH_PRIVATE_KEY` | Khóa VAPID. Tạo mới bằng `npx web-push generate-vapid-keys`. Bỏ trống thì chỉ có chuông thông báo trong app. |
| `WEB_PUSH_SUBJECT` | `mailto:` hoặc URL liên hệ gửi kèm thông báo. |

## Khác

| Biến | Ý nghĩa |
|---|---|
| `SERVICE_ROLE` | Trong container: `web` (mặc định) hoặc `worker`. Chỉ đặt `worker` cho service worker. |
| `COOKIE_SECURE` | Đặt `false` nếu chạy production qua HTTP thường (không HTTPS). |
| `APP_PORT`, `POSTGRES_PORT` | Cổng khi chạy bằng Docker Compose (mặc định `3000`, `5433`). |
