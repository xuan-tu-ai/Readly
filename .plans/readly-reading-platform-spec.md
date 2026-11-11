# Spec – Readly: Web đọc văn học lớp 12 (đồ án kỹ thuật)

> Nguồn: `docs/CONTEXT.md` + phỏng vấn ngày 2026-11-11.
> Các mục ghi **(mặc định đề xuất)** là giá trị tôi tự chọn để spec đầy đủ — có thể đổi mà không ảnh hưởng kiến trúc.

## 0. Bối cảnh & ràng buộc

- Đây là **đồ án kỹ thuật**, không có người dùng thật (không có học sinh/giáo viên thật). Mọi dữ liệu người dùng là dữ liệu mẫu. Hệ quả: không cần xử lý PII nâng cao (lọc regex, cảnh báo), không cần xác minh email.
- **Bản quyền:** đã có quyền hiển thị toàn văn cả 45 tác phẩm → mọi tác phẩm hiển thị toàn văn.
- Mục tiêu: chạy được end-to-end, giải thích được kiến trúc khi bảo vệ. Chạy **local (Docker Compose)** để dev và **cloud có URL công khai** để demo.
- Toàn bộ giao diện và nội dung bằng tiếng Việt. Múi giờ nghiệp vụ: `Asia/Ho_Chi_Minh`.

### Khác biệt so với CONTEXT.md
- **Bỏ tính năng "AI gợi ý khi học sinh bí"** (tạm thời) — vì ảnh hưởng điểm và tốn token. CONTEXT.md §3.2 vẫn còn dòng này, cần cập nhật nếu muốn đồng bộ.
- Câu hỏi AI **không sinh real-time**: được soạn trước (có thể nhờ AI soạn nháp), admin duyệt rồi cố định.

## 1. Kiến trúc kỹ thuật

| Thành phần | Lựa chọn |
|---|---|
| Web app | Next.js (App Router, TypeScript), Server Actions + Route Handlers |
| UI | Tailwind CSS + shadcn/ui; PWA (manifest + service worker) |
| DB | PostgreSQL + Prisma |
| Auth | Auth.js, Credentials provider (email + mật khẩu, bcrypt/argon2), session DB |
| Hàng đợi / cron | pg-boss (chạy trên Postgres, không cần Redis), process **worker** riêng |
| AI | Google Gemini SDK, model đặt qua `GEMINI_MODEL` (mặc định đề xuất: dòng Flash), structured output bằng JSON schema |
| Web push | Web Push API + VAPID (`web-push`), service worker |
| Import văn bản | `mammoth` (.docx → HTML có ngữ nghĩa) |
| Xuất báo cáo | `exceljs` (.xlsx) |
| Test | Vitest (unit), Playwright (E2E, AI ở chế độ mock) |
| Deploy | Docker Compose: `app`, `worker`, `postgres`. Cloud: VPS/Railway/Render với cùng image |

### Lớp AI
- Interface `AiProvider` với các hàm: `gradeAnswer`, `gradeEssay`, `comparePrediction`, `draftQuestions`, `draftRubric`, `draftMiniGame`.
- Hai implementation: `GeminiProvider` và `MockProvider` (bật bằng `AI_PROVIDER=mock`) — dùng cho E2E và để demo trước hội đồng không phụ thuộc mạng/quota.
- Mọi output AI đều qua JSON schema; parse lỗi = coi như lỗi tạm thời → retry.
- Prompt chỉ chứa nội dung tác phẩm, câu hỏi, rubric, câu trả lời. **Không gửi tên, email, ID người dùng.**

## 2. Vai trò & tài khoản

| Vai trò | Cách tạo | Ghi chú |
|---|---|---|
| Admin | Script seed | Một vai duy nhất cho quản trị + tạo nội dung + tự duyệt/xuất bản |
| Giáo viên | Admin tạo trong trang quản trị | |
| Học sinh | Tự đăng ký: email + mật khẩu + **mã lớp bắt buộc** | Không xác minh email |

- **1 học sinh = 1 lớp** tại một thời điểm. Đổi lớp: nhập mã lớp mới (trong trang cá nhân).
  - Giữ nguyên: tiến độ, điểm, huy hiệu, tô sáng, câu trả lời.
  - Bài thảo luận cũ ở lại lớp cũ. GV lớp cũ mất quyền xem dữ liệu của HS.
  - GV xóa HS khỏi lớp → HS phải nhập mã lớp mới để dùng thảo luận/nhận bài giao (vẫn đọc được).
- **Quên mật khẩu:** GV đặt lại mật khẩu cho HS của lớp mình; admin đặt lại cho GV. Không có luồng email.
- **Phân quyền dữ liệu:** chỉ GV của lớp hiện tại xem được tiến độ/câu trả lời/highlight của HS. Kiểm tra quyền ở server cho mọi truy vấn.

## 3. Mô hình nội dung

```
Work (tác phẩm)
 ├─ metadata: tiêu đề, tác giả, thông tin tác giả, thể loại, tóm tắt, ảnh bìa,
 │            thời lượng đọc ước tính, độ khó, tags (cho test sở thích),
 │            trạng thái: draft | published | coming_soon
 ├─ Segment[] (phân đoạn, admin tự chia: khổ thơ, cảnh kịch, phần truyện…)
 │    ├─ order, title (tuỳ chọn), content (HTML đã sanitize)
 │    └─ Question[] (giai đoạn "trong khi đọc")
 ├─ PreReading: thẻ kiến thức nền + câu dự đoán mở
 ├─ PostReading: Question[] tổng hợp + đề đoạn cảm nhận (đề + dàn ý gợi ý)
 └─ MiniGame[] (gắn với segment "mở khóa sau")
```

### 3.1 Dạng câu hỏi

| Dạng | Giai đoạn | Chấm | Bắt buộc để hoàn thành |
|---|---|---|---|
| Dự đoán mở | Trước khi đọc | Không chấm mức; khi hoàn thành tác phẩm, AI viết phản hồi so sánh dự đoán với nội dung thật | Không **(mặc định đề xuất)** |
| Trắc nghiệm | Trong / sau khi đọc | Tự động, không AI | Có (nếu admin đánh dấu bắt buộc) |
| Tự luận ngắn (1–3 câu) | Trong / sau khi đọc | AI theo rubric | Có (nếu admin đánh dấu bắt buộc) |
| Đoạn cảm nhận (150–300 chữ) | Sau khi đọc | AI theo rubric | Có |

- Mỗi câu tự luận / đoạn cảm nhận có: **rubric 3 mức** (Chưa đạt / Đạt / Sâu sắc) + **danh sách ý chính mẫu**.
- Đoạn cảm nhận: admin soạn sẵn **đề + dàn ý gợi ý tĩnh**; AI chỉ nhận xét bài viết.
- Mỗi câu có cờ `required`.

### 3.2 Quy trình soạn & xuất bản
- Admin soạn hoặc bấm "AI soạn nháp" (câu hỏi, rubric, ý chính, mini game) → chỉnh sửa → **Xuất bản**. Trạng thái: `draft` → `published`. Không có vai duyệt riêng.
- Chỉ nội dung `published` hiển thị cho HS.

### 3.3 Import văn bản
- Upload `.docx` → `mammoth` chuyển sang HTML, giữ nghiêng/đậm, xuống dòng (quan trọng cho thơ).
- Hệ thống **tự đề xuất ranh giới phân đoạn** theo heading và dòng trống liên tiếp; admin kéo/gộp/tách để chỉnh.
- PDF không hỗ trợ trực tiếp — admin tự chuyển sang .docx bên ngoài.
- Sanitize HTML (whitelist thẻ).

### 3.4 Sửa văn bản đã xuất bản
- Cho phép sửa. Segment giữ ID ổn định khi sửa nội dung; xóa segment có dữ liệu liên quan → soft-delete (archived).
- Highlight được **neo lại** (xem §5.2). Câu trả lời giữ nguyên vì gắn với `questionId`.

### 3.5 Dữ liệu seed
- Cả **45 tác phẩm có metadata đầy đủ** (trang chi tiết, tags, thể loại).
- **3–5 tác phẩm hoàn chỉnh** (văn bản + phân đoạn + câu hỏi + rubric + mini game), phủ nhiều thể loại (thơ, truyện ngắn, kịch, ký/nghị luận). Các tác phẩm còn lại trạng thái `coming_soon`, hiện nhãn "Sắp có".
- Seed tài khoản: 1 admin, 2 GV, 2 lớp, ~20 HS với lịch sử đọc/điểm/highlight giả lập để dashboard có dữ liệu.

## 4. Thư viện & bài test sở thích

- Lưới thẻ tác phẩm; tìm kiếm theo tên/tác giả; lọc theo thể loại, thời lượng đọc ước tính, độ khó.
- Trang chi tiết: tóm tắt, thông tin tác giả, thể loại, thời lượng, độ khó, nút "Bắt đầu đọc"/"Tiếp tục đọc", trạng thái "GV giao – hạn dd/mm" nếu có.
- **Bài test sở thích (5–8 câu), không dùng AI:**
  - Mỗi tác phẩm có tags (chủ đề, không khí, thể loại, độ dài, độ khó).
  - Mỗi lựa chọn trong test cộng trọng số cho một số tag → điểm tác phẩm = Σ(trọng số tag × có tag) → xếp hạng.
  - Hiển thị lý do gợi ý từ các tag trùng khớp ("Vì bạn thích truyện có không khí trữ tình, làng quê…").
  - Làm lại được; lưu kết quả mới nhất để trang chủ gợi ý.
  - Bộ câu hỏi test: seed sẵn **(mặc định đề xuất)**; admin chỉnh được là tính năng mở rộng.

## 5. Trang đọc

### 5.1 Bố cục & tuỳ chỉnh
- Điện thoại: một cột, câu hỏi hiện ngay sau phân đoạn tương ứng; thanh điều hướng dưới.
- Máy tính/máy tính bảng: văn bản ở giữa, câu hỏi ở khung bên phải (đồng bộ theo phân đoạn đang đọc); thanh bên trái.
- Tuỳ chỉnh (lưu theo tài khoản): cỡ chữ, giãn dòng, chế độ sáng / sepia / tối.
- Mục lục: nhảy tới phân đoạn, hiển thị trạng thái **đã đọc** và **câu nợ** (câu bắt buộc chưa đạt).
- **Tiếp tục đúng vị trí:** lưu `segmentId + offset trong phân đoạn`, đồng bộ giữa thiết bị.
- **Không chặn đọc**: HS đọc tự do; câu bắt buộc chưa trả lời chỉ hiện nhãn "đang nợ" và chặn trạng thái hoàn thành.

### 5.2 Tô sáng
- Đơn vị: **theo từ (word-snap)** — kéo chọn tự do nhưng tự bắt về ranh giới từ; chạm 1 lần vào một câu = tô cả câu (tiện trên điện thoại).
- **Nhiều màu** (3–4 màu, mặc định đề xuất: vàng = ấn tượng, xanh = thắc mắc, hồng = cảm xúc, tím = nghệ thuật), có ghi chú ngắn tuỳ chọn.
- Mặc định **GV xem được**; HS có thể đánh dấu một highlight là **riêng tư**.
- Nút **"Thảo luận đoạn này"** → tạo bài thảo luận có trích dẫn.
- Lưu vào hồ sơ đọc kèm tên tác phẩm, ngày lưu.
- **Lưu neo:** `segmentId`, `startOffset`, `endOffset`, `quoteText`, `prefix`/`suffix` (~30 ký tự). Khi văn bản đổi: thử offset → tìm `quoteText` với ngữ cảnh prefix/suffix trong segment → tìm trong toàn tác phẩm. Không tìm được → giữ trong hồ sơ, đánh dấu "không còn trong văn bản".

### 5.3 Theo dõi đọc
- **Phân đoạn "đã đọc"** khi điểm cuối phân đoạn đi vào viewport (không yêu cầu thời gian tối thiểu).
- **Thời gian đọc (chỉ GV xem, không ảnh hưởng điểm/hoàn thành):** chỉ đếm khi tab hiển thị **và** có tương tác (cuộn/chạm/phím) trong 60 giây gần nhất. Client gửi heartbeat mỗi 15–30 giây, gán thời gian cho phân đoạn đang hiển thị chính.

## 6. Hướng dẫn đọc bằng AI

### 6.1 Ba giai đoạn
1. **Trước khi đọc:** thẻ kiến thức nền (tác giả, hoàn cảnh sáng tác) + câu dự đoán mở. Có thể bỏ qua.
2. **Trong khi đọc:** câu hỏi theo phân đoạn (trắc nghiệm / tự luận ngắn).
3. **Sau khi đọc:** câu hỏi tổng hợp + đoạn cảm nhận (đề + dàn ý gợi ý) + phản hồi AI cho dự đoán ban đầu. Mở mini game.

### 6.2 Chấm câu tự luận
- Prompt gồm: văn bản **phân đoạn liên quan**, câu hỏi, rubric 3 mức, ý chính mẫu, câu trả lời. System prompt giới hạn AI chỉ nhận xét trong phạm vi đó, giọng thân thiện, phù hợp HS, không đưa đáp án hoàn chỉnh.
- Output JSON: `{ level: "chua_dat" | "dat" | "sau_sac", strengths: string, improvements: string }`.
- Đánh giá là **mức định tính**, không có điểm số.

### 6.3 Làm lại
- Câu "Chưa đạt" được làm lại, **tối đa 3 lần** nộp. Sau lần thứ 3 vẫn Chưa đạt → câu được coi là đã làm (mở khóa hoàn thành), **không cộng điểm**, gắn cờ cho GV xem.
- Trắc nghiệm áp dụng cùng giới hạn 3 lần; chỉ cộng điểm khi đúng **lần đầu**.

### 6.4 Lỗi AI → hàng đợi
- Nộp bài → lưu câu trả lời trạng thái `pending` → job `grade-answer` (pg-boss) → cập nhật mức + nhận xét → thông báo HS.
- Gemini lỗi / chậm / hết quota / sai định dạng: job retry với backoff; HS thấy "Đang chờ nhận xét", đọc tiếp bình thường. **Lần nộp đang chờ không tính vào 3 lượt** cho đến khi có kết quả.
- Không cho nộp lại cùng câu khi đang `pending`.

### 6.5 GV kiểm soát nội dung AI
- GV **sửa mức** đánh giá (điểm tích lũy tính lại theo mức mới) và **viết nhận xét của mình**.
- GV **ẩn nhận xét AI** không phù hợp (thay bằng nhận xét của GV) và **gắn cờ báo admin** để xem lại rubric câu hỏi đó. Admin có hàng chờ "Câu hỏi bị báo cáo".

## 7. Thảo luận

- Phạm vi: **mỗi tác phẩm × mỗi lớp** một khu riêng. GV của lớp kiểm duyệt.
- Cấu trúc: bài gốc + **trả lời 1 cấp** (phẳng).
- Loại bài: **Câu hỏi** / **Cảm nhận**, lọc được; GV đánh dấu câu hỏi "Đã giải đáp".
- Có thể **trích dẫn đoạn văn** (từ highlight hoặc chọn văn bản); bấm trích dẫn → nhảy tới vị trí trong trang đọc.
- **Thả tim**; sắp xếp Mới nhất / Nổi bật.
- Kiểm duyệt: **đăng ngay**, GV ẩn/ghim sau; HS có nút **Báo cáo** → hàng chờ của GV; bộ lọc từ cấm đơn giản (chặn khi đăng).
- Không cộng điểm cho việc đăng bài hay nhận tim (tránh spam).

## 8. Game hóa

### 8.1 Điểm (mặc định đề xuất — admin chỉnh được trong cấu hình)
| Hành động | Điểm |
|---|---|
| Trắc nghiệm đúng lần đầu | 5 |
| Tự luận ngắn: Đạt / Sâu sắc | 10 / 20 |
| Đoạn cảm nhận: Đạt / Sâu sắc | 20 / 40 |
| Hoàn thành tác phẩm | 100 (+50 nếu trước hạn GV giao) |
| Mini game | tối đa 30 / game, tính theo điểm cao nhất (chỉ phần chênh lệch khi phá kỷ lục) |

- Điểm lưu dạng **sổ cái sự kiện** (point ledger) để tính lại được khi GV sửa mức.

### 8.2 Cấp độ & bảng xếp hạng
- Cấp độ theo tổng điểm (mặc định đề xuất): Tân thủ 0 → Người đọc 300 → Mọt sách 1000 → Học giả 2500 → Văn nhân 5000.
- **Bảng xếp hạng lớp:** điểm kiếm được trong tuần (reset 00:00 thứ Hai giờ VN), top 10 + vị trí của mình. **Mặc định bật**, GV tắt được.

### 8.3 Streak
- Một ngày (giờ VN) được tính "có đọc" khi có **bất kỳ tương tác có ý nghĩa**: đọc xong một phân đoạn mới, HOẶC câu trả lời đạt từ mức Đạt / trắc nghiệm đúng, HOẶC chơi mini game.
- Câu trả lời chấm muộn (qua hàng đợi) tính cho ngày **nộp bài**.

### 8.4 Huy hiệu – mẫu quy tắc có tham số
Admin tạo huy hiệu = chọn loại điều kiện + nhập tham số + tên + mô tả + icon:
1. Hoàn thành N tác phẩm
2. Hoàn thành tác phẩm thuộc N thể loại khác nhau
3. Streak N ngày
4. N câu trả lời mức Sâu sắc
5. Hoàn thành tác phẩm X
- Đánh giá huy hiệu đồng bộ sau mỗi sự kiện liên quan (hoàn thành, chấm xong, streak cập nhật). Idempotent: mỗi huy hiệu nhận một lần.

### 8.5 Mini game
- Hai loại: **Ghép nhân vật – sự kiện** và **Đoán chi tiết trong đoạn văn**.
- Admin soạn (có thể nhờ AI nháp) và xuất bản. Mỗi game gắn với một segment "mở khóa sau" — chỉ mở khi HS đã đọc tới đó (tránh spoil).

## 9. Hoàn thành tác phẩm

Tác phẩm **hoàn thành** khi:
1. Mọi phân đoạn đã được đánh dấu đã đọc, **và**
2. Mọi câu bắt buộc (trong + sau khi đọc) đạt từ mức Đạt / trắc nghiệm đúng, hoặc đã dùng hết 3 lượt.

Câu dự đoán và mini game không bắt buộc. Câu `pending` chưa tính.

## 10. Giáo viên

- **Lớp:** tạo lớp → sinh mã lớp (đổi/vô hiệu hóa được); danh sách HS; xóa HS; đặt lại mật khẩu HS.
- **Giao tác phẩm:** chọn tác phẩm + hạn đọc. Tỷ lệ hoàn thành và nhắc nhở tính theo danh sách giao. HS vẫn đọc tự do tác phẩm khác.
- **Dashboard:**
  - Biểu đồ tiến độ lớp theo từng tác phẩm được giao; danh sách HS chưa hoàn thành / quá hạn.
  - Từng HS: tiến độ, thời gian đọc thực tế, câu trả lời, câu bị gắn cờ (3 lần Chưa đạt).
  - Câu trả lời AI gần đây (sửa mức, nhận xét, ẩn nhận xét AI, báo admin).
  - **Highlight nổi bật:** heatmap đoạn được nhiều HS tô nhất (theo tác phẩm) + feed highlight có ghi chú gần đây (trừ highlight riêng tư).
  - Hàng chờ kiểm duyệt thảo luận (bài bị báo cáo).
  - Bật/tắt bảng xếp hạng.
- **Nhắc nhở:** gửi thủ công cho HS chưa hoàn thành (chọn tất cả / từng em).
- **Xuất báo cáo .xlsx:** sheet "Chi tiết" (mỗi HS một dòng, mỗi tác phẩm được giao một cột: trạng thái/% / ngày hoàn thành) + sheet "Tổng hợp" (tỷ lệ hoàn thành từng tác phẩm, thời gian đọc trung bình).

## 11. Thông báo

Kênh: **trong app** (chuông) + **web push** (PWA, HS bật quyền).

| Sự kiện | Người nhận |
|---|---|
| GV giao tác phẩm mới / GV nhắc đọc | HS |
| Tự động 2 ngày và 1 ngày trước hạn nếu chưa hoàn thành (cron pg-boss) | HS |
| AI chấm xong câu trong hàng đợi / GV sửa mức | HS |
| Nhận huy hiệu mới | HS |
| Có người trả lời bài thảo luận của mình | HS |

## 12. Trang chủ & hồ sơ đọc

- **Trang chủ HS:** lời chào, "Tiếp tục đọc" (đúng vị trí), tác phẩm được giao + hạn, gợi ý từ test sở thích, huy hiệu mới nhận, streak, cấp độ.
- **Hồ sơ đọc:** highlight (lọc theo màu/tác phẩm, kèm ngày lưu), huy hiệu, lịch sử đọc (đã đọc, đang đọc + %), điểm & cấp độ.

## 13. Admin

- CRUD tác phẩm + metadata + tags; import .docx; trình chia phân đoạn.
- Soạn câu hỏi 3 giai đoạn, rubric, ý chính mẫu, đề + dàn ý cảm nhận, thẻ kiến thức nền; nút "AI soạn nháp".
- Soạn mini game; cấu hình bảng điểm; tạo huy hiệu từ mẫu quy tắc.
- Tạo tài khoản GV, đặt lại mật khẩu GV.
- Hàng chờ "Nhận xét AI bị GV báo cáo".

## 14. Giao diện

- Nguyên tắc: tươi sáng, thân thiện, phù hợp THPT, không trẻ con. **Phong cách cụ thể chốt sau** khi làm UI.
- Responsive: điện thoại – thanh điều hướng dưới + một cột; máy tính/máy tính bảng – thanh bên + nhiều cột.

## 15. Kiểm thử

- **Vitest (unit):** tính điểm & ledger khi sửa mức, cấp độ, streak theo giờ VN, đánh giá huy hiệu, điều kiện hoàn thành, giới hạn 3 lượt, neo lại highlight, xếp hạng test sở thích, đề xuất phân đoạn từ .docx.
- **Playwright (E2E, `AI_PROVIDER=mock`):**
  1. HS đăng ký bằng mã lớp → làm test sở thích → nhận gợi ý.
  2. HS đọc tác phẩm, trả lời trắc nghiệm + tự luận, tô sáng, hoàn thành → nhận huy hiệu.
  3. Lỗi AI → câu trả lời pending → worker chấm xong → thông báo.
  4. GV giao tác phẩm, xem dashboard, sửa mức, xuất .xlsx.
  5. Admin import .docx, chia phân đoạn, soạn câu hỏi, xuất bản.

## 16. Ngoài phạm vi

Thanh toán; app di động riêng; ngôn ngữ khác tiếng Việt; tích hợp sổ điểm/hệ thống trường; nhắn tin riêng giữa HS; AI gợi ý khi HS bí; xác minh email / quên mật khẩu qua email; import PDF; vai duyệt nội dung riêng; HS thuộc nhiều lớp.

## 17. Còn mở

- Danh sách 45 tác phẩm, thể loại và tags từng tác phẩm; chọn 3–5 tác phẩm seed đầy đủ.
- Chốt giá trị điểm, ngưỡng cấp độ, bộ huy hiệu ban đầu (hiện là mặc định đề xuất).
- Chọn cụ thể model Gemini và kiểm tra chi phí/quota cho demo.
- Bộ câu hỏi test sở thích và bảng trọng số tag.
- Danh sách từ cấm cho bộ lọc thảo luận.
- Phong cách hình ảnh.
