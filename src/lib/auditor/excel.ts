import { LEVEL_LABEL, STATUS_LABEL } from "./engine.ts";
import type { AuditRow, ColumnLink, EnrichRow, Person, TransferRow } from "./types.ts";

type Cell = { t?: string; v?: unknown; w?: string };

function cellToString(cell: Cell | undefined): string {
  if (!cell || cell.v == null || cell.v === "") return "";
  if (cell.t === "s" || cell.t === "str") return String(cell.v).trim();
  if (cell.t === "b") return cell.v ? "نعم" : "لا";
  if (cell.t === "d" && cell.v instanceof Date && !Number.isNaN(cell.v.getTime())) {
    return cell.v.toISOString().slice(0, 10);
  }
  if (cell.t === "n" && typeof cell.v === "number") {
    if (Number.isFinite(cell.v) && Math.abs(cell.v - Math.round(cell.v)) < 1e-6) return String(Math.round(cell.v));
    return String(cell.v);
  }
  return String(cell.w ?? cell.v).trim();
}

export type ParsedSheet = { sheetName: string; headers: string[]; rows: string[][] };

export async function parseWorkbook(data: ArrayBuffer): Promise<ParsedSheet> {
  const XLSX = await import("xlsx");
  const wb = XLSX.read(data, { type: "array", cellDates: true });
  const sheetName = wb.SheetNames[0];
  if (!sheetName) throw new Error("الملف لا يحتوي أوراقاً");
  const sheet = wb.Sheets[sheetName];
  if (!sheet) throw new Error("تعذر قراءة الورقة الأولى");
  const range = XLSX.utils.decode_range(sheet["!ref"] || "A1:A1");
  const matrix: string[][] = [];
  for (let r = range.s.r; r <= range.e.r; r++) {
    const row: string[] = [];
    for (let c = range.s.c; c <= range.e.c; c++) {
      const addr = XLSX.utils.encode_cell({ r, c });
      row.push(cellToString(sheet[addr] as Cell | undefined));
    }
    matrix.push(row);
  }
  if (!matrix.length) throw new Error("الورقة فارغة");
  const seen = new Map<string, number>();
  const headers = (matrix[0] ?? []).map((header, i) => {
    const base = header.trim() || `عمود ${i + 1}`;
    const n = seen.get(base) ?? 0;
    seen.set(base, n + 1);
    return n === 0 ? base : `${base} (${n + 1})`;
  });
  const rows = matrix.slice(1).filter((row) => row.some((cell) => cell.trim() !== ""));
  return {
    sheetName,
    headers,
    rows: rows.map((row) => headers.map((_, i) => row[i] ?? "")),
  };
}

export async function downloadSheets(fileName: string, sheets: { name: string; rows: Record<string, string>[] }[]) {
  const XLSX = await import("xlsx");
  const wb = XLSX.utils.book_new();
  for (const sheet of sheets) {
    const rows = sheet.rows.length ? sheet.rows : [{ ملاحظة: "لا توجد صفوف" }];
    const ws = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, sheet.name.slice(0, 31));
  }
  XLSX.writeFile(wb, fileName);
}

export function auditRecords(rows: AuditRow[]): Record<string, string>[] {
  return rows.map((row) => ({
    الصف: String(row.n),
    "رقم الهوية": row.idNumber,
    الاسم: row.nameRaw,
    المستوى: LEVEL_LABEL[row.worst],
    الملاحظات: row.findings.map((f) => f.message).join("؛ ") || "—",
  }));
}

export function auditSummary(rows: AuditRow[]): Record<string, string>[] {
  const counts = { error: 0, warning: 0, info: 0, ok: 0 };
  for (const row of rows) counts[row.worst] += 1;
  return [
    { البند: "الصفوف", العدد: String(rows.length) },
    { البند: "أخطاء", العدد: String(counts.error) },
    { البند: "تنبيهات", العدد: String(counts.warning) },
    { البند: "ملاحظات", العدد: String(counts.info) },
    { البند: "سليم", العدد: String(counts.ok) },
  ];
}

export function enrichmentRecords(headers: string[], people: Person[], rows: EnrichRow[]): Record<string, string>[] {
  const byN = new Map(people.map((person) => [person.n, person]));
  const extras: string[] = [];
  for (const row of rows) {
    for (const fill of row.fills) {
      if (!fill.on) continue;
      if (!headers.includes(fill.header) && !extras.includes(fill.header)) extras.push(fill.header);
    }
  }
  return rows.map((row) => {
    const person = byN.get(row.n);
    const rec: Record<string, string> = {};
    for (const header of headers) rec[header] = person?.raw[header] ?? "";
    for (const header of extras) if (!(header in rec)) rec[header] = "";
    for (const fill of row.fills) if (fill.on) rec[fill.header] = fill.value;
    rec["حالة المطابقة"] = STATUS_LABEL[row.status];
    rec["طريقة المطابقة"] = row.via;
    rec["الثقة"] = row.score ? `${Math.round(row.score * 100)}%` : "";
    rec["ملاحظات"] = row.findings.map((f) => f.message).join("؛ ");
    return rec;
  });
}

export function referenceRecords(headers: string[], people: Person[]): Record<string, string>[] {
  return people.map((person) => {
    const rec: Record<string, string> = {};
    for (const header of headers) rec[header] = person.raw[header] ?? "";
    return rec;
  });
}

export function transferRecords(
  headers: string[],
  people: Person[],
  rows: TransferRow[],
  links: ColumnLink[],
): Record<string, string>[] {
  const added: string[] = [];
  for (const link of links) {
    if (link.action !== "add") continue;
    const header = link.destHeader.trim() || link.sourceHeader;
    if (!headers.includes(header) && !added.includes(header)) added.push(header);
  }
  const byN = new Map(rows.map((row) => [row.n, row]));
  return people.map((person) => {
    const rec: Record<string, string> = {};
    for (const header of headers) rec[header] = person.raw[header] ?? "";
    for (const header of added) rec[header] = "";
    const row = byN.get(person.n);
    if (row) for (const cell of row.cells) if (cell.on) rec[cell.header] = cell.value;
    return rec;
  });
}

export function transferLog(dest: Person[], source: Person[], rows: TransferRow[]): Record<string, string>[] {
  const byN = new Map(rows.map((row) => [row.n, row]));
  const lines: Record<string, string>[] = dest.map((person) => {
    const row = byN.get(person.n);
    const taken = row?.cells.filter((cell) => cell.on) ?? [];
    return {
      الكشف: "الأول",
      الصف: String(person.n),
      الاسم: person.nameRaw,
      الحالة: row ? STATUS_LABEL[row.status] : "",
      "ما نُقل": taken.map((cell) => `${cell.header}: ${cell.value}`).join("؛ ") || "—",
    };
  });
  const used = new Set(rows.map((row) => row.sourceN).filter((n): n is number => n != null));
  for (const person of source) {
    if (used.has(person.n)) continue;
    lines.push({
      الكشف: "الثاني",
      الصف: String(person.n),
      الاسم: person.nameRaw,
      الحالة: "لم يُضف",
      "ما نُقل": "غير موجود في الكشف الأول، ولم يُنشأ له صف",
    });
  }
  return lines;
}
