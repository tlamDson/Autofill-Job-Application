# Workflow — hub

> Quy tắc bất di bất dịch + quy ước ghi nợ kỹ thuật. Chi tiết git flow/PR/commit xem `.claude/rules/developer-guide.md`, quy trình test xem `.claude/rules/tdd.md`.

## Quy tắc bất di bất dịch

1. **Mọi thay đổi đều phải qua PR.** Không commit thẳng vào `develop`/`main`. Tạo nhánh mới từ `develop` **trước khi sửa file đầu tiên** → code → commit → push → mở PR vào `develop`. Chi tiết ở `.claude/rules/developer-guide.md` mục "Git Flow".
2. **`main` do chủ repo quản lý.** Không merge vào `main`. PR `develop → main` chỉ chủ repo tự thực hiện khi release.
3. **Làm tuần tự theo roadmap ở `docs/DESIGN.md` mục 7.** Mỗi Phase chia nhỏ theo `.cursor/rules/verification-workflow.mdc` (1 field type / 1 adapter / 1 hàm mỗi task).
4. **Trước khi viết code mới, kiểm tra `src/matcher.js`/`src/filler.js`** xem đã có helper phù hợp chưa (`setNativeValue`, `detectDateRole`, `fillSplitNumber`, `buildContext`, `classifyField`) — đừng viết trùng.
5. **Khi kiến trúc/thiết kế thay đổi: sửa `docs/DESIGN.md`**, không sửa file này. Convention/tooling thay đổi thì cập nhật `.claude/rules/*`.
6. **Mọi thay đổi đụng DOM/form-filling bắt buộc verify bằng Chrome MCP** cả trước lẫn sau khi fix — xem `.cursor/rules/verification-workflow.mdc` (nguồn duy nhất, dùng chung Cursor + Claude Code).
7. **Sau khi plan được duyệt, chạy hết một phiên không tự dừng hỏi giữa chừng** trừ khi có quyết định thiết kế/rủi ro thật cần user — xem mục "Phiên làm việc tự động" bên dưới.

## Phiên làm việc tự động

Áp dụng sau khi plan đã được review/duyệt (không áp dụng ở bước lập plan — plan vẫn cần duyệt trước).

1. **Thực thi liên tục tới hết 1 task nhỏ đã duyệt.** Không dừng giữa chừng để hỏi các quyết định implementation nhỏ (đặt tên, cấu trúc file, chọn cách viết trong phạm vi đã duyệt) — tự quyết theo best judgement và rule đã có (TDD, verification-workflow). Nhưng **vẫn dừng lại sau mỗi task nhỏ để verify bằng Chrome MCP** trước khi mở task tiếp theo (đúng tinh thần chia nhỏ vì context window hạn chế).
2. **Có câu hỏi thật (ambiguity thiết kế, field mapping không rõ, hành vi ATS chưa xác nhận) → hỏi ngay lúc phát sinh**, không đợi tới cuối phiên mới hỏi dồn.
3. **Cuối mỗi task**, nếu đã verify Chrome MCP thành công: cập nhật `docs/DESIGN.md` mục roadmap (đánh dấu Phase đang làm) nếu cần — không đụng `.claude/rules/*` trừ khi chính quy trình/tooling thay đổi.

## Nợ kỹ thuật

Mỗi khoản nợ ghi đủ ba phần, nếu không thì vô dụng khi đọc lại sau vài tuần:

- **Triệu chứng** — hành vi sai người dùng thấy (VD "field X trên Workday bị điền sai giá trị").
- **Nguyên nhân** — chỗ nào trong code, kèm `file:line`.
- **Điều kiện kích hoạt** — khi nào nó thành lỗi thật (VD "chỉ khi option list render động sau khi mở combobox").

Ghi nợ **ngay lúc phát hiện**, kể cả khi không sửa ngay, vào danh sách sống ở cuối `docs/DESIGN.md` (mục "Rủi ro & giới hạn" hoặc mục nợ kỹ thuật riêng nếu list dài). Sửa xong thì xoá khỏi danh sách trong cùng commit với bản sửa.
