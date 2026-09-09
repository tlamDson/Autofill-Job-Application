# Debug bug — verify bằng Chrome MCP

> Nguồn duy nhất cho quy trình này là `.cursor/rules/verification-workflow.mdc` (dùng chung
> Cursor + Claude Code). File này chỉ là pointer + phần bổ sung riêng cho việc debug 1 bug cụ
> thể (khác với verify 1 task mới) — sửa quy trình verify thì sửa ở file `.cursor/rules/`, không
> lặp lại ở đây.

Task thuần logic trong `matcher.js`/`filler.js` (không đụng DOM thật) verify bằng test jsdom/Node — xem `.claude/rules/tdd.md`, không cần phần này.

## Debug 1 bug quan sát được trên ATS thật (khác task mới)

1. **Trước khi sửa — tái hiện bug thật:** `browser_navigate` tới đúng trang ATS (hoặc `test/*.html` mẫu), thao tác lại đúng bước gây lỗi, xác nhận bug bằng `browser_snapshot`/`browser_take_screenshot`/`browser_cdp` (`Console`/`Network` domain nếu cần). Đừng suy đoán nguyên nhân chỉ từ đọc code — nhiều bug chỉ lộ ra vì ATS đó có cấu trúc DOM khác so với lúc viết adapter.
2. **Sau khi sửa — verify lại đúng thao tác ở bước 1**, xác nhận field nhận đúng giá trị (kiểm cả React/Vue state, không chỉ nhìn DOM), trước khi báo hoàn thành.
3. Không báo "đã fix" nếu chưa tái hiện lại thao tác gây bug sau khi sửa.
4. Nếu bug chỉ xảy ra trên 1 tenant/công ty cụ thể của ATS đó (VD 1 tenant Workday có widget khác tenant khác) → ghi lại làm regression note trong `docs/DESIGN.md` (nợ kỹ thuật), vì fix có thể không tổng quát cho mọi tenant cùng ATS.
