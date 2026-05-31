# HƯỚNG DẪN PHÁT TRIỂN & QUY TẮC ĐỒNG BỘ CHO AGENT (rule_agent.md)

Tài liệu này đóng vai trò là "Ground Truth" cho bất kỳ AI Agent nào tham gia pair-programming hoặc bảo trì mã nguồn dự án **NotebookLLM**. Agent cần đọc kỹ, tuân thủ nghiêm ngặt các quy tắc thiết kế hệ thống, cơ sở dữ liệu và giao diện người dùng (UI/UX) tại đây.

---

## 1. TỔNG QUAN HỆ THỐNG & CÔNG NGHỆ CORE
*   **Framework**: Next.js (App Router, version 15.5+) với React Client Components.
*   **Database**: SQLite cục bộ sử dụng thư viện `better-sqlite3`. Xem cấu hình kết nối tại `lib/db/connection.js`.
*   **Styling**: Sử dụng CSS Modules cao cấp kết hợp màu hệ thống HSL động. Phong cách thẩm mỹ hướng tới Dark Mode, Glassmorphic cao cấp, các hiệu ứng hover mượt mà và chuyển động micro-animations.
*   **Icons**: Thư viện `lucide-react`.
*   **Markdown Rendering**: Thư viện `markdown-it` được cấu hình an toàn, không thực thi HTML tùy tiện (`html: false`).

---

## 2. CẤU TRÚC DỮ LIỆU & SQLITE SCHEMA
Cơ sở dữ liệu SQLite được tổ chức thành các bảng chính sau:

```sql
-- 1. Quản lý sổ tay học tập
CREATE TABLE IF NOT EXISTS notebooks (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 2. Quản lý tài liệu nguồn (File đính kèm, Web URL, YouTube link, Paste Text)
CREATE TABLE IF NOT EXISTS sources (
  id TEXT PRIMARY KEY,
  notebook_id TEXT NOT NULL REFERENCES notebooks(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('file','url','youtube','text')),
  content TEXT NOT NULL,
  sync_status TEXT DEFAULT 'pending' CHECK(sync_status IN ('pending','ready','error')),
  error_message TEXT,
  enabled INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 3. Quản lý ghi chú cá nhân của người học
CREATE TABLE IF NOT EXISTS notes (
  id TEXT PRIMARY KEY,
  notebook_id TEXT NOT NULL REFERENCES notebooks(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 4. Bộ nhớ hội thoại & RAG
CREATE TABLE IF NOT EXISTS chat_history (
  id TEXT PRIMARY KEY,
  notebook_id TEXT NOT NULL REFERENCES notebooks(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK(role IN ('user','assistant')),
  content TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 5. Trích dẫn câu trả lời từ tài liệu nguồn (Citations)
CREATE TABLE IF NOT EXISTS citations (
  id TEXT PRIMARY KEY,
  chat_id TEXT NOT NULL REFERENCES chat_history(id) ON DELETE CASCADE,
  source_id TEXT NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
  citation_index INTEGER NOT NULL,
  filename TEXT NOT NULL,
  page_number INTEGER,
  matched_text TEXT NOT NULL
);

-- 6. Quản lý tài liệu học tập sinh ra tự động (Briefing, Guide, FAQ, Mindmap, Timeline, Flashcard, Quiz)
CREATE TABLE IF NOT EXISTS artifacts (
  id TEXT PRIMARY KEY,
  notebook_id TEXT NOT NULL REFERENCES notebooks(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('briefing_doc','study_guide','faq','timeline','flashcards','quiz','mind_map')),
  output_markdown TEXT NOT NULL,
  status TEXT DEFAULT 'pending' CHECK(status IN ('pending','ready','error')),
  error_message TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 7. Chi tiết các câu hỏi hoặc thẻ của một Study Artifact (Quiz / Flashcard)
CREATE TABLE IF NOT EXISTS artifact_items (
  id TEXT PRIMARY KEY,
  artifact_id TEXT NOT NULL REFERENCES artifacts(id) ON DELETE CASCADE,
  content TEXT NOT NULL, -- Định dạng JSON: câu hỏi, đáp án, giải thích hoặc mặt trước/sau
  sort_order INTEGER NOT NULL
);

-- 8. Theo dõi tiến độ học tập (Spaced Repetition & Quiz results)
CREATE TABLE IF NOT EXISTS study_progress (
  id TEXT PRIMARY KEY,
  artifact_id TEXT NOT NULL REFERENCES artifacts(id) ON DELETE CASCADE,
  item_id TEXT NOT NULL REFERENCES artifact_items(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'new' CHECK(status IN ('new','correct','incorrect','skipped')),
  score REAL DEFAULT 0,
  attempts INTEGER DEFAULT 0,
  last_seen_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(artifact_id, item_id)
);
```

---

## 3. CƠ CHẾ SINH SẢN & ĐỊNH DẠNG HỌC TẬP (STUDIO GENERATORS)
Khi người dùng kích hoạt bộ sinh tài liệu ở Panel 3, hệ thống sẽ thực hiện truy vấn RAG trên toàn bộ các tài liệu nguồn đã được bật (`enabled = 1` và `sync_status = 'ready'`) để sinh ra nội dung tương ứng qua mô hình LLM.

### Quy định định dạng đầu ra của LLM:
1.  **Briefing Doc, Study Guide, FAQ**: Đầu ra là Markdown thuần chất lượng cao.
2.  **Timeline**: Đầu ra là một JSON Array hợp lệ có dạng:
    ```json
    [
      { "date": "1995", "event": "Sự kiện A", "detail": "Chi tiết về sự kiện A" },
      { "date": "2008", "event": "Sự kiện B", "detail": "Chi tiết về sự kiện B" }
    ]
    ```
3.  **Mind Map**: Đầu ra là một JSON Tree phân cấp đầy đủ có dạng:
    ```json
    {
      "name": "Chủ đề chính",
      "children": [
        {
          "name": "Nhánh con 1",
          "children": [
            { "name": "Ý nhỏ 1.1" },
            { "name": "Ý nhỏ 1.2" }
          ]
        },
        {
          "name": "Nhánh con 2",
          "children": [
            { "name": "Ý nhỏ 2.1" }
          ]
        }
      ]
    }
    ```
4.  **Flashcards & Quiz**: Được chia nhỏ và lưu trực tiếp thành các bản ghi trong bảng `artifact_items`.

---

## 4. CHI TIẾT CÁC TÍNH NĂNG NÂNG CAO PREMIUM (PHASE 2 - 3)

### A. Spaced Repetition (Lặp lại ngắt quãng) cho Flashcards
*   **Thuật toán hàng đợi ưu tiên**: Thẻ ghi nhớ được tải lên giao diện sẽ được sắp xếp động (Priority Queue) theo thứ tự: các thẻ bị đánh dấu trả lời sai hoặc chưa thuộc (`incorrect` / `score = 0`) xuất hiện đầu tiên, tiếp theo là các thẻ mới chưa từng ôn tập (`unseen`), và cuối cùng là các thẻ đã thuộc (`correct`).
*   **Hệ thống đánh giá 4 mức độ**: Thay vì chỉ chọn Đúng/Sai, người học có 4 lựa chọn tương ứng với hiệu số phản xạ:
    1.  `Chưa thuộc` (Đỏ) -> Lưu `status = 'incorrect'`, `score = 0`. Thẻ sẽ được xếp lên đầu để ôn tập ngay.
    2.  `Khó` (Cam) -> Lưu `status = 'correct'`, `score = 1`. Nhớ mang máng, mất thời gian suy nghĩ.
    3.  `Trung bình` (Tím) -> Lưu `status = 'correct'`, `score = 2`. Nhớ được sau một chút cân nhắc.
    4.  `Dễ` (Xanh lá) -> Lưu `status = 'correct'`, `score = 3`. Thuộc lòng, phản xạ tức thì.

### B. Countdown Timer (Đồng hồ đếm ngược) cho Quiz
*   Mỗi câu hỏi trắc nghiệm có giới hạn thời gian trả lời là **30 giây**.
*   **Hiệu ứng cảnh báo trực quan**: Khi thời gian đếm ngược còn từ 10 giây trở xuống, thanh đếm ngược và nhãn thời gian sẽ chuyển sang màu đỏ và nhấp nháy liên tục (micro-animation pulse).
*   **Xử lý hết giờ (Timeout)**: Nếu đồng hồ đếm ngược chạm mốc `0` và người dùng chưa chọn đáp án, câu hỏi sẽ tự động được đánh dấu là trả lời sai (`incorrect`, `score = 0`) lưu vào database, chuyển sang trạng thái đã làm kèm thông báo hết giờ trực quan, đồng thời phát tín hiệu âm thanh hoặc báo rung nhẹ.

### C. Giao diện trực quan động (Visual Interactive Views)
*   **Interactive MindMap (`components/studio/MindMap.js`)**:
    *   Sử dụng đồ họa SVG phân cấp hình cây tuyệt đẹp.
    *   Cho phép thu gọn/mở rộng các nhánh con thông qua thao tác nhấp chuột trực tiếp vào node cha.
    *   Hỗ trợ kéo rê (Pan) và thu phóng (Zoom) toàn bộ bản đồ bằng con lăn chuột và cử chỉ nắm giữ chuột trái mượt mà.
    *   Tự động tính toán khoảng cách và kích thước nhãn văn bản để tránh tình trạng các node đè chồng lên nhau.
*   **Interactive Timeline Chain (`components/studio/TimelineView.js`)**:
    *   Bố cục dòng thời gian dọc với đường nối mảnh có hiệu ứng dải màu Gradient HSL phản chiếu từ trên xuống dưới.
    *   Từng thẻ sự kiện tự động kích hoạt hiệu ứng fade-in mượt mà lúc hiển thị.
    *   Khi rê chuột (Hover) qua thẻ sự kiện, nút nối dòng thời gian phồng to động, viền thẻ đổi màu nhẹ và toàn bộ thẻ nhấc lên (`translateY(-2px)`) cực kỳ tinh tế.

---

## 5. LƯU Ý KHI COPY TO NOTE (SAO CHÉP THÀNH GHI CHÚ)
Khi người dùng bấm "Lưu thành Ghi chú để chỉnh sửa" từ một visual artifact (Bản đồ tư duy hoặc Dòng thời gian), Agent cần đảm bảo chuyển đổi cấu trúc JSON máy thành cấu trúc Markdown người đọc được một cách hoàn hảo:
*   **Mind Map JSON** -> Chuyển thành cấu trúc danh sách lồng cấp hoàn chỉnh với các thụt lề tương ứng.
*   **Timeline JSON** -> Chuyển thành bảng Markdown hoàn chỉnh với các cột `| Thời gian | Sự kiện | Chi tiết |`.

Hãy luôn đọc kỹ hướng dẫn này trước khi sửa bất kỳ mã nguồn nào để bảo toàn kiến trúc và nâng tầm trải nghiệm của NotebookLLM!
