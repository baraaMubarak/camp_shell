import type { Finding } from "./types.ts";

const DIGITS: Record<string, string> = {};
for (const [i, ch] of [..."٠١٢٣٤٥٦٧٨٩"].entries()) DIGITS[ch] = String(i);
for (const [i, ch] of [..."۰۱۲۳۴۵۶۷۸۹"].entries()) DIGITS[ch] = String(i);

export function toWesternDigits(input: string): string {
  return input.replace(/[٠-٩۰-۹]/g, (ch) => DIGITS[ch] ?? ch);
}

export function normalizeArabic(input: string): string {
  let s = input.normalize("NFKC").toLowerCase();
  s = s.replace(/[\u064B-\u065F\u0670\u06D6-\u06ED\u0640]/g, "");
  s = s.replace(/[إأآٱ]/g, "ا");
  s = s.replace(/ى/g, "ي");
  s = s.replace(/ة/g, "ه");
  s = s.replace(/ؤ/g, "و");
  s = s.replace(/ئ/g, "ي");
  s = s.replace(/[^\u0600-\u06FFa-z0-9\s]/g, " ");
  s = s.replace(/\s+/g, " ").trim();
  return s;
}

const GLUE = new Set(["عبد", "ابو", "ام"]);

export function nameTokens(norm: string): string[] {
  const raw = norm.split(" ").filter(Boolean);
  const out: string[] = [];
  for (let i = 0; i < raw.length; i++) {
    if (GLUE.has(raw[i] ?? "") && raw[i + 1]) {
      out.push(`${raw[i]} ${raw[i + 1]}`);
      i++;
    } else if (raw[i]) out.push(raw[i]);
  }
  return out;
}

export function normalizeId(raw: string): string {
  let s = toWesternDigits(raw.trim()).replace(/,/g, "");
  if (/^\d+(\.\d+)?e\+?\d+$/i.test(s)) {
    const n = Number(s);
    if (Number.isFinite(n)) s = Math.round(n).toString();
  }
  if (/^\d+\.0+$/.test(s)) s = s.slice(0, s.indexOf("."));
  return s.replace(/\D/g, "");
}

export function normalizePhone(raw: string): string {
  let s = toWesternDigits(raw).replace(/\D/g, "");
  if (s.startsWith("00")) s = s.slice(2);
  if ((s.startsWith("970") || s.startsWith("972")) && s.length >= 11) s = `0${s.slice(3)}`;
  if (s.length === 9 && s.startsWith("5")) s = `0${s}`;
  return s;
}

export function inspectPhone(raw: string): { norm: string; finding?: Finding } {
  const trimmed = raw.trim();
  if (!trimmed) return { norm: "" };
  const norm = normalizePhone(trimmed);
  const digits = toWesternDigits(trimmed).replace(/\D/g, "");
  if (/^05\d{8}$/.test(norm)) {
    if (digits.length === 9 && digits.startsWith("5")) {
      return {
        norm,
        finding: {
          severity: "info",
          code: "phone_zero",
          message: `أُعيد الصفر الأول للجوال: ${norm}`,
        },
      };
    }
    return { norm };
  }
  return {
    norm,
    finding: {
      severity: "warning",
      code: "phone_invalid",
      message: "صيغة الجوال غير معتادة (المتوقع 05xxxxxxxx)",
    },
  };
}

export function parseDate(raw: string): { iso: string; kind: "empty" | "ok" | "invalid" | "hijri" } {
  const s = toWesternDigits(raw.trim());
  if (!s) return { iso: "", kind: "empty" };
  if (/^\d{4,6}(\.0+)?$/.test(s)) {
    const n = Math.round(Number(s));
    if (n >= 20000 && n <= 80000) {
      const d = new Date(Date.UTC(1899, 11, 30) + n * 86400000);
      return { iso: d.toISOString().slice(0, 10), kind: "ok" };
    }
  }
  const m = s.match(/^(\d{1,4})[/\-.](\d{1,2})[/\-.](\d{1,4})$/);
  if (!m) return { iso: "", kind: "invalid" };
  const a = Number(m[1]);
  const b = Number(m[2]);
  const c = Number(m[3]);
  const yearFirst = (m[1] ?? "").length === 4;
  const year = yearFirst ? a : c;
  const month = b;
  const day = yearFirst ? c : a;
  if (year >= 1300 && year <= 1500) return { iso: s, kind: "hijri" };
  if (year < 1900 || year > 2100 || month < 1 || month > 12 || day < 1 || day > 31) {
    return { iso: "", kind: "invalid" };
  }
  const iso = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  const check = new Date(`${iso}T00:00:00Z`);
  if (check.getUTCMonth() + 1 !== month || check.getUTCDate() !== day) return { iso: "", kind: "invalid" };
  return { iso, kind: "ok" };
}

export function levenshtein(a: string, b: string, max: number): number {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a.charCodeAt(i - 1) === b.charCodeAt(j - 1) ? 0 : 1;
      const val = Math.min((prev[j] ?? 0) + 1, (cur[j - 1] ?? 0) + 1, (prev[j - 1] ?? 0) + cost);
      cur[j] = val;
      if (val < rowMin) rowMin = val;
    }
    if (rowMin > max) return max + 1;
    prev = cur;
  }
  return prev[b.length] ?? max + 1;
}

export function nameScore(a: string, b: string): number {
  if (!a || !b) return 0;
  if (a === b) return 1;
  const sa = new Set(nameTokens(a));
  const sb = new Set(nameTokens(b));
  let inter = 0;
  for (const token of sa) if (sb.has(token)) inter++;
  const union = sa.size + sb.size - inter;
  const jaccard = union ? inter / union : 0;
  const shorter = sa.size <= sb.size ? sa : sb;
  const longer = sa.size <= sb.size ? sb : sa;
  let contained = 0;
  for (const token of shorter) if (longer.has(token)) contained++;
  const cover = shorter.size ? contained / shorter.size : 0;
  const maxLen = Math.max(a.length, b.length);
  const cap = Math.max(2, Math.ceil(maxLen * 0.45));
  const dist = levenshtein(a, b, cap);
  const lev = dist > cap ? 0 : 1 - dist / maxLen;
  return Math.max(lev, jaccard, shorter.size >= 2 ? cover * 0.92 : 0);
}
