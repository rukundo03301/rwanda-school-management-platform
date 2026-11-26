// Dependency-free Excel (.xlsx) and Word (.docx) writers. Both formats are zip packages; this
// writes them uncompressed so no library is needed. Every value is XML-escaped.
const enc = new TextEncoder();
const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
function crc32(b) { let c = 0xffffffff; for (let i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }

export function zipStore(files) {
  const parts = [], central = []; let offset = 0;
  const u16 = (n) => [n & 255, (n >>> 8) & 255], u32 = (n) => [n & 255, (n >>> 8) & 255, (n >>> 16) & 255, (n >>> 24) & 255];
  for (const f of files) {
    const name = enc.encode(f.name), data = typeof f.data === "string" ? enc.encode(f.data) : f.data, crc = crc32(data);
    const head = Uint8Array.from([0x50, 0x4b, 3, 4, ...u16(20), ...u16(0x0800), ...u16(0), ...u16(0), ...u16(0x21), ...u32(crc), ...u32(data.length), ...u32(data.length), ...u16(name.length), ...u16(0)]);
    parts.push(head, name, data);
    central.push(Uint8Array.from([0x50, 0x4b, 1, 2, ...u16(20), ...u16(20), ...u16(0x0800), ...u16(0), ...u16(0), ...u16(0x21), ...u32(crc), ...u32(data.length), ...u32(data.length), ...u16(name.length), ...u16(0), ...u16(0), ...u16(0), ...u16(0), ...u32(0), ...u32(offset)]), name);
    offset += head.length + name.length + data.length;
  }
  const cdSize = central.reduce((a, p) => a + p.length, 0);
  const end = Uint8Array.from([0x50, 0x4b, 5, 6, 0, 0, 0, 0, ...u16(files.length), ...u16(files.length), ...u32(cdSize), ...u32(offset), 0, 0]);
  const all = [...parts, ...central, end], out = new Uint8Array(all.reduce((a, p) => a + p.length, 0)); let o = 0;
  for (const p of all) { out.set(p, o); o += p.length; }
  return out;
}

const esc = (v) => String(v ?? "").replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const colName = (i) => { let s = ""; i++; while (i > 0) { const m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = Math.floor((i - 1) / 26); } return s; };
const XML = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';

// sheets: [{ name, columns:[{header,width,type:"text"|"int"|"pct"}], rows:[[...]], title? }]
export function buildXlsx(sheets) {
  const files = [];
  const names = sheets.map((s, i) => (String(s.name || "Sheet" + (i + 1)).replace(/[\\/?*\[\]:]/g, " ").slice(0, 31) || "Sheet" + (i + 1)));
  files.push({ name: "[Content_Types].xml", data: XML + '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' + sheets.map((_, i) => '<Override PartName="/xl/worksheets/sheet' + (i + 1) + '.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>').join("") + "</Types>" });
  files.push({ name: "_rels/.rels", data: XML + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>' });
  files.push({ name: "xl/workbook.xml", data: XML + '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>' + names.map((n, i) => '<sheet name="' + esc(n) + '" sheetId="' + (i + 1) + '" r:id="rId' + (i + 1) + '"/>').join("") + "</sheets></workbook>" });
  files.push({ name: "xl/_rels/workbook.xml.rels", data: XML + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' + sheets.map((_, i) => '<Relationship Id="rId' + (i + 1) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet' + (i + 1) + '.xml"/>').join("") + '<Relationship Id="rId' + (sheets.length + 1) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>' });
  // styles: 0 normal, 1 header, 2 integer with thousands, 3 percent, 4 bold title
  files.push({ name: "xl/styles.xml", data: XML + '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="3"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font><font><b/><sz val="14"/><name val="Calibri"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF1D4ED8"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="5"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/><xf numFmtId="3" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="9" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>' });
  sheets.forEach((s, i) => {
    const cols = s.columns || [], rows = s.rows || [], lead = s.title ? 2 : 0; const out = [];
    if (s.title) out.push('<row r="1"><c r="A1" s="4" t="inlineStr"><is><t>' + esc(s.title) + "</t></is></c></row>");
    const hr = lead + 1;
    out.push('<row r="' + hr + '">' + cols.map((c, j) => '<c r="' + colName(j) + hr + '" s="1" t="inlineStr"><is><t>' + esc(c.header) + "</t></is></c>").join("") + "</row>");
    rows.forEach((r, k) => {
      const rn = hr + 1 + k;
      out.push('<row r="' + rn + '">' + cols.map((c, j) => {
        const v = r[j], ref = colName(j) + rn;
        if (v === null || v === undefined || v === "") return "";
        if ((c.type === "int" || c.type === "pct") && Number.isFinite(Number(v))) return '<c r="' + ref + '" s="' + (c.type === "int" ? 2 : 3) + '"><v>' + (c.type === "pct" ? Number(v) / 100 : Number(v)) + "</v></c>";
        return '<c r="' + ref + '" t="inlineStr"><is><t xml:space="preserve">' + esc(v) + "</t></is></c>";
      }).join("") + "</row>");
    });
    files.push({ name: "xl/worksheets/sheet" + (i + 1) + ".xml", data: XML + '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"' + (i === 0 ? ' tabSelected="1"' : "") + '><pane ySplit="' + hr + '" topLeftCell="A' + (hr + 1) + '" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols>' + cols.map((c, j) => '<col min="' + (j + 1) + '" max="' + (j + 1) + '" width="' + (c.width || 16) + '" customWidth="1"/>').join("") + "</cols><sheetData>" + out.join("") + "</sheetData></worksheet>" });
  });
  return zipStore(files);
}

// doc: { title, subtitle, sections:[{ heading, paragraphs?:[], table?:{ head:[], rows:[[]] } }] }
export function buildDocx(doc) {
  const run = (t, o = {}) => '<w:r><w:rPr>' + (o.b ? "<w:b/>" : "") + (o.color ? '<w:color w:val="' + o.color + '"/>' : "") + (o.size ? '<w:sz w:val="' + o.size + '"/>' : "") + '</w:rPr><w:t xml:space="preserve">' + esc(t) + "</w:t></w:r>";
  const para = (t, o = {}) => "<w:p><w:pPr>" + (o.style ? '<w:pStyle w:val="' + o.style + '"/>' : "") + '<w:spacing w:after="' + (o.after ?? 120) + '"/></w:pPr>' + run(t, o) + "</w:p>";
  const cell = (t, w, head) => '<w:tc><w:tcPr><w:tcW w:w="' + w + '" w:type="dxa"/>' + (head ? '<w:shd w:val="clear" w:color="auto" w:fill="1D4ED8"/>' : "") + "</w:tcPr>" + para(t, { b: head, color: head ? "FFFFFF" : undefined, size: 18, after: 0 }) + "</w:tc>";
  const table = (t) => {
    const n = t.head.length, w = Math.floor(13600 / n), bd = (k) => "<w:" + k + ' w:val="single" w:sz="4" w:space="0" w:color="BFD0EA"/>';
    return '<w:tbl><w:tblPr><w:tblW w:w="13600" w:type="dxa"/><w:tblBorders>' + ["top", "left", "bottom", "right", "insideH", "insideV"].map(bd).join("") + '</w:tblBorders><w:tblLayout w:type="fixed"/></w:tblPr><w:tblGrid>' + t.head.map(() => '<w:gridCol w:w="' + w + '"/>').join("") + "</w:tblGrid>" +
      "<w:tr><w:trPr><w:tblHeader/></w:trPr>" + t.head.map((h) => cell(h, w, true)).join("") + "</w:tr>" +
      t.rows.map((r) => "<w:tr>" + t.head.map((_, j) => cell(r[j] ?? "", w, false)).join("") + "</w:tr>").join("") + "</w:tbl>" + para("", { after: 200 });
  };
  const body = [para(doc.title, { style: "Title", b: true, size: 40, color: "12306A" })];
  if (doc.subtitle) body.push(para(doc.subtitle, { color: "475F86", size: 22 }));
  for (const s of doc.sections || []) {
    if (s.heading) body.push(para(s.heading, { style: "Heading1", b: true, size: 28, color: "1D4ED8", after: 80 }));
    for (const p of s.paragraphs || []) body.push(para(p));
    if (s.table && s.table.head.length) body.push(table(s.table));
  }
  const W = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"';
  return zipStore([
    { name: "[Content_Types].xml", data: XML + '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/></Types>' },
    { name: "_rels/.rels", data: XML + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>' },
    { name: "word/_rels/document.xml.rels", data: XML + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>' },
    { name: "word/styles.xml", data: XML + "<w:styles " + W + '><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/><w:sz w:val="22"/></w:rPr></w:rPrDefault></w:docDefaults><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style><w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:basedOn w:val="Normal"/></w:style><w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:pPr><w:keepNext/><w:outlineLvl w:val="0"/></w:pPr></w:style></w:styles>' },
    { name: "word/document.xml", data: XML + "<w:document " + W + "><w:body>" + body.join("") + '<w:sectPr><w:pgSz w:w="16838" w:h="11906" w:orient="landscape"/><w:pgMar w:top="1000" w:right="1000" w:bottom="1000" w:left="1000" w:header="500" w:footer="500" w:gutter="0"/></w:sectPr></w:body></w:document>' },
  ]);
}

export function downloadBytes(filename, mime, bytes) {
  const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([bytes], { type: mime })); a.download = filename;
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
export const MIME_XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
export const MIME_DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
