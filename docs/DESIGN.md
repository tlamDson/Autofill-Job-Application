# Design Doc: Autofill Job Application Extension (SWE-focused)

> Mục tiêu: Chrome extension autofill hàng loạt job application cho vị trí SWE, tốc độ & độ chính xác tiếp cận Simplify Copilot, nhưng **profile chi tiết hơn** (resume đầy đủ + nhiều field), và **tách biệt rõ** giữa fill nhanh (structured data) và câu hỏi phức tạp (essay/open-ended).

> **Setup 2 IDE trên cùng repo:** dự án dùng cả Claude Code (IDE/môi trường khác) và Cursor (ở đây), trên cùng 1 git repo. Mỗi tool chỉ đọc thư mục convention riêng của nó — Claude Code đọc `.claude/rules/*.md` + `.claude/agents/*.md`, Cursor đọc `.cursor/rules/*.mdc`. Nội dung 2 bên **tương đương nhưng không tự sync** (không tool nào đọc được thư mục của tool kia). Đổi quy trình (git flow/TDD/verify) ở 1 bên → **phải tự sửa tay bên kia trong cùng lúc**:
>
> | Đổi ở | Cũng phải sửa |
> |---|---|
> | `.claude/rules/workflow.md` | `.cursor/rules/workflow.mdc` |
> | `.claude/rules/developer-guide.md` | `.cursor/rules/developer-guide.mdc` |
> | `.claude/rules/tdd.md` | `.cursor/rules/tdd.mdc` |
> | `.claude/rules/debug-chrome-mcp.md` / `.cursor/rules/verification-workflow.mdc` | file kia (2 file này đã là 1 cặp, không phải 3) |
>
> `.claude/agents/*.md` (researcher/qa-testing/code-reviewer) **không có bản Cursor tương đương** — Cursor không hỗ trợ custom subagent qua file, nên khi cần vai trò tương tự trong Cursor, dùng `Task` với `subagent_type: generalPurpose` và chép checklist từ file agent tương ứng vào prompt.

## 1. Nguyên tắc thiết kế (Design Principles)

1. **Local-first, no round-trip cho fast-fill.** Toàn bộ pipeline match field → điền field chạy 100% trong browser, không gọi API cho các field chuẩn (tên, email, education, work history...). Chỉ gọi AI/server cho câu hỏi mở (essay).
2. **Human-in-the-loop, không auto-submit.** Extension luôn dừng lại trước nút Submit để user review. Đây là cơ chế giữ accuracy "cảm nhận" cao dù matching không hoàn hảo 100%.
3. **Adapter pattern theo ATS, không cố làm 1 giải pháp chung cho tất cả.** Vì các ATS lớn (Greenhouse, Lever, Workday, iCIMS, Ashby...) dùng chung field structure trên mọi tenant, viết adapter riêng cho từng ATS lớn → tốc độ + accuracy cao nhất trên phần lớn thị trường SWE. Site lạ → rơi vào generic heuristic matcher.
4. **Pure-function core, test được không cần browser.** Logic phân loại field (`classifyField`) phải là pure function (string in → key out) để test bằng Node/jsdom, không cần Puppeteer.
5. **Tách bạch 2 luồng dữ liệu:**
   - **Fast-fill data** (structured, deterministic): tên, liên hệ, education, work history, skills, links, work authorization, EEO/demographic, salary expectation... → điền tức thì, không cần AI.
   - **Complex-answer data** (essay, "why this company", "tell us about a project"...) → luồng riêng, có thể chậm hơn, có review UI riêng, dùng AI + cache theo (câu hỏi, company) để tái sử dụng.
6. **Không gửi dữ liệu nhạy cảm (SSN, DOB chi tiết...) ra ngoài nếu không cần thiết.** Ưu tiên lưu local (`chrome.storage.local`), chỉ sync/cloud khi user chủ động chọn.

## 2. Kiến trúc tổng thể

```
┌─────────────────────────────────────────────────────────────────┐
│                         Chrome Extension (MV3)                   │
│                                                                    │
│  ┌───────────┐      ┌────────────────┐      ┌──────────────────┐ │
│  │  Popup UI  │◄────►│ Background SW  │◄────►│  Options/Profile  │ │
│  │ (quick     │      │ (routing, AI   │      │  Editor UI        │ │
│  │  actions)  │      │  proxy calls)  │      │  (resume import,  │ │
│  └───────────┘      └───────┬────────┘      │   full profile)   │ │
│                              │                └──────────────────┘ │
│                              │ chrome.storage.local                │
│                              ▼                                     │
│                    ┌──────────────────┐                            │
│                    │   Profile Store   │                            │
│                    │ (schema §3 dưới)  │                            │
│                    └─────────┬────────┘                            │
│                              │                                      │
│         ┌────────────────────┴─────────────────────┐               │
│         ▼                                            ▼              │
│  ┌─────────────────┐                        ┌──────────────────┐   │
│  │  Content Script   │  ──postMessage──►     │  Injected Script  │   │
│  │  (sandboxed,       │                       │  (page context,   │   │
│  │  orchestrator)     │  ◄──postMessage──     │  đụng React state,│   │
│  │  - scan DOM        │                       │  native setter)   │   │
│  │  - detect ATS      │                       └──────────────────┘   │
│  │  - chọn adapter     │                                              │
│  │  - hiện nút Autofill│                                              │
│  │  - MutationObserver │                                              │
│  │  (multi-step forms) │                                              │
│  └─────────┬───────────┘                                              │
│            │                                                          │
│  ┌─────────▼───────────┐                                              │
│  │   Matching Engine     │                                             │
│  │  ┌─────────────────┐  │                                             │
│  │  │ ATS Adapters      │  │  Greenhouse / Lever / Workday / iCIMS /   │
│  │  │ (schema đã biết)  │  │  Ashby / SmartRecruiters ...              │
│  │  └─────────────────┘  │                                             │
│  │  ┌─────────────────┐  │                                             │
│  │  │ Generic Heuristic │  │  buildContext() + classifyField()         │
│  │  │ Matcher (fallback)│  │  (pure functions, xem §4)                 │
│  │  └─────────────────┘  │                                             │
│  │  ┌─────────────────┐  │                                             │
│  │  │ Complex-Answer     │  │  essay/open-ended → cache theo câu hỏi   │
│  │  │ Router             │  │  đã trả lời, hoặc gợi ý AI (async, chậm) │
│  │  └─────────────────┘  │                                             │
│  └───────────────────────┘                                             │
└─────────────────────────────────────────────────────────────────┘
```

**Vì sao cần Content Script + Injected Script riêng?**
Content script chạy trong "isolated world" — không đụng trực tiếp được biến JS của trang (React internal state). Để set giá trị vào input do React/Vue kiểm soát và khiến framework nhận ra thay đổi, cần chạy đoạn set-value trong **page context** (injected `<script>` thật vào DOM, hoặc dùng MAIN world content script của MV3). Content script chỉ điều phối (nhận lệnh từ popup, gửi dữ liệu profile, hiện UI nút bấm), injected script làm phần "đụng DOM/React".

## 3. Profile Schema (nguồn dữ liệu cho fast-fill)

Vì bạn sẽ cung cấp resume chi tiết + nhiều thông tin, schema cần đủ rộng để cover mọi field thường gặp trên form SWE application. Đề xuất:

```typescript
interface Profile {
  personal: {
    firstName: string;
    lastName: string;
    preferredName?: string;
    email: string;
    phone: string;          // dạng chuẩn hoá E.164, convert format theo field khi fill
    phoneCountryCode?: string;
    address: {
      line1: string;
      line2?: string;
      city: string;
      state: string;
      postalCode: string;
      country: string;
    };
    dateOfBirth?: string;   // optional, nhiều field không hỏi
    pronouns?: string;
  };

  links: {
    linkedin?: string;
    github?: string;
    portfolio?: string;
    website?: string;
    other?: { label: string; url: string }[];
  };

  workAuthorization: {
    needsSponsorship: boolean;
    authorizedToWork: boolean | null;  // null = chưa trả lời -> bỏ qua field trên form, không đoán "No"
    visaStatus?: string;
  };

  eeo: {  // Equal Employment Opportunity / demographic - luôn optional/"decline to answer" theo default
    gender?: string;
    race?: string;
    veteranStatus?: string;
    disabilityStatus?: string;
    hispanicLatino?: boolean;
  };

  consents: {
    agreeToTerms: boolean;  // default false; chỉ tick checkbox "I agree to Terms/Privacy Policy" khi true.
                             // Không bao giờ áp dụng cho background check / credit check / drug screen /
                             // arbitration / at-will acknowledgment - matcher.js loại các câu đó ra hẳn.
  };

  education: {
    school: string;
    degree: string;         // "Bachelor's", "Master's"...
    fieldOfStudy: string;
    gpa?: number;
    startDate: string;      // ISO yyyy-mm
    endDate: string;        // ISO yyyy-mm, hoặc "present"
    location?: string;
  }[];

  workHistory: {
    company: string;
    title: string;
    location?: string;
    startDate: string;
    endDate: string;        // "present" nếu đang làm
    description: string;    // bullet points, dùng cho field mô tả công việc
    isCurrent: boolean;
  }[];

  skills: string[];         // tags: languages, frameworks, tools

  resumeFiles: {
    id: string;
    label: string;          // "Default resume", "Backend-focused resume"...
    fileRef: string;        // reference tới file lưu trong IndexedDB/local
  }[];

  compensation: {
    desiredSalaryMin?: number;
    desiredSalaryMax?: number;
    currency?: string;
    noticePeriod?: string;
  };

  // Câu trả lời đã lưu cho câu hỏi mở, KHÔNG thuộc fast-fill,
  // được Complex-Answer Router tái sử dụng khi gặp câu hỏi tương tự.
  savedAnswers: {
    questionFingerprint: string; // normalized hash của câu hỏi
    questionText: string;
    answer: string;
    company?: string;            // nếu answer chỉ áp dụng 1 company
    lastUsedAt: string;
  }[];
}
```

**Ghi chú khi bạn cung cấp resume:** cần parse resume ra đúng các field trên (education/workHistory dạng structured, không phải block text) để matching engine điền được vào field riêng lẻ (VD Greenhouse có field `Company`, `Title`, `Start Date`, `End Date` riêng biệt, không phải 1 textarea).

## 4. Matching Pipeline (fast-fill, field chuẩn)

Thứ tự xử lý khi bấm "Autofill":

1. **Detect ATS**: dựa vào hostname/DOM signature (`*.myworkdayjobs.com` → Workday, `boards.greenhouse.io` / `job-boards.greenhouse.io` → Greenhouse, `jobs.lever.co` → Lever, v.v.) → chọn adapter tương ứng nếu có.
2. **Nếu có adapter riêng**: dùng field-mapping đã biết trước (selector/`data-automation-id`/schema JSON public nếu có, như Greenhouse) → độ chính xác cao nhất, tốc độ nhanh nhất.
3. **Nếu không có adapter (site lạ)**: chạy generic heuristic:
   - `buildContext(el)`: gom text quanh field — attributes (`name/id/placeholder/aria-label/autocomplete/title`), `aria-labelledby`, `label[for]`, đi ngược DOM tối đa N cấp lấy text từ `<th>`/`<dt>`/sibling trước không chứa control.
   - `stripExample(text)`: loại bỏ text mẫu dạng "VD: Nguyễn Văn A" để tránh nhiễu classify.
   - `classifyField(ctx)`: pure function, regex theo thứ tự ưu tiên → trả về field key (`firstName`, `email`, `school`, ...) hoặc `null` nếu không nhận diện được (bỏ qua field đó, không đoán mò).
4. **Complex-answer router**: field không map được vào key nào trong fast-fill schema, nhưng được nhận diện là input dạng textarea/long-text với label câu hỏi mở → đưa vào hàng riêng, tra `savedAnswers` theo fingerprint câu hỏi trước, nếu có cache thì fill nhanh (không cần AI), nếu chưa có thì **để trống + đánh dấu cần AI hoặc tay điền**, không block luồng fast-fill của các field khác.
5. **Fill từng field theo type**:
   - Text input thường → `setNativeValue` (native setter + dispatch `input`/`change`).
   - `<select>` chuẩn / ngày chia 3 select → `detectDateRole` theo range giá trị.
   - Custom combobox (không phải `<select>` thật) → mở control → đọc option render ra → match theo text gần nhất → click chọn → verify giá trị đã "dính".
   - Field chia nhỏ (phone/postal 2-3 box) → `fillSplitNumber` theo `maxlength` hoặc pattern số cụm.
   - File upload (resume) → `DataTransfer` API giả lập chọn file; nếu trang override `click()` để tạo input động (Workday) → cần intercept theo hướng dẫn ở research trước.
6. **Multi-step form**: `MutationObserver` theo dõi DOM đổi giữa các step, tự động re-run pipeline khi step mới render (không cần user bấm lại nút mỗi step) — có thể để tuỳ chọn on/off vì đây là hành vi "tự lái", cần cẩn trọng để không submit nhầm.

## 5. Complex-Answer Flow (câu hỏi phức tạp — tách riêng khỏi fast-fill)

Theo yêu cầu: **fast-fill phải nhanh, không bị block bởi câu hỏi phức tạp.**

- Khi Matching Pipeline chạy xong fast-fill (structured fields), các câu hỏi mở được liệt kê riêng trong 1 panel ("N câu hỏi cần bạn xem lại").
- Với mỗi câu hỏi mở:
  1. Tính `questionFingerprint` (normalize whitespace/case, hash).
  2. Tra `savedAnswers` local — nếu công ty giống hoặc câu hỏi giống ≥ ngưỡng similarity → tự điền câu trả lời cũ (nhanh, không cần AI).
  3. Nếu không có cache → **không tự điền**. Hiện gợi ý "Generate with AI" (gọi model, có JD + profile) làm draft, user review/sửa rồi mới chấp nhận → answer mới được lưu vào `savedAnswers` để dùng lần sau.
- Việc này giữ được nguyên tắc: fast-fill chạy đồng bộ, tức thì; complex-answer là luồng bất đồng bộ, không làm chậm phần còn lại.

## 6. Kiến trúc file (đề xuất khi bắt đầu code — chưa code ở giai đoạn này)

```
extension/
├── manifest.json
├── src/
│   ├── content.js          # orchestrator, hiện nút, điều phối MutationObserver
│   ├── injected.js          # MAIN world: setNativeValue, form filling thực tế
│   ├── matcher.js           # buildContext() + classifyField() — pure, test bằng jsdom
│   ├── filler.js            # detectDateRole, fillSplitNumber, combobox handler, file upload
│   ├── adapters/
│   │   ├── greenhouse.js
│   │   ├── lever.js
│   │   ├── workday.js
│   │   ├── icims.js
│   │   └── generic.js       # fallback heuristic
│   ├── complexAnswer.js     # fingerprint, cache lookup, AI call trigger
│   ├── settings/
│   │   ├── store.js         # loadSettings/saveSettings/onSettingsChange (chrome.storage.local, deep-merge)
│   │   └── fieldGroups.js   # FIELD_GROUPS (theo key classifyField) + isFieldEnabled/setFieldEnabled/setGroupEnabled/groupState
│   └── background.js        # service worker: AI proxy call, storage coordination
├── popup/                   # quick autofill trigger + trạng thái, link ⚙ → options#settings
├── options/                 # tab "Profile" (editor đầy đủ) + tab "Settings" (options/sections/settings.js)
└── test/
    ├── matcher.test.js      # unit test classifyField (không cần browser)
    ├── e2e.test.js          # jsdom, sample-form.html giả lập nhiều layout
    └── adapters/*.test.js   # test riêng từng adapter với HTML mẫu đã snapshot
```

## 7. Roadmap triển khai (độ khó tăng dần)

| Phase | Nội dung | Lý do thứ tự |
|---|---|---|
| 0 | Profile schema + Options UI nhập/import resume | Cần trước tiên vì mọi thứ phụ thuộc vào data |
| 1 | Generic heuristic matcher (`matcher.js`) + test jsdom | Core logic, hoạt động trên site bất kỳ, baseline accuracy |
| 2 | Adapter Greenhouse | ATS phổ biến nhất cho SWE, HTML server-render, có schema JSON công khai → dễ nhất |
| 3 | Adapter Lever | SPA React, chủ yếu là xử lý event-dispatch đúng cách |
| 4 | Complex-answer flow (cache + AI draft) | Sau khi fast-fill ổn định |
| 5 | Adapter Workday | Khó nhất — multi-step, widget ID động, custom combobox nhiều tầng |
| 6 | iCIMS / Ashby / SmartRecruiters | Mở rộng coverage |
| 7 | Đo accuracy thực tế trên nhiều tenant, feedback loop (log field không classify được để tinh chỉnh regex) | Cần dữ liệu thật để cải thiện |

## 8. Rủi ro & giới hạn cần lưu ý

- **Closed Shadow DOM**: không có cách nào truy cập từ content/injected script — chấp nhận bỏ qua, log lại để biết site nào bị ảnh hưởng.
- **Anti-bot / honeypot fields**: 1 số form có field ẩn dùng để bắt bot (nếu field bị điền thì bị flag) — cần bỏ qua field có `display:none`/`visibility:hidden`/kích thước 0 hoặc field có tên gợi ý honeypot.
- **Field nhạy cảm** (SSN, routing number, passport...) — luôn có regex-blocklist để KHÔNG BAO GIỜ tự điền, dù có data trong profile.
- **Workday file upload**: cơ chế click() bị override động → cần override `HTMLInputElement.prototype.click` ở injected script để bắt input thật.
- **Đừng auto-submit**: rủi ro pháp lý/đạo đức + rủi ro apply nhầm thông tin sai mà không ai kiểm tra.
- **Resume format khác nhau giữa ATS** yêu cầu format cụ thể (date format, "Present" vs "Current"...) → cần chuẩn hoá ở tầng filler, không hardcode 1 format trong profile.

## 9. Nguồn tham khảo dùng khi research

- Simplify Copilot docs: help.simplify.jobs (autofill flow, settings)
- Review kỹ thuật 2026: jobhire.ai (accuracy 85-90% Greenhouse/Lever, ~70% Workday)
- Cơ chế heuristic + code mẫu đầy đủ: [dev.to — Building a Local-Only Chrome Extension That Autofills Job Application Forms](https://dev.to/bokuwalily/building-a-local-only-chrome-extension-that-autofills-job-application-forms-4f8a)
- Mã nguồn mở tương tự: [Jotofiller](https://github.com/mjishnu/Jotofiller), [job_app_filler](https://github.com/berellevy/job_app_filler)
- Phân tích chuyên sâu Workday/Greenhouse/Lever: openapplier.com/blog (workday-fields-decoded, greenhouse-lever-ashby-fillers-view), veloapply.com (autofill-fails-greenhouse-workday), cvcircuit.com (file upload injection technique)

## 10. Đối chiếu tính năng với Simplify Copilot (feature-parity checklist)

> Nguồn: danh sách setting thực tế của Simplify (help.simplify.jobs) do user cung cấp trong phiên chat, đối chiếu trực tiếp với source code hiện tại. Cập nhật lần 2 (2026-09-10) sau khi build Settings tab (`src/settings/`, `options/sections/settings.js`) trên nhánh `develop`. ✅ = đã có · 🟡 = có nền tảng nhưng chưa đầy đủ / khác hành vi có chủ đích · 🔴 = chưa build.

| Simplify setting | Trạng thái | Ghi chú |
|---|---|---|
| Autofill all fields with AI (auto AI cho mọi câu hỏi unique) | 🔴 | Vẫn chưa có toggle "mọi field" kiểu Simplify — nhưng đã có `autoAnswerOpenQuestions` (Settings tab) tự AI-answer các câu hỏi mở còn lại sau khi tra cache, xem row dưới. |
| Answer unique questions with AI during autofill | ✅ | Giờ là toggle thật trong Settings (`autoAnswerOpenQuestions`, default OFF): OFF → chỉ fill từ `savedAnswers` cache, để user tự bấm AI từng câu; ON → `content.js` tự gọi `handleGenerateAI` cho câu hỏi cache-miss, đổ draft vào cả textarea panel lẫn field thật, user vẫn review trước khi tự bấm Submit. |
| Extract keywords with AI (string-match keyword từ JD) | 🔴 | Chưa từng đọc nội dung job description. |
| "Generate with AI" button on form fields | ✅ | `complexAnswer.js` → `createReviewPanel`; giờ có thêm toggle `showGenerateAIButton` (Settings tab, default ON) để ẩn nút này theo ý user (`createReviewPanel(..., { showAIButton })`). |
| Resume match banner (điểm khớp keyword trên trang job) | 🔴 | Chưa có. |
| Continuously autofill multipage forms | 🟡 | Giờ là toggle thật (`continuousMultipage`, Settings tab, default ON): `content.js` arm `createFormObserver` sau mỗi lần fill, tự **re-fill** field mới xuất hiện (idempotent — `buildFillPlan` bỏ qua field đã có giá trị), không chỉ báo hiệu như bản cũ. Vẫn cố ý **không tự bấm Next/Submit** theo nguyên tắc "không auto-submit" (mục 1.2) — khác Simplify (Simplify tự lái tới khi nộp xong). |
| Open the panel on job pages (auto-mở khi detect ATS) | 🔴 | Hiện user phải tự bấm nút Autofill trong popup; không có panel tự nổi lên. |
| Applications you submit without autofill (vẫn add vào tracker) | 🔴 | Không có tính năng tracker — ngoài phạm vi DESIGN.md hiện tại. |
| Name of the resume file you upload (tự rename "Tên + resume") | 🟡 | Logic rename đã build và test đầy đủ: `resolveResumeFileName` (`src/filler.js`) + toggle `resumeFileName` ('useMyName'/'original', Settings tab) đã nối vào cả 6 hàm `upload*Resume` của ATS adapters. **Nhưng** bản thân các hàm `upload*Resume` chưa được gọi từ runtime pipeline (`content.js`/`injected.js`) — resume vẫn chưa tự động được đính kèm khi autofill chạy, đây là gap có từ trước, độc lập với tính năng rename. Xem mục nợ kỹ thuật bên dưới. |
| Fill progress view | 🟡 | Popup hiện "✓ Filled N fields (M skipped)" + "(K fields tắt trong Settings)" khi có field bị user tắt qua toggle — không phải live progress theo từng field/step như Simplify, nhưng cùng mục đích. |
| Submission view / Add custom application | 🔴 | Không có modal detect-submission, không có job recommendation, không có custom-application form — thuộc tính năng tracker, ngoài phạm vi hiện tại. |

**Tính năng mới không nằm trong danh sách setting gốc của Simplify nhưng đã build cùng đợt này:**
- **Fields to autofill** (Settings tab): toggle bật/tắt từng field theo `classifyField` key, gom theo 9 nhóm (Personal/Location/Links/Documents/Education/Work History/Work Authorization/EEO/Compensation), có master toggle theo nhóm (on/off/mixed). Field bị tắt được `buildFillPlan` bỏ qua và đếm riêng vào `skippedByUser`.
- **AI Provider settings** (Settings tab): chọn provider (openai/gemini), API key (ẩn/hiện), model — thay cho việc phải set trực tiếp trong storage.

**Nợ kỹ thuật còn tồn đọng:**
1. ~~Bug `_findNearbyText`~~ — đã fix (#47, merged vào `develop`): điều kiện guard đổi thành `if (!labelText)`.
2. **Resume upload chưa nối vào runtime**: các hàm `upload*Resume(doc, file, profile, settings)` (Greenhouse/Lever/Ashby/iCIMS/Workday/SmartRecruiters) và `interceptWorkdayFileInput` chỉ được gọi trực tiếp từ unit test, không có chỗ nào trong `content.js`/`injected.js` gọi chúng khi chạy Autofill thật — nghĩa là toggle `resumeFileName` mới có tác dụng nếu/khi luồng upload này được nối vào pipeline chính. Cần: (a) quyết định resume file lấy từ đâu lúc runtime (`profile.resumeFiles`?), (b) map ATS đang active → đúng hàm `upload*Resume`, (c) gọi trong `runGenericFill`/adapter fill flow tương ứng. Đang lên kế hoạch làm PR riêng (`feature/resume-upload`).
3. Extract keywords + resume match banner — cần đọc DOM trang mô tả job (không phải form), là luồng dữ liệu mới, không tái dùng matcher.js.
4. Auto-open panel khi detect ATS — mở rộng `content.js`, cần quyết định UX (có thể gây khó chịu nếu luôn tự bật).
5. Application tracker (submission view, add custom application) — lớn nhất, gần như 1 sub-feature riêng (cần lưu trữ lịch sử, có thể cần UI mới hoàn toàn) — nên tách thành Phase riêng nếu làm.
6. Toàn bộ `src/ats/*` (adapter riêng cho Greenhouse/Lever/Workday/...) là dead code ở runtime — `injected.js` chỉ gọi `runGenericFill`, không có dispatcher nào gọi `detectATS`/`fillXForm`. `fillGreenhouseForm`'s Phase 1 còn key theo `[data-gh-input]`, thuộc tính không còn tồn tại trên template `job-boards.greenhouse.io` hiện tại — nên mọi field từng fill được trên trang Greenhouse thật đều đến từ generic heuristic, không phải adapter riêng. Không có kế hoạch hồi sinh layer này; đầu tư tiếp vào generic path.
7. Package chưa có build pipeline thật cho tới #49 — `content.js`/`injected.js` dùng ES `import` nhưng khai báo trong `manifest.json` như classic content script (MV3 không hỗ trợ module ở đây), nên trước #49 extension **chưa từng chạy được** khi load unpacked thật.
