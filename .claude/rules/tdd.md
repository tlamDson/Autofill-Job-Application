# TDD (Red → Green → Refactor)

> Nguồn duy nhất cho quy trình test của dự án. `.claude/agents/qa-testing.md` và
> `.claude/agents/code-reviewer.md` trỏ về đây thay vì diễn giải lại — sửa quy trình test thì
> chỉ sửa file này.

Bắt buộc cho mọi feature/fix trong `matcher.js`, `filler.js`, `adapters/*`:

1. **RED** — viết test fail trước, chưa viết implementation. Test đặt cạnh file nguồn: `test/matcher.test.js`, `test/filler.test.js`. Xác nhận **thấy đỏ đúng nghĩa** (assertion fail, không phải lỗi import/cấu hình).
2. **GREEN** — code tối thiểu để pass, không thêm logic chưa có test bao phủ. Nếu implementation đã tồn tại và chỉ được giao viết test bổ sung: dừng ở RED → verify GREEN, không tự sửa logic ngoài phạm vi được giao.
3. **REFACTOR** — cải thiện code, chạy lại toàn bộ test, không được break.
4. **VERIFY THẬT** — jsdom pass **không phải điều kiện đủ**. Với mọi thay đổi đụng DOM/adapter, tiếp tục sang bước Chrome MCP verify theo `.cursor/rules/verification-workflow.mdc` trước khi coi task xong.

```bash
npm test              # test jsdom/Node — matcher.js, filler.js (pure function, không cần browser)
npm run test:watch    # chạy lại khi sửa file
```

> Lệnh cụ thể sẽ chốt khi setup `package.json` ở Phase 1 (`docs/DESIGN.md` mục 7) — cập nhật file này khi đó.

## Hai lớp test — không giống nhau, không thay thế nhau

- **Unit (jsdom/Node)** — `classifyField`, `buildContext`, `detectDateRole`, `fillSplitNumber`, `stripExample` là pure function, test trực tiếp bằng Node **không cần jsdom** (string in → key out). Các hàm cần DOM giả (`setNativeValue`, adapter fill) dùng jsdom, không cần trình duyệt thật. Nhanh, chạy được trong CI, dùng để bắt lỗi logic rẻ và sớm.
- **Chrome MCP (trang thật)** — bắt lớp lỗi mà jsdom không thể: React/Vue có thực sự nhận state không, combobox custom có thực sự mở/chọn được không, Shadow DOM/iframe thật có traverse được không, ATS thật có đổi cấu trúc so với lúc viết adapter không. **Bắt buộc** cho mọi PR đụng DOM/form-filling — xem quy trình đầy đủ ở `.cursor/rules/verification-workflow.mdc`.

## Case bắt buộc có test cho `classifyField`

Theo đúng cạm bẫy đã biết từ nghiên cứu kiến trúc tương tự (xem `docs/DESIGN.md` mục 4):

- Text mẫu dạng "VD: Nguyễn Văn A" cạnh field không được làm sai lệch phân loại (`stripExample`).
- Compound word chứa field key làm substring (VD "company name" chứa "name") không được bị nhận nhầm — cần test âm (`null` hoặc key khác).
- Thứ tự ưu tiên: case cụ thể hơn phải được test để confirm nó thắng case tổng quát hơn khi cả hai cùng match.
- Field nhạy cảm (SSN, DOB chi tiết, passport...) phải test trả về `null`/bị block, không match vào field key nào.

## Quy ước test

- Coverage không bắt cứng theo %, nhưng **mọi case đã từng gây misclassification trên form thật phải được thêm làm regression test** — không xoá test cũ khi sửa bug mới, chỉ thêm.
- Assertion cụ thể theo hành vi (input string → key cụ thể, hoặc input DOM → value cụ thể), không `toBeTruthy()` mơ hồ.
- Không `test.skip` mà không giải thích lý do. Không commit code mới thiếu test cho `matcher.js`/`filler.js`.
