const pdfjs=require('pdfjs-dist/legacy/build/pdf.js');
const P=require('../src/parser.js'); const fs=require('fs');
async function load(f){const doc=await pdfjs.getDocument({data:new Uint8Array(fs.readFileSync(f)),disableFontFace:true,verbosity:0}).promise;
 const pages=[];for(let p=1;p<=doc.numPages;p++){const tc=await (await doc.getPage(p)).getTextContent();
 pages.push({items:tc.items.map(i=>({str:i.str,x:i.transform[4],y:i.transform[5],w:i.width,h:i.height}))});}return pages;}
(async()=>{const qs=[];for(const f of process.argv.slice(2)){const q=P.parseQuote(await load(f));qs.push(q);
 console.log('\n####',q.supplier,'|',q.quoteNo,'|',q.quoteDate,'| VAT',q.vatRate,q.vatNote,'| inclVAT',q.pricesIncludeVat);
 console.log(q.terms); console.log(q.warnings); console.log(q.pdfTotals);
 let s=0;q.items.forEach(i=>{s+=i.qty*i.price;console.log(i.stt,i.check?'':'!!',JSON.stringify(i.name),i.unit,i.qty,i.price,i.total,i.vat)});console.log('SUM',s,'n',q.items.length);}
 const rows=P.mergeQuotes(qs);console.log('\nMERGED',rows.length);rows.forEach((r,i)=>console.log(i+1,r.cells.map(c=>c===null?' -':String(c+1).padStart(2)).join(' '),r.name.slice(0,60)));
})();
