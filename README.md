# So sánh báo giá

Công cụ so sánh báo giá nhà cung cấp (NCC). Chạy **offline** trong trình duyệt, không dùng AI.

Kéo thả báo giá PDF hoặc Excel của 2–8 NCC vào trang. App tự đọc các dòng hàng, ghép những hạng mục giống nhau vào cùng một dòng, đánh dấu giá rẻ nhất, rồi xuất ra file Excel theo mẫu **Price Comparison & Supplier Approval**.

## Dùng ngay

1. Tải file [`So_sanh_bao_gia.html`](So_sanh_bao_gia.html) về máy.
2. Mở bằng Chrome hoặc Edge.

Không cần cài đặt, không cần internet. Mọi thư viện đã được nhúng sẵn trong file, và báo giá chỉ được đọc trên máy của bạn, không gửi đi đâu.

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

## Dành cho người sửa mã nguồn

```
src/template.html   Giao diện + xuất Excel
src/parser.js       Bộ đọc báo giá và ghép dòng giữa các NCC (dùng chung cho trình duyệt và Node)
build.js            Nhúng pdf.js, ExcelJS, parser.js vào template -> So_sanh_bao_gia.html
test/parse-test.js  Chạy thử bộ đọc trên các file PDF: node test/parse-test.js a.pdf b.pdf
```

Đóng gói lại sau khi sửa:

```bash
npm install
npm run build        # tạo lại So_sanh_bao_gia.html
```

Thư viện dùng: [pdf.js](https://github.com/mozilla/pdf.js) 3.11.174 (đọc PDF) và [ExcelJS](https://github.com/exceljs/exceljs) 4.4.0 (đọc/ghi Excel).
