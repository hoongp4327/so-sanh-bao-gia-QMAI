# So sánh báo giá

Công cụ so sánh báo giá nhà cung cấp (NCC). Chạy **offline** trong trình duyệt, không dùng AI.

Kéo thả báo giá PDF hoặc Excel của 2–8 NCC vào trang. App tự đọc các dòng hàng, ghép những hạng mục giống nhau vào cùng một dòng, đánh dấu giá rẻ nhất, rồi xuất ra file Excel theo mẫu **Price Comparison & Supplier Approval**.

## Dùng ngay

- **Bản web:** mở trang Netlify của dự án.
- **Bản offline:** trên trang web, bấm **⤓ Tải bản offline** để lấy file `So_sanh_bao_gia.html`, sau đó mở file bằng Chrome hoặc Edge. Bản này không cần internet.

Dù dùng bản nào, báo giá cũng chỉ được đọc ngay trong trình duyệt của bạn. File không được tải lên Netlify hay bất kỳ máy chủ nào (xem phần [Bảo mật](#bảo-mật)).

## Deploy lên Netlify

Repo đã có sẵn cấu hình, không cần chỉnh gì trên Netlify:

1. Trên Netlify: **Add new site → Import an existing project → GitHub**, rồi chọn repo này.
2. Netlify tự đọc `netlify.toml`: build command `npm run build`, publish directory `dist`, Node 20.
3. Từ đó, mỗi lần push lên nhánh `main` Netlify sẽ tự build và cập nhật trang.

## Cách dùng

1. Điền **Thông tin chung**: Project, Requester, RFQ...
2. Kéo thả các file báo giá vào trang (PDF hoặc `.xlsx`, tối đa 8 NCC).
3. Kiểm tra bảng so sánh:
   - Ô **xanh** là đơn giá rẻ nhất của dòng.
   - Chữ **đỏ** ở cột SL nghĩa là NCC báo số lượng khác.
   - Thẻ NCC có dấu **✓** nghĩa là tổng app tính được khớp với tổng in trên báo giá; dấu **✗** nghĩa là cần kiểm tra lại các dòng của NCC đó.
   - Mọi ô đều sửa được. Nút **⋮** ở đầu dòng để chuyển dòng lên/xuống, gộp vào dòng trên, chèn hoặc xoá dòng.
4. Bấm **Tạo nhận xét tự động** để có sẵn đoạn Comment / Recommendation, sửa lại nếu cần.
5. Bấm **Xuất Excel**. File xuất ra có sẵn công thức (thành tiền, tổng, VAT, % saving).

Dữ liệu tự lưu trong trình duyệt. Bấm **Làm phiên mới** khi chuyển sang lần so sánh khác.

## Giới hạn

- **PDF scan (dạng ảnh) thì app không đọc được chữ.** Khi đó dùng **+ NCC nhập tay** và gõ đơn giá.
- App đọc theo quy tắc (cột STT, cột tên hạng mục, các con số SL × đơn giá = thành tiền). Gặp mẫu báo giá trình bày lạ, app có thể đọc sót hoặc tách dòng sai, nên luôn xem dấu ✓/✗ ở thẻ NCC.
- Nếu đơn giá trong báo giá **đã gồm VAT**, hãy tích ô "giá đã gồm VAT" ở cột của NCC đó.
- Báo giá không nêu thuế suất VAT thì app tạm tính 8% và hiện cảnh báo.
- App chỉ đọc file `.xlsx`, không đọc được `.xls` đời cũ.

## Bảo mật

App chạy hoàn toàn trong trình duyệt và không có máy chủ xử lý dữ liệu. Các lớp bảo vệ:

| Rủi ro | Biện pháp |
|---|---|
| Dữ liệu báo giá bị gửi ra ngoài | Content Security Policy `connect-src 'none'`, `img-src data: blob:`, `form-action 'none'`: trình duyệt chặn mọi kết nối mạng từ trang (fetch, ảnh, beacon, form). CSP được ghi cả trong thẻ `<meta>` nên **bản offline cũng được bảo vệ**. |
| Script lạ chạy trong trang (XSS) | CSP chỉ cho chạy đúng các script nhúng sẵn, xác định theo SHA-256 hash sinh lúc build. Không cho `eval`, không cho script ngoài. Mọi nội dung đọc từ báo giá đều được escape trước khi hiển thị. |
| PDF độc hại khai thác pdf.js | Dùng pdf.js 6.4.299, đã vá lỗ hổng [GHSA-wgrm-67xf-hhpq](https://github.com/advisories/GHSA-wgrm-67xf-hhpq). Tắt thêm `isEvalSupported`, XFA, font hệ thống, worker fetch. |
| Chèn công thức vào Excel (formula injection) | Mọi chữ đọc từ báo giá được ghi vào Excel dưới dạng chuỗi, không bao giờ thành công thức. Chỉ các công thức do app tạo (thành tiền, tổng, saving) mới là công thức. |
| Nhúng trang vào web khác (clickjacking) | `frame-ancestors 'none'`, `X-Frame-Options: DENY`. |
| File quá lớn làm treo trình duyệt | Bỏ qua file lớn hơn 25 MB. |
| Bị công cụ tìm kiếm lập chỉ mục | `X-Robots-Tag: noindex` và `robots.txt` chặn toàn bộ. |
| Thư viện bị sửa đổi khi build | `npm ci` cài đúng phiên bản và kiểm tra checksum theo `package-lock.json`. |

Các header HTTP (CSP, HSTS, `nosniff`, `Referrer-Policy: no-referrer`, `Permissions-Policy`...) được `build.js` sinh vào `dist/_headers`.

**Còn lại cần biết:**

- **Dữ liệu lưu trên máy:** phiên làm việc được tự lưu trong `localStorage` của trình duyệt, để đóng tab không bị mất. Người khác dùng chung tài khoản máy tính có thể xem được. Bấm **Làm phiên mới** để xoá.
- **`npm audit` còn báo 2 lỗi moderate của `uuid`** ([GHSA-w5hq-g745-h8pq](https://github.com/advisories/GHSA-w5hq-g745-h8pq)). Lỗi chỉ xảy ra với `uuid.v3/v5/v6` khi truyền tham số `buf`. ExcelJS chỉ gọi `uuid.v4()` không có `buf` (`exceljs/lib/xlsx/xform/sheet/cf-ext/cf-rule-ext-xform.js`), nên app không bị ảnh hưởng.
- **Ai sửa được repo GitHub hoặc tài khoản Netlify thì sửa được trang.** Nên bật xác thực 2 lớp (2FA) cho GitHub và Netlify, để repo ở chế độ private, và chỉ cho người cần thiết quyền ghi. Muốn chắc chắn hơn, dùng bản offline đã được IT kiểm tra (đối chiếu mã SHA-256 của file).

## Dành cho người sửa mã nguồn

```
src/template.html   Giao diện + xuất Excel
src/parser.js       Bộ đọc báo giá và ghép dòng giữa các NCC (dùng chung cho trình duyệt và Node)
build.js            Nhúng pdf.js, ExcelJS, parser.js vào template, sinh CSP -> dist/
netlify.toml        Cấu hình build cho Netlify
test/parse-test.js  Chạy thử bộ đọc trên các file PDF: node test/parse-test.js a.pdf b.pdf
```

Đóng gói lại sau khi sửa:

```bash
npm install
npm run build        # tạo dist/index.html, dist/So_sanh_bao_gia.html, dist/_headers
```

Thư viện dùng: [pdf.js](https://github.com/mozilla/pdf.js) 6.4.299 (đọc PDF) và [ExcelJS](https://github.com/exceljs/exceljs) 4.4.0 (đọc/ghi Excel).
