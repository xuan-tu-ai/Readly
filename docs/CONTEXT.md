# **Mô tả tính năng – Web đọc văn học (Bản demo)**

## **1\. Tổng quan**

Web giúp học sinh lớp 12 đọc 45 tác phẩm văn học Việt Nam theo thể loại. Hệ thống có hướng dẫn đọc bằng AI, không gian thảo luận, huy hiệu để tạo động lực, và công cụ để giáo viên theo dõi tiến độ đọc của học sinh. Giao diện hoạt động tốt trên cả điện thoại và máy tính.

> **Lưu ý:** Đây là đồ án kỹ thuật, không có người dùng thực tế (không có học sinh hay giáo viên thật). Mọi dữ liệu người dùng đều là dữ liệu mẫu.

## **2\. Các vai trò sử dụng**

* **Học sinh:** đọc tác phẩm, làm bài test sở thích, trả lời câu hỏi AI, tô sáng nội dung, thảo luận, nhận huy hiệu.  
* **Giáo viên:** tạo lớp, theo dõi tiến độ đọc, xem câu trả lời và thảo luận của học sinh, điều hành không gian thảo luận.  
* **Quản trị và tạo nội dung:** thêm và sửa tác phẩm, câu hỏi AI, quy tắc huy hiệu. Nội dung do quản trị tạo ra cần được duyệt trước khi hiển thị.

## **3\. Các tính năng** 

### **3.1 Thư viện tác phẩm và bài test sở thích**

* Thư viện 45 tác phẩm, phân loại theo thể loại.  
* Tìm kiếm và lọc theo thể loại, thời lượng đọc ước tính và độ khó.  
* Bài test sở thích ngắn, khoảng 5–8 câu, để gợi ý tác phẩm phù hợp. Học sinh có thể làm lại bài test.  
* Trang chi tiết tác phẩm: tóm tắt, thông tin tác giả, thể loại và nút bắt đầu đọc.

### **3.2 Hướng dẫn đọc bằng AI**

Hướng dẫn đọc chia thành ba giai đoạn:

* **Trước khi đọc:** câu hỏi dự đoán nội dung, gợi nhớ kiến thức nền.  
* **Trong khi đọc:** câu hỏi theo từng đoạn hoặc chương.  
* **Sau khi đọc:** câu hỏi tổng hợp, nhận xét câu trả lời và gợi ý viết đoạn cảm nhận ngắn.

Câu hỏi và phản hồi của AI bám sát tác phẩm và được giới hạn trong phạm vi nội dung đã duyệt.

### **3.3 Không gian thảo luận**

* Mỗi tác phẩm có một khu vực thảo luận riêng.  
* Học sinh đặt câu hỏi, chia sẻ cảm nhận và phản hồi bạn khác.  
* Giáo viên có quyền kiểm duyệt, ẩn hoặc ghim bình luận.

### **3.4 Tô sáng và hồ sơ đọc**

* Học sinh tô sáng đoạn văn ấn tượng và thêm ghi chú ngắn.  
* Các nội dung đã tô sáng được lưu vào hồ sơ đọc cá nhân, kèm tên tác phẩm và ngày lưu.  
* Hồ sơ đọc cũng hiển thị các tác phẩm đã đọc và tiến độ hiện tại.

### **3.5 Game hóa và huy hiệu**

* Huy hiệu người đọc, ví dụ khi hoàn thành một tác phẩm, đọc đủ nhiều thể loại, hoặc đọc đều đặn nhiều ngày liên tiếp.  
* Điểm tích lũy từ việc đọc và trả lời câu hỏi.  
* Mini game ngắn liên quan đến nội dung tác phẩm, ví dụ ghép nhân vật với sự kiện hoặc đoán chi tiết trong đoạn văn.  
* Huy hiệu và điểm chỉ phản ánh việc đọc và tương tác có ý nghĩa, không khuyến khích đọc qua loa.

### **3.6 Quản lý của giáo viên**

* Tạo lớp và mời học sinh tham gia.  
* Theo dõi tiến độ đọc từng học sinh và cả lớp, gồm tỷ lệ hoàn thành và các tác phẩm chưa đọc.  
* Xem các câu trả lời AI gần đây và highlight nổi bật của học sinh.  
* Gửi nhắc nhở đọc cho học sinh chưa hoàn thành.  
* Xuất báo cáo tiến độ.

### **3.7 Quản trị và tạo nội dung**

* Thêm, sửa tác phẩm và thông tin liên quan.  
* Soạn câu hỏi trước, trong và sau khi đọc, có thể nhờ AI soạn nháp.  
* Thiết lập quy tắc huy hiệu và mini game.  
* Quy trình duyệt nội dung trước khi hiển thị cho học sinh.

## **4\. Giao diện trông như thế nào**

### **4.1 Nguyên tắc chung**

* Tươi sáng, thân thiện nhưng vẫn phù hợp với học sinh THPT, không quá trẻ con.  
* Thiết kế responsive: trên điện thoại dùng thanh điều hướng dưới và bố cục một cột; trên máy tính và máy tính bảng dùng thanh bên và bố cục nhiều cột.

### **4.2 Các màn hình chính**

* **Trang chủ:** lời chào, nút tiếp tục đọc, gợi ý tác phẩm, huy hiệu mới nhận.  
* **Thư viện:** lưới thẻ tác phẩm, bộ lọc theo thể loại, nút làm bài test sở thích.  
* **Trang đọc:** nội dung tác phẩm ở giữa. Câu hỏi AI hiện ngay sau đoạn tương ứng trên điện thoại, còn trên máy tính hiện trong khung bên phải. Học sinh chạm hoặc kéo để tô sáng đoạn văn.  
* **Hồ sơ đọc:** danh sách đoạn đã tô sáng, huy hiệu, lịch sử đọc.  
* **Bảng điều khiển giáo viên:** danh sách lớp, biểu đồ tiến độ, danh sách học sinh chưa đọc.  
* **Trang thảo luận:** danh sách bình luận theo tác phẩm, có công cụ kiểm duyệt cho giáo viên.

## **5\. Quy tắc chung**

* Nội dung do AI tạo ra phải phù hợp với học sinh, và giáo viên có quyền kiểm duyệt.  
* Không gửi thông tin cá nhân của học sinh lên dịch vụ AI.  
* Dữ liệu học sinh được bảo vệ và chỉ giáo viên của lớp mới xem được tiến độ của các em.  
* Giao diện và nội dung hoàn toàn bằng tiếng Việt.

## **6\. Ngoài phạm vi** 

* Thanh toán và gói trả phí.  
* Ứng dụng di động riêng (iOS, Android).  
* Hỗ trợ ngôn ngữ khác ngoài tiếng Việt.  
* Tích hợp với sổ điểm hoặc hệ thống quản lý của trường.  
* Nhắn tin riêng giữa học sinh.

## **7\. Việc cần chốt trước khi thiết kế**

* Logic cho AI tạo câu hỏi  
* Danh sách 45 tác phẩm và thể loại của từng tác phẩm.  
* Quy tắc cấp huy hiệu và điểm.  
* Các quy định kiểm duyệt bình luận và nội dung AI.