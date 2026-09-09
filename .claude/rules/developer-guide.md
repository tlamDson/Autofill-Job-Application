# Developer Guide — Git Flow, PR, Commit

> Quy ước đóng góp code cho dự án — nhóm ổn định nhất trong toàn bộ rule, hiếm khi đổi theo
> kiến trúc. Dùng chung cho cả Claude Code lẫn Cursor.

## Git Flow

`develop ← <type>/<mô-tả> (PR)`, `main ← develop (PR, chỉ chủ repo merge)`. Không bao giờ push thẳng lên `develop` hay `main`.

Tạo nhánh mới từ `develop` **trước khi sửa file đầu tiên**, không phải lúc chuẩn bị commit:

```bash
git fetch origin develop
git checkout -b <type>/<mô-tả-kebab-case> origin/develop
```

Nếu có nhiều task/phiên chạy song song trên cùng máy, dùng `git worktree add ../<tên> -b <type>/<mô-tả> develop` để mỗi task có 1 thư mục vật lý riêng — tránh `git checkout`/`reset` của 1 task xoá mất working-tree chưa commit của task khác. Với extension nhỏ (không cần build step nặng), 1 thư mục là đủ nếu chỉ có 1 task chạy tại 1 thời điểm.

**Branch types:** `feature/`, `fix/`, `test/`, `docs/`, `chore/`. Chữ thường, phân tách bằng `-`, mô tả cụ thể phạm vi — không dùng `feature/update`, `fix/bug`, `feature/wip`.

Nhánh theo Phase trong `docs/DESIGN.md` mục 7 dùng `feature/phase-<n>-<tên-ngắn>` (VD `feature/phase-2-greenhouse-adapter`).

### Điều kiện merge vào `develop`

Merge khi:
- Unit test jsdom pass (`npm test` hoặc tương đương khi đã setup).
- **Đã verify bằng Chrome MCP** theo `.cursor/rules/verification-workflow.mdc` cho mọi thay đổi đụng DOM/adapter — ghi rõ kết quả trong PR description.
- Không commit secrets/API key AI.

Merge vào `develop` dùng **squash**. PR release `develop → main` dùng **merge commit**, không squash.

### PR

Target mặc định là `develop` (chỉ target `main` khi release). Title `<type>: <mô tả ngắn>` (< 72 ký tự). Mô tả theo mẫu:

```markdown
## Summary

- <thay đổi chính>
- <lý do / tác động>

## Test plan

- [ ] Test jsdom mới thêm/cập nhật (TDD: RED → GREEN)
- [ ] Verify bằng Chrome MCP: <trang nào, thao tác gì, kết quả gì>
- [ ] Không commit `.env`, API key, profile data thật
```

### Commit messages

Imperative mood, hoàn thành câu _"If applied, this commit will… [message]"_. Verb chuẩn: `add`, `fix`, `update`, `remove`, `refactor`, `test`, `docs`, `chore`.

```
add classifyField regex for email2 pattern
fix native setter not dispatching change event on select
test add jsdom coverage for detectDateRole edge cases
docs update roadmap phase 2 status
```

Không dùng: `fix bug`, `update code`, `WIP`, past tense (`Fixed login`).

**Không bao giờ commit:** `.env` / credential / API key AI, `node_modules/`, profile/resume data thật của bất kỳ ai, file `.crx`/code trích xuất từ extension của bên thứ 3 (rủi ro bản quyền — xem thảo luận về Simplify/Jobright trong lịch sử chat).
