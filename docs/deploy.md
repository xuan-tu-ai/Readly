# Deploy lên Railway

Bản online của Readly chạy trên [Railway](https://railway.com) với ba service trong một project:

| Service | Nguồn | Ghi chú |
|---|---|---|
| **Postgres** | Plugin Postgres của Railway | Database duy nhất, chứa cả hàng đợi pg-boss và ảnh bìa. |
| **Readly** (web) | Repo này, nhánh `main` | Railway tự build bằng `Dockerfile`; có tên miền công khai. |
| **worker** | Repo này, nhánh `main` | Cùng image, biến `SERVICE_ROLE=worker`; không cần tên miền. |

## Dựng lần đầu

1. **Tạo project** và thêm **Postgres** (New → Database → PostgreSQL).
2. **Tạo service web** từ repo GitHub (New → GitHub Repo), nhánh `main`.
3. **Tạo service worker** từ cùng repo, cùng nhánh.
4. **Đặt biến môi trường** cho cả hai service (xem [Biến môi trường](configuration.md)):
   - `DATABASE_URL=${{Postgres.DATABASE_URL}}`
   - các biến AI (`AI_PROVIDER`, `OPENAI_*`…)
   - `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD`, và `SEED_DEMO=true` nếu muốn có lớp demo
   - `WEB_PUSH_*` (tạo khóa mới cho bản online)
   - riêng worker: `SERVICE_ROLE=worker`
5. **Tạo tên miền** cho web: Settings → Networking → Generate Domain, cổng `3000`.
6. **Deploy.** Lần đầu web chạy migration rồi seed; log có dòng seed thành công. Worker in `[worker] sẵn sàng` kèm danh sách hàng đợi.

Các lần deploy sau, migration mới vẫn được áp tự động, còn seed được bỏ qua (log: "Cơ sở dữ liệu đã có dữ liệu, bỏ qua seed"), nên dữ liệu admin đã sửa không bị ghi đè.

## Tự deploy khi merge vào `main`

Railway chỉ tự deploy khi ứng dụng Railway trên GitHub có quyền đọc repo:

1. Repo thuộc tổ chức nên ứng dụng phải được cài cho **tổ chức**: `https://github.com/organizations/<tổ-chức>/settings/installations` → Railway → Configure → cho phép repo này. Nếu chưa cài, vào Railway → Account Settings → Integrations → GitHub.
2. Trên từng service: Settings → Source → **Connect Repo**, chọn repo và nhánh `main`. Tắt **Wait for CI** nếu không muốn chờ GitHub Actions.

Merge xong, tab Deployments của cả web và worker sẽ có bản build mới sau vài giây.

## Dữ liệu sau khi deploy

- Seed chỉ chạy trên database trống. Nội dung thêm vào seed sau này (ví dụ ảnh bìa trong `content/covers/`) không tự xuất hiện trên database đã có dữ liệu; hãy thêm qua trang admin.
- Đổi model AI: sửa `OPENAI_MODEL` trên cả web và worker; Railway khởi động lại service.
- Một tab trình duyệt đang mở bản cũ trong lúc deploy có thể làm log báo `Failed to find Server Action`; tải lại trang là hết.

## Chạy bằng Docker ở nơi khác

```bash
docker compose --profile app up -d --build   # postgres + migrate/seed + app + worker
```

Image không phụ thuộc Railway: nền tảng nào chạy được Docker và có Postgres đều dùng được. Nhớ đặt `COOKIE_SECURE=false` nếu không có HTTPS.
