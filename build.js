// Đóng gói thành 1 file HTML chạy offline: nhúng pdf.js, ExcelJS và bộ đọc báo giá vào src/template.html.
// Kết quả trong dist/:
//   index.html            trang web (Netlify)
//   So_sanh_bao_gia.html  bản tải về dùng offline (cùng nội dung)
//   _headers              HTTP security headers cho Netlify
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const read = p => {
  const s = fs.readFileSync(require.resolve(p, { paths: [__dirname] }), 'utf8');
  if (/<\/script/i.test(s)) throw new Error(p + ' chứa "</script", không nhúng inline được');
  return s;
};

// pdf.js chỉ phát hành dạng ES module: đổi câu export cuối file thành biến toàn cục để script thường dùng được
function pdfModuleToGlobal(code) {
  const m = code.match(/export\s*\{([^}]*)\};?\s*$/);
  if (!m) throw new Error('Không tìm thấy export trong pdf.min.mjs');
  const props = m[1].split(',').map(s => s.trim()).filter(Boolean).map(s => {
    const [local, , exported] = s.split(/\s+/);
    return exported ? `${exported}:${local}` : local;
  });
  return code.slice(0, m.index) + `globalThis.pdfjsLib={${props.join(',')}};`;
}
// Worker tự gán globalThis.pdfjsWorker -> pdf.js chạy trên luồng chính, không cần file worker riêng
function workerModule(code) {
  return code.replace(/export\s*\{\s*WorkerMessageHandler\s*\};?\s*$/, '');
}

let html = fs.readFileSync(path.join(__dirname, 'src/template.html'), 'utf8');
const parts = {
  LIB_PDF: pdfModuleToGlobal(read('pdfjs-dist/legacy/build/pdf.min.mjs')),
  LIB_PDF_WORKER: workerModule(read('pdfjs-dist/legacy/build/pdf.worker.min.mjs')),
  LIB_EXCEL: read('exceljs/dist/exceljs.min.js'),
  PARSER: read('./src/parser.js'),
};
for (const [key, code] of Object.entries(parts)) {
  if (!html.includes(`/*${key}*/`)) throw new Error('Thiếu chỗ nhúng ' + key);
  html = html.replace(`/*${key}*/`, () => code);
}

// Content Security Policy: chỉ cho chạy đúng các script nhúng sẵn (theo hash), cấm mọi kết nối mạng
const hashes = [...html.matchAll(/<script(?: type="module")?>([\s\S]*?)<\/script>/g)]
  .map(m => `'sha256-${crypto.createHash('sha256').update(m[1], 'utf8').digest('base64')}'`);
const csp = [
  "default-src 'none'",
  `script-src ${hashes.join(' ')}`,
  "style-src 'unsafe-inline'",
  "img-src data: blob:",
  "connect-src 'none'",
  "worker-src 'none'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
];
html = html.replace('<!--CSP-->', `<meta http-equiv="Content-Security-Policy" content="${csp.join('; ')}">`);

const headers = `/*
  Content-Security-Policy: ${[...csp, "frame-ancestors 'none'"].join('; ')}
  X-Frame-Options: DENY
  X-Content-Type-Options: nosniff
  Referrer-Policy: no-referrer
  Strict-Transport-Security: max-age=31536000; includeSubDomains
  Cross-Origin-Opener-Policy: same-origin
  Cross-Origin-Resource-Policy: same-origin
  Permissions-Policy: camera=(), microphone=(), geolocation=(), usb=(), payment=(), clipboard-read=()
  X-Robots-Tag: noindex, nofollow

/So_sanh_bao_gia.html
  Content-Disposition: attachment; filename=So_sanh_bao_gia.html
`;

const dist = path.join(__dirname, 'dist');
fs.rmSync(dist, { recursive: true, force: true });
fs.mkdirSync(dist);
fs.writeFileSync(path.join(dist, 'index.html'), html);
fs.writeFileSync(path.join(dist, 'So_sanh_bao_gia.html'), html);
fs.writeFileSync(path.join(dist, '_headers'), headers);
fs.writeFileSync(path.join(dist, 'robots.txt'), 'User-agent: *\nDisallow: /\n');
console.log('Đã build dist/ (' + Math.round(html.length / 1024) + ' KB, ' + hashes.length + ' script)');
