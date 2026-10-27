// Đóng gói thành 1 file HTML chạy offline: nhúng pdf.js, ExcelJS và bộ đọc báo giá vào src/template.html
const fs = require('fs');
const path = require('path');

const read = p => {
  const s = fs.readFileSync(require.resolve(p, { paths: [__dirname] }), 'utf8');
  if (/<\/script/i.test(s)) throw new Error(p + ' chứa "</script", không nhúng inline được');
  return s;
};

let html = fs.readFileSync(path.join(__dirname, 'src/template.html'), 'utf8');
const parts = {
  LIB_PDF: 'pdfjs-dist/build/pdf.min.js',
  LIB_PDF_WORKER: 'pdfjs-dist/build/pdf.worker.min.js',
  LIB_EXCEL: 'exceljs/dist/exceljs.min.js',
  PARSER: './src/parser.js',
};
for (const [key, p] of Object.entries(parts)) {
  const code = read(p);
  html = html.replace(`/*${key}*/`, () => code);
}
const out = path.join(__dirname, 'So_sanh_bao_gia.html');
fs.writeFileSync(out, html);
console.log('Đã tạo', out, Math.round(html.length / 1024) + ' KB');
