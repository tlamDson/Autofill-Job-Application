# Frontend Design — bắt buộc dùng design system từ skill `ui-ux-pro-max`

> Viết lại từ `.claude/rules/design.md` của repo `tlamDson/music`. Bỏ phần riêng của app nhạc
> (thanh phát, bìa nhạc, bảng track, `--player-bar-h`), giữ nguyên phần nguyên tắc.

Mọi thay đổi UI ở `src/app/**` và `src/components/**` phải tham chiếu design system, **không tự bịa màu/font/spacing**.

Dự án chưa có file design system riêng. Cần style/màu/typography mới thì sinh từ skill thay vì tự nghĩ (Windows dùng `python`, không phải `python3`):

```bash
python .claude/skills/ui-ux-pro-max/scripts/search.py "<truy vấn>" --stack nextjs
python .claude/skills/ui-ux-pro-max/scripts/search.py "<truy vấn>" --stack shadcn
python .claude/skills/ui-ux-pro-max/scripts/search.py "<truy vấn>" --domain style
python .claude/skills/ui-ux-pro-max/scripts/search.py "<truy vấn>" --domain ux
python .claude/skills/ui-ux-pro-max/scripts/search.py "phần mềm nhập liệu kho F&B" --design-system --persist -p "Nhap Lieu"
```

Lệnh cuối sinh ra một design system đầy đủ và ghi ra file — chạy nó **trước** khi dựng trang mới, rồi coi kết quả là nguồn sự thật cho các trang sau.

## Màu luôn qua token semantic

`src/app/globals.css` dùng bộ token shadcn chuẩn: `--color-background`, `--color-foreground`, `--color-card`, `--color-muted`, `--color-muted-foreground`, `--color-primary`, `--color-secondary`, `--color-accent`, `--color-destructive`, `--color-border`, `--color-input`, `--color-ring`, cộng nhóm `--color-sidebar-*`. Font: `--font-sans`, `--font-heading`, `--font-mono`.

Dùng class Tailwind ánh xạ sang token (`bg-background`, `text-muted-foreground`, `border-border`…). **Không viết `rgba()` hay mã hex thẳng vào component** — cần sắc độ mới thì khai báo token ở `:root` trước, để đổi theme chỉ phải sửa một chỗ.

Dự án có `next-themes` — mọi màu mới phải kiểm ở **cả sáng lẫn tối**, không chỉ theme đang mở.

## Dùng lại component, đừng dựng cái thứ hai

- **Component cơ bản**: `src/components/ui/` đã có `alert`, `badge`, `button`, `calendar`, `card`, `checkbox`, `dialog`, `dropdown-menu`, `input`, `label`, `popover`, `select`, `separator`, `skeleton`, `table`, `tabs`, `textarea`, `sonner`. Cần thêm thì thêm bằng shadcn CLI, đừng tự viết tay.
- **Modal/dialog**: dùng `src/components/ui/dialog.tsx`. Đừng tự viết overlay + Escape + click-outside ở component mới.
- **Lưới dữ liệu**: dùng `src/components/grid/DataGrid.tsx` (kèm `paste-handler.tsx`, `column-manager.tsx`). Đây là lưới dùng chung cho toàn app — **đừng dựng bảng thứ hai**. Cần cột riêng cho trang mới thì cấu hình qua props/định nghĩa cột (xem `src/components/ingredients/ingredient-grid-columns.ts` làm mẫu).
- **Khung trang**: `src/components/app-shell.tsx`. Danh tính người đăng nhập hiện ở header qua `user-menu.tsx` (Server Component, đọc session qua `auth()` — không phải context/localStorage phía client).
- **Toast**: dùng `sonner` đã cắm sẵn, không tự dựng hệ thống thông báo riêng.
- **Xung đột phiên bản**: đã có `conflict-dialog.tsx` cho tình huống version conflict — dùng lại thay vì tự báo lỗi kiểu khác.

## Skeleton loading

Thay chữ "Đang tải..." bằng `src/components/ui/skeleton.tsx`, dựng khối phỏng theo hình dạng nội dung sắp hiện (`h-40 w-full` cho khối bảng, `h-6 w-64` cho tiêu đề). Không dùng text thuần.

## Quy ước riêng của dự án này

- **Toàn bộ chuỗi hiển thị và `aria-label` viết tiếng Việt**, thống nhất với phần còn lại của app.
- **Icon dùng `lucide-react`** (đã có trong deps). Không dùng emoji làm icon.
- **Hiển thị số tiền**: format ở tầng view, giá trị tính toán vẫn giữ `Decimal`. Không `toFixed()` rồi đem đi tính tiếp.
- **Thiếu giá thì hiện dấu hiệu cảnh báo rõ ràng** (badge/icon + tooltip giải thích), **không hiện `0`** và cũng không để trống im lặng — người dùng phải phân biệt được "giá bằng 0" với "chưa có giá". Đây là biểu hiện trên UI của quy tắc vàng số 3.
- **Ẩn theo breakpoint thì dùng class responsive, đừng render có điều kiện** — giữ phần tử trong DOM để test và người dùng bàn phím không mất nó.
- **Lưới nhập liệu là màn hình chính của phần mềm này.** Ưu tiên mật độ thông tin và tốc độ thao tác bàn phím (Tab/Enter/mũi tên, dán từ Excel) hơn khoảng trắng thoáng đãng. Đừng áp layout kiểu landing page vào đây.

## Checklist pre-delivery cho mọi UI

- Không dùng emoji làm icon; dùng SVG (`lucide-react`).
- `cursor-pointer` trên mọi phần tử click được.
- Hover state có transition mượt (150–300ms). Không dùng `transition-all`.
- Tương phản chữ tối thiểu 4.5:1 — kiểm ở **cả theme sáng và tối**.
- Focus state nhìn thấy được khi điều hướng bàn phím.
- Tôn trọng `prefers-reduced-motion` (tắt **cả delay**, không chỉ duration — chỉ tắt duration thì item stagger kẹt ở `opacity: 0` và nội dung biến mất).
- Responsive tại 375px, 768px, 1024px, 1440px.
- Tránh anti-pattern trong design system (ví dụ gradient tím/hồng kiểu AI sinh).

## Skills có sẵn (`.claude/skills/`)

| Skill | Dùng khi |
|---|---|
| `ui-ux-pro-max` | Style, màu, font, UX guideline, chart — nguồn bắt buộc cho mọi UI. Có data riêng cho `nextjs`, `shadcn`, `react`. |
| `ui-styling` | Dựng UI bằng shadcn/ui + Tailwind: dialog, dropdown, form, table, dark mode, responsive layout. |
| `design-system` | Token architecture (primitive → semantic → component), component spec, tích hợp Tailwind. |
