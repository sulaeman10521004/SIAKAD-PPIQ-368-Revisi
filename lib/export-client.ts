import { INSTITUTION_ADDRESS, INSTITUTION_NAME, INSTITUTION_PHONE } from "@/lib/brand";

export type ExportValue = string | number | null | undefined;
export type ExportColumn = { key: string; label: string };
export type ExportRow = Record<string, ExportValue>;

function fileSlug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "laporan";
}

function xml(value: ExportValue): string {
  return String(value ?? "").replace(/[&<>"']/g, (character) => {
    const escaped: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" };
    return escaped[character];
  });
}

function html(value: ExportValue): string {
  return String(value ?? "").replace(/[&<>"']/g, (character) => {
    const escaped: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
    return escaped[character];
  });
}

function download(fileName: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

/** SpreadsheetML 2003 menghasilkan berkas .xls asli yang dapat dibuka Excel tanpa dependensi tambahan. */
export function downloadExcelReport(input: {
  fileName: string;
  title: string;
  meta?: Record<string, ExportValue>;
  columns: ExportColumn[];
  rows: ExportRow[];
}) {
  const metaRows = Object.entries(input.meta ?? {}).map(
    ([label, value]) => `<Row><Cell ss:StyleID="MetaLabel"><Data ss:Type="String">${xml(label)}</Data></Cell><Cell ss:MergeAcross="${Math.max(0, input.columns.length - 2)}"><Data ss:Type="String">${xml(value)}</Data></Cell></Row>`,
  );
  const header = input.columns
    .map((column) => `<Cell ss:StyleID="Header"><Data ss:Type="String">${xml(column.label)}</Data></Cell>`)
    .join("");
  const body = input.rows
    .map(
      (row) =>
        `<Row>${input.columns
          .map((column) => {
            const value = row[column.key];
            const numeric = typeof value === "number";
            return `<Cell><Data ss:Type="${numeric ? "Number" : "String"}">${xml(value)}</Data></Cell>`;
          })
          .join("")}</Row>`,
    )
    .join("");
  const workbook = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
<Styles><Style ss:ID="Default"><Alignment ss:Vertical="Center"/><Font ss:FontName="Arial" ss:Size="10"/></Style><Style ss:ID="Title"><Font ss:Bold="1" ss:Size="14"/></Style><Style ss:ID="MetaLabel"><Font ss:Bold="1"/></Style><Style ss:ID="Header"><Font ss:Bold="1"/><Interior ss:Color="#E8F5EC" ss:Pattern="Solid"/><Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1"/></Borders></Style></Styles>
<Worksheet ss:Name="Laporan"><Table><Row><Cell ss:StyleID="Title" ss:MergeAcross="${Math.max(0, input.columns.length - 1)}"><Data ss:Type="String">${xml(input.title)}</Data></Cell></Row>${metaRows.join("")}<Row/>${header ? `<Row>${header}</Row>` : ""}${body}</Table></Worksheet></Workbook>`;
  download(`${fileSlug(input.fileName)}.xls`, `\uFEFF${workbook}`, "application/vnd.ms-excel;charset=utf-8");
}

/** Membuka lembar cetak rapi. Pengguna dapat memilih Save as PDF pada dialog browser. */
export function printTableReport(input: {
  title: string;
  meta?: Record<string, ExportValue>;
  columns: ExportColumn[];
  rows: ExportRow[];
  orientation?: "portrait" | "landscape";
}) {
  const popup = window.open("", "_blank", "width=1100,height=760");
  if (!popup) {
    window.alert("Jendela cetak diblokir browser. Izinkan pop-up lalu coba lagi.");
    return;
  }
  popup.opener = null;
  const meta = Object.entries(input.meta ?? {})
    .map(([label, value]) => `<div><strong>${html(label)}:</strong> ${html(value)}</div>`)
    .join("");
  const head = input.columns.map((column) => `<th>${html(column.label)}</th>`).join("");
  const body = input.rows
    .map((row) => `<tr>${input.columns.map((column) => `<td>${html(row[column.key])}</td>`).join("")}</tr>`)
    .join("");
  popup.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${html(input.title)}</title><style>
    @page{size:A4 ${input.orientation ?? "landscape"};margin:12mm}*{box-sizing:border-box}body{font-family:Arial,sans-serif;color:#17231d;margin:0;font-size:10px}.kop{display:grid;grid-template-columns:68px 1fr 68px;align-items:center;gap:14px;border-bottom:3px double #17231d;padding-bottom:10px;margin-bottom:16px}.kop img{width:68px;height:68px}.kop div{text-align:center}.kop h1{font-size:17px;text-transform:uppercase;margin:2px 0}.kop p{margin:2px 0}.title{font-size:16px;margin:0 0 8px}.meta{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:4px 20px;margin-bottom:12px}table{width:100%;border-collapse:collapse}th,td{border:1px solid #8b9690;padding:6px;text-align:left;vertical-align:top}th{background:#e8f5ec;font-size:9px;text-transform:uppercase}tr{break-inside:avoid}.footer{margin-top:10px;color:#5d6963;font-size:9px}@media print{button{display:none}}
  </style></head><body><header class="kop"><img src="${window.location.origin}/icons/logo-mark.png" alt="Logo"><div><p>PONDOK PESANTREN</p><h1>${html(INSTITUTION_NAME.replace(/^Pondok Pesantren\s*/i, ""))}</h1><p>${html(INSTITUTION_ADDRESS)}</p><p>Telp. ${html(INSTITUTION_PHONE)}</p></div><span></span></header><h2 class="title">${html(input.title)}</h2><div class="meta">${meta}</div><table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table><div class="footer">Dicetak ${html(new Intl.DateTimeFormat("id-ID", { dateStyle: "long", timeStyle: "short" }).format(new Date()))}</div></body></html>`);
  popup.document.close();
  const openPrintDialog = () => {
    popup.focus();
    popup.print();
  };
  const logo = popup.document.images.item(0);
  if (!logo || logo.complete) window.setTimeout(openPrintDialog, 150);
  else logo.addEventListener("load", openPrintDialog, { once: true });
}
