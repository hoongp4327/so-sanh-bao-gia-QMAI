// Bộ đọc báo giá từ text có toạ độ (pdf.js getTextContent). Không dùng AI: chỉ quy tắc.
// pages: [{ items: [{ str, x, y, w }] }]  (y tăng dần lên trên, như PDF)
(function (root) {
  'use strict';

  const NAME_HEADERS = /^(hạng mục|mã sản phẩm|tên hàng( hóa| hoá)?|tên sản phẩm|tên vật tư|tên thiết bị|hàng hóa|hàng hoá|nội dung|mô tả hàng hóa|description|item|items|product)$/i;
  const STT_HEADERS = /^(stt|tt|no\.?|số tt)$/i;
  const UNITS = /^(cái|chiếc|bộ|gói|pcs|pc|set|lot|m|mét|kg|cuộn|hộp|thùng|tấm|cây|ống|lít|l|tấn|can|bao|chai|đôi|lần|công|ngày|tháng|hệ|hệ thống|hệ thông|trọn gói|ea|unit|cụm|sợi|cặp|m2|m3|md)$/i;
  const STOP_LINE = /(tổng|giá trị hàng hóa|thuế|vat|gtgt|điều kiện|điều khoản|bằng chữ)/i;

  function lowerVN(s) { return (s || '').toLocaleLowerCase('vi'); }

  function parseNumber(raw) {
    let s = (raw || '').replace(/[₫đ]|vnd|VND|\s/g, '');
    if (!s || !/^[-+]?[\d.,]+%?$/.test(s)) return null;
    if (s.endsWith('%')) return null;
    if (/^\d{1,3}([.,]\d{3})+$/.test(s)) return parseInt(s.replace(/[.,]/g, ''), 10);
    if (/^\d{1,3}(,\d{3})+\.\d+$/.test(s)) return parseFloat(s.replace(/,/g, ''));
    if (/^\d{1,3}(\.\d{3})+,\d+$/.test(s)) return parseFloat(s.replace(/\./g, '').replace(',', '.'));
    if (/^\d+[.,]\d{1,2}$/.test(s)) return parseFloat(s.replace(',', '.'));
    if (/^\d+$/.test(s)) return parseInt(s, 10);
    return null;
  }
  function parsePercent(raw) {
    const m = (raw || '').replace(/\s/g, '').match(/^(\d{1,2}(?:[.,]\d+)?)%$/);
    return m ? parseFloat(m[1].replace(',', '.')) : null;
  }

  // Gom item thành dòng theo y
  function toLines(items) {
    const sorted = items.filter(i => i.str && i.str.trim()).slice().sort((a, b) => b.y - a.y || a.x - b.x);
    const lines = [];
    for (const it of sorted) {
      const ln = lines.find(l => Math.abs(l.y - it.y) <= Math.max(2, (it.h || 8) * 0.3));
      if (ln) ln.items.push(it); else lines.push({ y: it.y, items: [it] });
    }
    for (const l of lines) {
      l.items.sort((a, b) => a.x - b.x);
      let t = '';
      l.items.forEach((it, k) => {
        const prev = l.items[k - 1];
        const gap = prev ? it.x - (prev.x + prev.w) : 99;
        t += (prev && gap < Math.max(1, (it.h || 8) * 0.12) && !/\s$/.test(prev.str) ? '' : (prev ? ' ' : '')) + it.str.trim();
      });
      l.text = t.replace(/\s+/g, ' ');
    }
    return lines;
  }

  function findHeader(lines) {
    for (const l of lines) {
      const stt = l.items.find(i => STT_HEADERS.test(i.str.trim()));
      if (!stt) continue;
      const others = l.items.filter(i => i !== stt);
      if (others.length < 3) continue;
      // các tiêu đề có thể nằm lệch y một chút (tiêu đề 2 dòng) -> lấy thêm item gần y
      const near = lines.filter(o => Math.abs(o.y - l.y) <= 12).flatMap(o => o.items);
      const name = near.find(i => NAME_HEADERS.test(i.str.trim()));
      const numericHdr = near.find(i => /(đơn giá|unit price|sl|số lượng|qty)/i.test(i.str));
      if (!name && !numericHdr) continue;
      const cx = i => i.x + i.w / 2;
      let nameRight = Infinity;
      if (name) {
        const right = near.filter(i => i.x > name.x + name.w - 1 && i !== name).sort((a, b) => a.x - b.x)[0];
        if (right) nameRight = (cx(name) + cx(right)) / 2;
      }
      return { y: l.y, sttRight: stt.x + stt.w, nameRight, minY: Math.min(...near.map(i => i.y)) };
    }
    return null;
  }

  function isRoman(s) { return /^(I|II|III|IV|V|VI|VII|VIII|IX|X)\.?$/.test(s.trim()); }

  function parseRowNumbers(line, col) {
    const nums = [];
    let vat = null, unit = '';
    for (const it of line.items) {
      if (it.x + it.w / 2 <= col.nameRight && col.nameRight !== Infinity) continue;
      if (it.x < col.sttRight) continue;
      const parts = it.str.trim().split(/\s{2,}|\s(?=\d)|(?<=\d)\s(?=[^\d])/).filter(Boolean);
      for (const p of parts) {
        const pc = parsePercent(p);
        if (pc !== null) { vat = pc; continue; }
        const n = parseNumber(p);
        if (n !== null) { nums.push({ v: n, x: it.x }); continue; }
        if (!unit && UNITS.test(p.trim())) unit = p.trim();
      }
    }
    return { nums, vat, unit };
  }

  // Từ dãy số tìm (SL, đơn giá, thành tiền)
  function pickQtyPrice(nums) {
    const v = nums.map(n => n.v);
    const near = (a, b) => Math.abs(a - b) <= Math.max(2, Math.abs(b) * 0.005);
    for (let k = v.length - 1; k >= 2; k--) {
      for (let j = k - 1; j >= 1; j--) {
        for (let i = j - 1; i >= 0; i--) {
          if (v[i] > 0 && v[j] > 0 && near(v[i] * v[j], v[k])) return { qty: v[i], price: v[j], total: v[k], ok: true };
        }
      }
    }
    if (v.length >= 2) {
      const t = v[v.length - 1], u = v[v.length - 2];
      // Trường hợp SL dính liền đơn giá: "12,600,000" = "1" + "2,600,000"
      const s = String(u);
      for (let cut = 1; cut <= 3 && cut < s.length; cut++) {
        const q = parseInt(s.slice(0, cut), 10), p = parseInt(s.slice(cut), 10);
        if (q > 0 && p > 0 && near(q * p, t)) return { qty: q, price: p, total: t, ok: true, fixed: true };
      }
      if (u > 0 && t >= u && Number.isInteger(Math.round(t / u * 1000) / 1000)) return { qty: t / u, price: u, total: t, ok: true };
      return { qty: 1, price: u, total: t, ok: false };
    }
    if (v.length === 1) return { qty: 1, price: v[0], total: v[0], ok: false };
    return null;
  }

  function parseQuote(pages) {
    const result = { supplier: '', supplierFull: '', quoteNo: '', quoteDate: '', items: [], terms: {}, vatRate: null, vatNote: '', pdfTotals: [], warnings: [] };
    let col = null;
    const allLines = [];

    pages.forEach((pg, pi) => {
      const lines = toLines(pg.items);
      lines.forEach(l => { l.page = pi; allLines.push(l); });
      const hdr = findHeader(lines);
      if (hdr) {
        col = hdr;
        // Cột mô tả/thông số căn trái thẳng hàng -> chặn biên phải cột tên tại đó
        const body = pg.items.filter(i => i.y < hdr.minY && i.str.trim());
        const freq = new Map();
        body.forEach(i => { const k = Math.round(i.x); freq.set(k, (freq.get(k) || 0) + 1); });
        const cand = [...freq.entries()].filter(([x, c]) => c >= 3 && x > hdr.sttRight - 3).map(([x]) => x).sort((a, b) => a - b);
        const nameLeft = cand[0];
        if (nameLeft !== undefined && hdr.nameRight !== Infinity) {
          const desc = cand.find(x => x > nameLeft + 20 && x < hdr.nameRight + 40);
          if (desc !== undefined) col.nameRight = Math.min(hdr.nameRight, desc - 1);
        }
      }
      if (!col) return;
      const topY = hdr ? hdr.minY : Infinity;

      // các dòng neo (có STT số + có số tiền) và dòng ranh giới (mục La Mã, tổng...)
      const marks = [];
      for (const l of lines) {
        if (l.y >= topY) continue;
        const first = l.items[0];
        const sttItem = l.items.find(i => i.x < col.sttRight + 4 && i.x + i.w <= col.sttRight + 8);
        const sttTxt = sttItem ? sttItem.str.trim() : '';
        if (sttItem && /^\d{1,3}\.?$/.test(sttTxt)) {
          const rn = parseRowNumbers(l, col);
          if (rn.nums.length) { marks.push({ type: 'row', y: l.y, line: l, stt: parseInt(sttTxt, 10), rn }); continue; }
        }
        if ((sttItem && isRoman(sttTxt)) || (first && /^(I|II|III|IV|V|VI)\.\s/.test(first.str)) || STOP_LINE.test(l.text) && !sttItem) {
          marks.push({ type: 'bound', y: l.y, line: l, stop: STOP_LINE.test(l.text) && !(sttItem && isRoman(sttTxt)) });
        }
      }
      marks.sort((a, b) => b.y - a.y);

      const rows = marks.filter(m => m.type === 'row');
      rows.forEach(m => {
        const idx = marks.indexOf(m);
        const prev = marks[idx - 1], next = marks[idx + 1];
        const gapUp = prev ? (prev.type === 'row' ? (prev.y - m.y) / 2 : prev.y - m.y - 1) : (topY - m.y - 1);
        let gapDown = next ? (next.type === 'row' ? (m.y - next.y) / 2 : m.y - next.y - 1) : gapUp;
        if (!next || next.type !== 'row') gapDown = Math.min(gapDown, Math.max(gapUp, 6));
        const upper = m.y + gapUp, lower = m.y - gapDown;
        const nameParts = [];
        m.nameLines = [];
        for (const l of lines) {
          if (l.y > upper || l.y < lower) continue;
          const t = l.items.filter(i => i.x >= col.sttRight - 2 && (i.x + i.w / 2) < col.nameRight
            && (col.nameRight !== Infinity || parseNumber(i.str) === null)).map(i => i.str.trim()).join(' ');
          if (t) { nameParts.push(t); m.nameLines.push({ y: l.y, t }); }
        }
        // dòng nằm trên STT mà bắt đầu bằng chữ thường = phần xuống dòng của hạng mục phía trên
        const prevRow = rows[rows.indexOf(m) - 1];
        if (prevRow && prevRow.item) {
          while (m.nameLines.length && m.nameLines[0].y > m.y + 1 && /^[a-zà-ỹđ]/.test(m.nameLines[0].t)) {
            prevRow.item.name = (prevRow.item.name + ' ' + m.nameLines.shift().t).trim();
            nameParts.shift();
          }
        }
        let name = nameParts.join(' ').replace(/\s+/g, ' ').trim();
        if (col.nameRight === Infinity) name = name.replace(/\s(\S+\s){0,2}[\d.,\s₫%]+$/, '').trim();
        const qp = pickQtyPrice(m.rn.nums);
        if (!qp) return;
        m.item = { stt: m.stt, name, unit: m.rn.unit, qty: qp.qty, price: qp.price, total: qp.total, vat: m.rn.vat, check: qp.ok, page: pi + 1 };
        result.items.push(m.item);
      });
    });

    // Thông tin chung
    const p1 = allLines.filter(l => l.page === 0);
    const company = p1.flatMap(l => l.items).filter(i => /^c[ôo]ng ty/i.test(i.str.trim())).sort((a, b) => b.y - a.y)[0];
    if (company) {
      result.supplierFull = company.str.trim();
      let s = company.str.trim().replace(/^c[ôo]ng ty\s+/i, '').replace(/^(tnhh|cổ phần|cp)\s+/i, '')
        .replace(/^(mtv|một thành viên)\s+/i, '');
      s = lowerVN(s).replace(/(^|\s)\S/g, c => c.toLocaleUpperCase('vi'));
      result.supplier = s;
    }
    const joined = allLines.map(l => l.text);
    const all = joined.join('\n');
    let m = all.match(/(?:số báo giá|số bg|quotation no\.?|inquiry|ref(?:erence)?|số)\s*[:：]?\s*([A-Z0-9][A-Z0-9\-\/._]{3,})/i);
    if (m) result.quoteNo = m[1];
    m = all.match(/(?:ngày(?: báo giá)?|date)\s*[:：]?\s*(\d{1,2}[\/.-]\d{1,2}[\/.-]\d{4})/i);
    if (m) result.quoteDate = m[1];

    const TERM_KEYS = {
      payment: [/thanh toán/i],
      delivery: [/(thời gian|thời hạn) (giao hàng|thi công|thực hiện|giao)/i, /(tiến độ|giao hàng)/i],
      validity: [/(hiệu lực|thời hạn báo giá)/i],
      warranty: [/(bảo hành|bảo hàng)/i],
    };
    const LABEL = /^(điều kiện\s+)?((thời gian|thời hạn)\s+(giao hàng|thi công|thực hiện|bảo hành|bảo hàng|giao)|thanh toán|hiệu lực(\s+báo giá)?|thời hạn báo giá|bảo hành|bảo hàng)\s*[:：]?\s*/i;
    const tablesEnd = joined.findIndex(t => /(điều kiện|điều khoản)/i.test(t));
    const zone = tablesEnd >= 0 ? joined.slice(tablesEnd) : joined;
    for (const [k, res] of Object.entries(TERM_KEYS)) {
      let i = -1;
      for (const re of res) { i = zone.findIndex(t => re.test(t) && t.length < 260 && !/^(stt|tt|lần|đợt)\b/i.test(t) && !/^(các )?điều (kiện|khoản)/i.test(t)); if (i >= 0) break; }
      if (i < 0) continue;
      let t = zone[i];
      let after = t.replace(/^[\dIVX]*[.)\-\s]*/, '');
      if (LABEL.test(after)) after = after.replace(LABEL, '');
      else { const cut = after.search(/[:：]/); if (cut >= 0 && cut < 45) after = after.slice(cut + 1); }
      after = after.trim();
      const extra = [];
      for (let j = i + 1; j < Math.min(zone.length, i + 4); j++) {
        if (/^(lần|đợt|-|\+|•)/i.test(zone[j].trim())) extra.push(zone[j].trim()); else break;
      }
      result.terms[k] = [after, ...extra].filter(Boolean).join('; ');
    }

    // VAT
    const lineVats = result.items.map(i => i.vat).filter(v => v !== null);
    const sumPre = result.items.reduce((s, i) => s + i.qty * i.price, 0);
    for (const t of joined) {
      if (/tổng|giá trị|vat|gtgt|thuế/i.test(t) && !/^\d/.test(t)) {
        const nums = t.split(/\s+/).map(parseNumber).filter(n => n !== null && n >= 1000);
        if (nums.length) result.pdfTotals.push({ label: t.replace(/[\d.,₫%\s]+$/, '').trim().slice(0, 50), value: nums[nums.length - 1] });
      }
    }
    if (lineVats.length) {
      result.vatRate = lineVats[0];
      result.vatNote = 'VAT theo từng dòng trong báo giá';
    } else {
      m = all.match(/(?:vat|gtgt)[^\n\d]{0,12}(\d{1,2})\s*%/i) || all.match(/(\d{1,2})\s*%[^\n]{0,6}(?:vat|gtgt)/i);
      if (m) { result.vatRate = parseFloat(m[1]); result.vatNote = 'VAT ghi trong báo giá'; }
      else {
        const vatLine = result.pdfTotals.find(t => /(vat|gtgt|thuế)/i.test(t.label));
        if (vatLine && sumPre > 0) {
          const r = Math.round(vatLine.value / sumPre * 1000) / 10;
          if ([5, 8, 10].includes(Math.round(r))) { result.vatRate = Math.round(r); result.vatNote = 'VAT suy ra từ dòng thuế trong báo giá'; }
        }
      }
    }
    if (result.vatRate === null) { result.vatRate = 8; result.vatNote = 'Báo giá không nêu thuế suất VAT - tạm tính 8%, cần xác nhận'; result.warnings.push(result.vatNote); }
    result.pricesIncludeVat = /(đơn giá|giá)[^\n]{0,25}(đã )?(bao )?gồm (thuế )?(vat|gtgt)/i.test(all) && !/chưa (bao )?gồm (thuế )?(vat|gtgt)/i.test(all) && !result.pdfTotals.some(t => /(vat|gtgt|thuế)/i.test(t.label));

    if (!result.items.length) result.warnings.push('Không đọc được dòng hàng nào (có thể là PDF scan dạng ảnh). Hãy nhập tay.');
    const bad = result.items.filter(i => !i.check).length;
    if (bad) result.warnings.push(bad + ' dòng có SL × đơn giá không khớp thành tiền - hãy kiểm tra.');
    return result;
  }

  // ---- Ghép dòng giữa các NCC ----
  function norm(s) {
    return lowerVN(s).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd')
      .replace(/[^a-z0-9]+/g, ' ').trim();
  }
  function bigrams(s) { const g = new Map(); for (let i = 0; i < s.length - 1; i++) { const k = s.slice(i, i + 2); g.set(k, (g.get(k) || 0) + 1); } return g; }
  function similarity(a, b) {
    a = norm(a); b = norm(b);
    if (!a || !b) return 0;
    if (a === b) return 1;
    const A = bigrams(a), B = bigrams(b);
    let inter = 0, na = 0, nb = 0;
    A.forEach((c, k) => { na += c; if (B.has(k)) inter += Math.min(c, B.get(k)); });
    B.forEach(c => nb += c);
    let sc = (2 * inter) / (na + nb || 1);
    if (a.startsWith(b) || b.startsWith(a)) sc = Math.max(sc, 0.85);
    return sc;
  }

  // quotes: [{items}] ; trả về rows: [{name, unit, qty, cells: [itemIndex|null per quote]}]
  function mergeQuotes(quotes, threshold) {
    threshold = threshold || 0.55;
    if (!quotes.length) return [];
    let master = 0;
    quotes.forEach((q, i) => { if (q.items.length > quotes[master].items.length) master = i; });
    const rows = quotes[master].items.map((it, k) => {
      const cells = quotes.map(() => null); cells[master] = k;
      return { name: it.name, unit: it.unit, qty: it.qty, cells };
    });
    quotes.forEach((q, qi) => {
      if (qi === master) return;
      const pairs = [];
      q.items.forEach((it, k) => rows.forEach((r, ri) => {
        let s = similarity(it.name, r.name);
        if (s >= threshold) {
          // ưu tiên nhẹ cho thứ tự tương đối giống nhau
          s -= Math.abs(k / Math.max(1, q.items.length) - ri / Math.max(1, rows.length)) * 0.05;
          pairs.push({ k, ri, s });
        }
      }));
      pairs.sort((a, b) => b.s - a.s);
      const usedK = new Set(), usedR = new Set(), assign = new Map();
      for (const p of pairs) {
        if (usedK.has(p.k) || usedR.has(p.ri)) continue;
        usedK.add(p.k); usedR.add(p.ri); assign.set(p.k, p.ri);
      }
      let lastRow = -1;
      q.items.forEach((it, k) => {
        if (assign.has(k)) { const ri = assign.get(k); rows[ri].cells[qi] = k; lastRow = rows.indexOf(rows[ri]); return; }
        const cells = quotes.map(() => null); cells[qi] = k;
        const nr = { name: it.name, unit: it.unit, qty: it.qty, cells };
        rows.splice(lastRow + 1, 0, nr);
        lastRow = lastRow + 1;
      });
    });
    return rows;
  }

  const api = { parseQuote, mergeQuotes, similarity, parseNumber, toLines };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.QuoteParser = api;
})(typeof window !== 'undefined' ? window : globalThis);
