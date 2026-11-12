# Kế hoạch triển khai – Readly

> Dựa trên spec đã duyệt: [readly-reading-platform-spec.md](readly-reading-platform-spec.md).
> Thời gian: **1–3 tháng** → kế hoạch ~11 tuần, có 1–2 tuần dự phòng.
> Quy trình: mỗi giai đoạn = 1 branch `phase-N-<tên>` + 1 PR vào `main`, bạn review rồi merge.
> Mỗi PR phải: build sạch, `lint` + `typecheck` qua, unit test của giai đoạn qua, cập nhật seed nếu đổi schema.

## Tổng quan

| # | Giai đoạn | Ước lượng | Phụ thuộc | Mục spec |
|---|---|---|---|---|
| 0 | Khởi tạo repo (docs + plan lên `main`) | 0,5 ngày | — | — |
| 1 | Nền tảng: scaffold, DB, auth, vai trò, lớp, Docker | 1,5 tuần | 0 | §1, §2 |
| 2 | Mô hình nội dung + seed 45 tác phẩm + thư viện + test sở thích | 1 tuần | 1 | §3.1, §3.5, §4 |
| 3 | Trang đọc: phân đoạn, tuỳ chỉnh, vị trí, theo dõi đọc, tô sáng | 1,5 tuần | 2 | §5 |
| 4 | Câu hỏi & AI: trắc nghiệm, tự luận, hàng đợi chấm, hoàn thành | 1,5 tuần | 3 | §6, §9 |
| 4.5 | Giao diện: design system, linh vật Mướp, onboarding, lộ trình phân đoạn, nền đọc & lật trang | 1 tuần | 4 | §4, §5, §12 |
| 5 | Game hóa: điểm, cấp độ, streak, huy hiệu, BXH, mini game | 1 tuần | 4.5 | §8 |
| 6 | Giáo viên: giao bài, dashboard, can thiệp AI, xuất .xlsx | 1,5 tuần | 4, 5 | §6.5, §10 |
| 7 | Thảo luận + thông báo (in-app, web push, cron nhắc hạn) | 1 tuần | 6 | §7, §11 |
| 8 | Admin: CRUD, import .docx, chia phân đoạn, AI soạn nháp, sửa & neo lại highlight | 1,5 tuần | 4 | §3.2–3.4, §5.2, §13 |
| 9 | Hoàn thiện: trang chủ, hồ sơ, responsive, E2E, deploy cloud | 1 tuần | tất cả | §12, §14, §15 |

Tổng: ~11,5 tuần. Giai đoạn 8 có thể chạy song song với 5–7 nếu cần rút ngắn (chỉ phụ thuộc giai đoạn 4).

---

## Giai đoạn 0 – Khởi tạo repo
- `git init`, `.gitignore` (Node, `.env*`, `.next`, `node_modules`), commit `docs/` + `.plans/` lên `main`, gắn remote `xuan-tu-ai/Readly`, push.
- **Xong khi:** `main` trên GitHub có `docs/CONTEXT.md` và 2 file trong `.plans/`.

## Giai đoạn 1 – Nền tảng
**Mục tiêu:** chạy được `docker compose up` ra app có đăng nhập 3 vai.

Task:
- Scaffold Next.js (App Router, TS strict), Tailwind, shadcn/ui, ESLint + Prettier, Vitest.
- Cấu trúc: `src/app` (route theo vai: `(student)`, `teacher`, `admin`), `src/server` (service, quyền), `src/lib/ai`, `worker/` (process pg-boss), `prisma/`.
- Prisma schema ban đầu: `User` (role: ADMIN/TEACHER/STUDENT), `Class` (code, teacherId, active), `ClassMembership` (lịch sử: joinedAt, leftAt — 1 membership active/HS), `UserSettings`.
- Auth.js Credentials (argon2), session DB; middleware chặn route theo vai.
- Đăng ký HS: email + mật khẩu + mã lớp (bắt buộc, kiểm tra mã active).
- Đổi lớp bằng mã mới; GV xóa HS khỏi lớp; GV đặt lại mật khẩu HS; admin tạo GV + đặt lại mật khẩu GV.
- Helper phân quyền server: `assertTeacherOfStudent`, `assertRole`… dùng ở mọi truy vấn.
- Docker Compose: `app`, `worker` (khởi động pg-boss, chưa có job), `postgres`. Script `seed` tạo admin.
- Lớp `AiProvider` + `MockProvider` + khung `GeminiProvider` (đọc `AI_PROVIDER`, `GEMINI_API_KEY`, `GEMINI_MODEL`).
- Layout responsive khung: bottom nav (mobile) / sidebar (≥ md).

**Xong khi:** đăng ký HS bằng mã lớp, đăng nhập 3 vai đi đúng khu vực; HS lớp A không truy cập được dữ liệu lớp B (unit test quyền); `docker compose up` từ máy sạch chạy được.
**Cắt nếu trễ:** UI đổi lớp (để admin/seed xử lý).

## Giai đoạn 2 – Nội dung, thư viện, test sở thích
Task:
- Schema: `Work` (metadata, status draft/published/coming_soon, genre, difficulty, estMinutes), `Tag`, `WorkTag`, `Segment` (order, content HTML, archivedAt), `Question` (stage PRE/DURING/POST, type PREDICTION/MCQ/SHORT/ESSAY, required, segmentId?, options, rubric JSON, keyPoints, essayPrompt/outline), `BackgroundCard`, `MiniGame`.
- Seed: 45 tác phẩm metadata + tags; 3–5 tác phẩm đầy đủ (văn bản, phân đoạn, câu hỏi, rubric). *Cần bạn cung cấp danh sách và chọn tác phẩm (§17 spec).*
- Thư viện: lưới thẻ, tìm theo tên/tác giả, lọc thể loại/thời lượng/độ khó, nhãn "Sắp có".
- Trang chi tiết tác phẩm.
- Test sở thích: bộ câu hỏi seed + bảng trọng số tag, hàm xếp hạng thuần (`rankWorks`), lý do gợi ý từ tag trùng; lưu kết quả mới nhất (`QuizResult`).

**Xong khi:** lọc/tìm đúng; unit test `rankWorks` (thứ tự, lý do, hòa điểm); làm lại test cập nhật gợi ý.
**Cắt nếu trễ:** tìm kiếm full-text (dùng `ILIKE`).

## Giai đoạn 3 – Trang đọc & tô sáng
Task:
- Render phân đoạn (HTML đã sanitize), mục lục với trạng thái đã đọc / câu nợ (câu nợ hiển thị từ giai đoạn 4).
- Tuỳ chỉnh cỡ chữ, giãn dòng, sáng/sepia/tối — lưu `UserSettings`.
- `ReadingProgress`: vị trí `segmentId + offset`, đồng bộ đa thiết bị; nút "Tiếp tục đọc".
- Đánh dấu segment đã đọc khi điểm cuối vào viewport (`SegmentRead`).
- Đo thời gian hoạt động: Visibility API + tương tác trong 60s, heartbeat 15–30s → `ReadingTime(segmentId, seconds, date)`.
- Tô sáng: chọn theo từ (word-snap), chạm = cả câu, 4 màu, ghi chú, cờ riêng tư; lưu neo `segmentId, start, end, quote, prefix, suffix`.
- Bố cục câu hỏi: inline (mobile) / khung phải (desktop) — chỉ khung, nội dung ở giai đoạn 4.

**Xong khi:** unit test word-snap & tách câu tiếng Việt, tính thời gian hoạt động (giả lập idle); mở trên điện thoại và máy tính về đúng vị trí; highlight hiển thị lại đúng sau reload.
**Cắt nếu trễ:** chạm-để-tô-cả-câu (giữ kéo chọn).

## Giai đoạn 4 – Câu hỏi, AI chấm bài, hoàn thành
Task:
- UI 3 giai đoạn: thẻ kiến thức nền + dự đoán (trước), câu theo phân đoạn (trong), câu tổng hợp + đoạn cảm nhận với đề/dàn ý (sau).
- `Answer` (attempt, status pending/graded/failed, level, strengths, improvements, aiHidden, teacherLevel, teacherNote, flagged).
- Trắc nghiệm chấm tự động; tối đa 3 lần.
- Tự luận/cảm nhận: lưu `pending` → job pg-boss `grade-answer` → `AiProvider.gradeAnswer/gradeEssay` (prompt: phân đoạn + rubric + ý chính, JSON schema) → cập nhật. Retry backoff; lượt pending không tính vào 3 lượt; chặn nộp lại khi pending.
- Hết 3 lượt vẫn Chưa đạt → mở khóa, không điểm, gắn cờ.
- Khi hoàn thành: job `compare-prediction` cho câu dự đoán.
- Hàm `isWorkCompleted` + trạng thái câu nợ trên mục lục.
- Prompt tiếng Việt + system prompt giới hạn phạm vi; `GeminiProvider` hoàn chỉnh.
- Phát sự kiện miền (`AnswerGraded`, `WorkCompleted`, `SegmentRead`) để giai đoạn 5–7 đăng ký.

**Xong khi:** unit test giới hạn lượt, điều kiện hoàn thành, parse JSON lỗi → retry; tắt mạng/Gemini → câu pending rồi được chấm khi bật lại; chạy thật với Gemini cho 1 tác phẩm seed.
**Cắt nếu trễ:** phản hồi AI cho dự đoán (chỉ hiển thị lại dự đoán).

## Giai đoạn 4.5 – Giao diện (thêm sau khi duyệt cảm hứng Waka / Duolingo / Brilliant)
Cảm hứng: nền sáng, vui và có linh vật kiểu Duolingo/Brilliant cho học sinh; thư viện và trình đọc mượn kiểu Waka (kệ bìa sách, tuỳ chỉnh nền đọc).

Task:
- Design system: bảng màu ấm (xanh lá chính, cam linh vật), tiêu đề serif, nút "3D" có viền đáy, thẻ bo tròn viền dày; giáo viên/admin dùng chung nhưng tiết chế.
- Linh vật mèo **Mướp**: SVG tự vẽ tách bộ phận, animate bằng CSS (chào, nghĩ, cổ vũ, buồn, ngủ, đọc), tôn trọng `prefers-reduced-motion`.
- Khung học sinh: sidebar icon màu (desktop), thanh tab dưới (điện thoại); trang chủ có lời chào, thẻ "đang đọc", thống kê tuần.
- Thư viện kiểu Waka: hero carousel, kệ cuộn ngang theo thể loại; trang tác phẩm có **lộ trình phân đoạn** (chỉ hiển thị, không khóa).
- Onboarding từng bước kiểu Brilliant cho bài test sở thích; đăng ký xong vào thẳng onboarding.
- Trình đọc toàn màn hình: ảnh nền, chọn kiểu chữ, chế độ **lật trang** (tuỳ chọn, mặc định cuộn) giữ đúng theo dõi đọc & tô sáng.

**Xong khi:** lint/typecheck/test/build sạch; kiểm tra trên trình duyệt desktop + điện thoại cho các màn học sinh, trình đọc ở cả hai chế độ.

## Giai đoạn 5 – Game hóa
**Hình ảnh đã chuẩn bị sẵn** (PR riêng trước giai đoạn này; xem tất cả ở `/admin/assets`, mã lưu DB nằm trong `src/lib/art.ts`):
- Huy hiệu `BadgeArt`: 12 hình chính × 4 bậc khung (đồng/bạc/vàng/kim cương) + trạng thái chưa mở + ruy băng chú thích.
- Cấp độ `LevelEmblem` 1–5; icon game hóa: streak (cháy/tắt), XP, huy chương 1–3, vương miện, sao, 2 loại mini game, khóa, rương.
- Hiệu ứng `Confetti`, `Sunburst`; Mướp thêm tư thế `trophy`, `fire`, `medal`, `point`.
- Cho giai đoạn 7, 9: icon thông báo & thảo luận, 12 avatar mèo, app icon PWA + manifest + badge thông báo đẩy.

Task:
- `PointLedger` (sự kiện → điểm), cấu hình bảng điểm (`GamificationConfig`), tính lại khi đổi mức.
- Cấp độ từ tổng điểm.
- Streak theo giờ VN từ các tương tác có ý nghĩa (tính theo ngày nộp với câu chấm muộn).
- Huy hiệu: 5 mẫu quy tắc có tham số, `BadgeDefinition`, `UserBadge`, bộ đánh giá idempotent chạy sau sự kiện miền.
- Bảng xếp hạng tuần (reset thứ Hai 00:00 VN), top 10 + vị trí bản thân, cờ bật/tắt trên `Class` (mặc định bật).
- Mini game: ghép nhân vật–sự kiện, đoán chi tiết; mở khóa theo segment; điểm theo kỷ lục.

**Xong khi:** unit test ledger (sửa mức trừ/cộng đúng), streak qua ranh giới ngày/múi giờ, từng mẫu huy hiệu, không cấp trùng, mini game không mở trước segment.
**Cắt nếu trễ:** loại game "đoán chi tiết".

## Giai đoạn 6 – Giáo viên
Task:
- Quản lý lớp: tạo, đổi/vô hiệu hóa mã, danh sách HS.
- Giao tác phẩm + hạn (`Assignment`).
- Dashboard: biểu đồ tiến độ theo tác phẩm giao, HS chưa xong/quá hạn, chi tiết từng HS (tiến độ, thời gian đọc, câu trả lời, câu gắn cờ).
- Câu trả lời gần đây: sửa mức (→ ledger), nhận xét GV, ẩn nhận xét AI, báo admin (`AiReport`).
- Highlight nổi bật: heatmap theo tác phẩm + feed có ghi chú (bỏ riêng tư).
- Bật/tắt BXH. Nhắc nhở thủ công (tạo thông báo — kênh gửi ở giai đoạn 7).
- Xuất .xlsx (`exceljs`): sheet Chi tiết + Tổng hợp.

**Xong khi:** unit test truy vấn tiến độ & quyền (GV lớp cũ mất quyền sau khi HS đổi lớp); file .xlsx mở được trong Excel, tiếng Việt đúng.
**Cắt nếu trễ:** heatmap (giữ feed).

## Giai đoạn 7 – Thảo luận & thông báo
Task:
- `Post` (workId, classId, type QUESTION/REFLECTION, quote anchor, pinned, hidden, resolved), `Reply` (1 cấp), `Like`, `PostReport`.
- Trích dẫn từ highlight/chọn văn bản, bấm nhảy tới trang đọc; sắp xếp Mới nhất/Nổi bật; lọc theo loại.
- Bộ lọc từ cấm khi đăng; GV ẩn/ghim/đánh dấu đã giải đáp; hàng chờ báo cáo.
- `Notification` in-app (chuông) + Web Push (VAPID, service worker, `PushSubscription`).
- Nguồn thông báo: giao bài, nhắc thủ công, cron nhắc trước hạn 2 ngày/1 ngày, chấm xong/GV sửa mức, huy hiệu mới, có trả lời bài.

**Xong khi:** HS lớp B không thấy thảo luận lớp A; cron nhắc chạy đúng (test với thời gian giả lập); push nhận được trên Chrome localhost.
**Cắt nếu trễ:** web push (giữ in-app).

## Giai đoạn 8 – Admin & nhập nội dung
Task:
- CRUD tác phẩm, metadata, tags; trạng thái draft/published/coming_soon.
- Import .docx (`mammoth`) → sanitize → đề xuất ranh giới phân đoạn (heading, dòng trống) → editor kéo/gộp/tách.
- Soạn câu hỏi 3 giai đoạn, rubric, ý chính, đề + dàn ý, thẻ kiến thức nền, mini game; nút "AI soạn nháp" (`draftQuestions/draftRubric/draftMiniGame`).
- Cấu hình bảng điểm, tạo huy hiệu từ mẫu.
- Sửa văn bản đã xuất bản: giữ ID segment, soft-delete; job neo lại highlight (offset → quote+ngữ cảnh trong segment → toàn tác phẩm → đánh dấu "không còn trong văn bản").
- Hàng chờ nhận xét AI bị GV báo cáo.

**Xong khi:** unit test đề xuất phân đoạn (thơ, truyện, kịch mẫu) và neo lại highlight (sửa chính tả, chèn đoạn, xóa đoạn); import 1 file .docx thật thành tác phẩm đọc được.
**Cắt nếu trễ:** AI soạn nháp mini game.

## Giai đoạn 9 – Hoàn thiện & bàn giao
Task:
- Trang chủ HS (tiếp tục đọc, bài giao + hạn, gợi ý, huy hiệu mới, streak, cấp độ); hồ sơ đọc (highlight lọc màu/tác phẩm, huy hiệu, lịch sử, điểm).
- Chọn phong cách hình ảnh và áp dụng toàn bộ; rà responsive + chế độ tối.
- Playwright E2E 5 luồng spec §15 với `AI_PROVIDER=mock`; GitHub Actions chạy lint + typecheck + unit + E2E.
- Seed demo phong phú (~20 HS, lịch sử giả lập) cho dashboard.
- Deploy cloud (VPS/Railway/Render) bằng cùng image; README: chạy local, biến môi trường, tài khoản demo, kiến trúc.

**Xong khi:** CI xanh; URL công khai mở được trên điện thoại; demo đủ các luồng chính từ README.

---

## Rủi ro & cách xử lý
| Rủi ro | Xử lý |
|---|---|
| Quota/độ trễ Gemini khi demo | `AI_PROVIDER=mock`; hàng đợi chấm sau |
| Chọn văn bản trên mobile (word-snap, iOS Safari) khó | Làm sớm ở giai đoạn 3, test trên máy thật; dự phòng chạm-theo-câu |
| Soạn nội dung 3–5 tác phẩm tốn thời gian | Bắt đầu chọn tác phẩm + soạn câu hỏi từ giai đoạn 2, dùng AI soạn nháp |
| Web push trên iOS cần PWA đã cài | Ghi rõ trong README; in-app là kênh chính |
| Trễ tiến độ | Mỗi giai đoạn có mục "Cắt nếu trễ"; giai đoạn 8 có thể chạy song song |

## Việc cần bạn cung cấp
- **Trước giai đoạn 2:** danh sách 45 tác phẩm + thể loại; chọn 3–5 tác phẩm đầy đủ; file .docx văn bản.
- **Trước giai đoạn 4:** `GEMINI_API_KEY`.
- **Trước giai đoạn 9:** chọn nơi deploy cloud; phong cách hình ảnh.
