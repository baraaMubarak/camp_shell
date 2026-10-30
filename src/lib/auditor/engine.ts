import { FIELD_LABEL } from "./mapping.ts";
import { inspectPhone, nameScore, nameTokens, normalizeArabic, normalizeId, parseDate } from "./normalize.ts";
import type {
  AuditLevel,
  AuditRow,
  Candidate,
  EnrichRow,
  EnrichStatus,
  FieldKey,
  Fill,
  Finding,
  Mapping,
  Person,
  RowIssue,
  ColumnLink,
  TransferCell,
  TransferRow,
} from "./types.ts";

const SAFE_FIELDS: FieldKey[] = [
  "birthDate",
  "phone",
  "phone2",
  "wifeName",
  "familyName",
  "fatherName",
  "grandfatherName",
  "firstName",
];
const IDENTITY_FIELDS: FieldKey[] = ["idNumber", "fullName"];

export const STATUS_LABEL: Record<EnrichStatus, string> = {
  exact: "قطعي",
  probable: "مرجّح",
  ambiguous: "غامض",
  conflict: "تعارض",
  new: "جديد",
  empty: "فارغ",
};

export const LEVEL_LABEL: Record<AuditLevel, string> = {
  error: "خطأ",
  warning: "تنبيه",
  info: "ملاحظة",
  ok: "سليم",
};

function pick(raw: Record<string, string>, header?: string): string {
  if (!header) return "";
  return raw[header] ?? "";
}

export function personFromRow(n: number, headers: string[], row: string[], mapping: Mapping): Person {
  const raw: Record<string, string> = {};
  headers.forEach((header, i) => {
    raw[header] = (row[i] ?? "").trim();
  });
  const idRaw = pick(raw, mapping.idNumber);
  const idNumber = normalizeId(idRaw);
  let nameRaw = pick(raw, mapping.fullName);
  if (!nameRaw) {
    nameRaw = [mapping.firstName, mapping.fatherName, mapping.grandfatherName, mapping.familyName]
      .map((header) => pick(raw, header))
      .filter(Boolean)
      .join(" ");
  }
  const nameNorm = normalizeArabic(nameRaw);
  const tokens = nameTokens(nameNorm);
  const first = normalizeArabic(pick(raw, mapping.firstName)) || tokens[0] || "";
  const family =
    normalizeArabic(pick(raw, mapping.familyName)) || (tokens.length ? tokens[tokens.length - 1] || "" : "");
  const birthRaw = pick(raw, mapping.birthDate);
  const date = parseDate(birthRaw);
  const phoneRaw = pick(raw, mapping.phone);
  const phone = inspectPhone(phoneRaw);
  const phone2Raw = pick(raw, mapping.phone2);
  const phone2 = inspectPhone(phone2Raw);
  const structural: Finding[] = [];
  if (idRaw && !idNumber) {
    structural.push({ severity: "error", code: "id_invalid", message: "رقم الهوية ليس أرقاماً" });
  } else if (idNumber && idNumber.length !== 9) {
    structural.push({
      severity: "warning",
      code: "id_length",
      message: `طول الهوية ${idNumber.length} أرقام وليس 9`,
    });
  }
  if (date.kind === "invalid") {
    structural.push({ severity: "warning", code: "date_invalid", message: "تعذر قراءة تاريخ الميلاد" });
  } else if (date.kind === "hijri") {
    structural.push({ severity: "warning", code: "date_hijri", message: "التاريخ يبدو هجرياً ولم يُحوَّل" });
  }
  if (phone.finding) structural.push(phone.finding);
  if (phone2.finding) structural.push({ ...phone2.finding, message: phone2.finding.message.replace("الجوال", "الجوال الإضافي") });
  return {
    n,
    idRaw,
    idNumber,
    nameRaw,
    nameNorm,
    tokens,
    first,
    family,
    wifeNorm: normalizeArabic(pick(raw, mapping.wifeName)),
    birthRaw,
    birthIso: date.kind === "ok" ? date.iso : "",
    phoneRaw,
    phoneNorm: phone.norm,
    phone2Raw,
    phone2Norm: phone2.norm,
    raw,
    structural,
  };
}

export function peopleFromRows(headers: string[], rows: string[][], mapping: Mapping): Person[] {
  return rows.map((row, i) => personFromRow(i + 2, headers, row, mapping));
}

export function worst(findings: Finding[]): AuditLevel {
  if (findings.some((f) => f.severity === "error")) return "error";
  if (findings.some((f) => f.severity === "warning")) return "warning";
  if (findings.some((f) => f.severity === "info")) return "info";
  return "ok";
}

export function reviewReference(people: Person[]): { kept: Person[]; issues: RowIssue[] } {
  const buckets = new Map<string, number[]>();
  const kept: Person[] = [];
  const issues: RowIssue[] = [];
  for (const person of people) {
    if (!person.idNumber && !person.nameNorm) {
      issues.push({
        n: person.n,
        idNumber: "",
        nameRaw: "",
        findings: [{ severity: "warning", code: "empty_row", message: "صف فارغ تم تجاهله ولن يُحفظ" }],
      });
      continue;
    }
    kept.push(person);
    if (person.idNumber) {
      const list = buckets.get(person.idNumber) ?? [];
      list.push(person.n);
      buckets.set(person.idNumber, list);
    }
  }
  const dup = new Set<number>();
  for (const rows of buckets.values()) if (rows.length > 1) rows.forEach((n) => dup.add(n));
  for (const person of kept) {
    const findings = [...person.structural];
    if (!person.nameNorm) findings.push({ severity: "error", code: "name_empty", message: "الاسم فارغ" });
    if (!person.idNumber) findings.push({ severity: "warning", code: "id_missing", message: "رقم الهوية فارغ" });
    if (dup.has(person.n)) {
      findings.push({
        severity: "error",
        code: "id_duplicate_reference",
        message: "رقم الهوية مكرر داخل الملف المرجعي",
      });
    }
    if (findings.length) issues.push({ n: person.n, idNumber: person.idNumber, nameRaw: person.nameRaw, findings });
  }
  issues.sort((a, b) => a.n - b.n);
  return { kept, issues };
}

export type RefIndex = {
  byId: Map<string, Person[]>;
  byName: Map<string, Person[]>;
  byFirstFamily: Map<string, Person[]>;
  byFamily: Map<string, Person[]>;
};

function push(map: Map<string, Person[]>, key: string, person: Person) {
  if (!key) return;
  const list = map.get(key);
  if (list) list.push(person);
  else map.set(key, [person]);
}

export function buildIndex(people: Person[]): RefIndex {
  const index: RefIndex = {
    byId: new Map(),
    byName: new Map(),
    byFirstFamily: new Map(),
    byFamily: new Map(),
  };
  for (const person of people) {
    push(index.byId, person.idNumber, person);
    push(index.byName, person.nameNorm, person);
    if (person.family) push(index.byFamily, person.family, person);
    if (person.first && person.family && person.tokens.length >= 2 && person.first !== person.family) {
      push(index.byFirstFamily, `${person.first}|${person.family}`, person);
    }
  }
  return index;
}

type Hit = { person: Person; score: number };

export type MatchResult = {
  status: EnrichStatus;
  via: string;
  score: number;
  ref: Person | null;
  candidates: Hit[];
};

function rank(people: Person[], nameNorm: string): Hit[] {
  return people
    .map((person) => ({ person, score: nameNorm ? nameScore(nameNorm, person.nameNorm) : 0 }))
    .sort((a, b) => b.score - a.score);
}

function wifeAgrees(a: string, b: string): boolean {
  if (!a || !b) return false;
  return a === b || nameScore(a, b) >= 0.9;
}

function asCandidates(hits: Hit[], limit = 4): Candidate[] {
  return hits.slice(0, limit).map((hit) => ({
    n: hit.person.n,
    nameRaw: hit.person.nameRaw,
    idNumber: hit.person.idNumber,
    score: hit.score,
  }));
}

export function matchPerson(person: Person, index: RefIndex): MatchResult {
  if (!person.idNumber && !person.nameNorm) {
    return { status: "empty", via: "", score: 0, ref: null, candidates: [] };
  }
  if (person.idNumber) {
    const hits = index.byId.get(person.idNumber) ?? [];
    if (hits.length) return matchById(person, hits);
    let via = "لا يوجد في المرجع";
    if (person.nameNorm) {
      const same = index.byName.get(person.nameNorm) ?? [];
      const other = same[0];
      if (other) via = `الهوية غير موجودة، والاسم يطابق مرجعاً بهوية ${other.idNumber}`;
    }
    return { status: "new", via, score: 0, ref: null, candidates: [] };
  }
  if (person.nameNorm) return matchByName(person, index);
  return { status: "new", via: "لا يوجد في المرجع", score: 0, ref: null, candidates: [] };
}

function matchById(person: Person, hits: Person[]): MatchResult {
  if (hits.length === 1) {
    const ref = hits[0]!;
    if (!person.nameNorm) return { status: "exact", via: "رقم الهوية", score: 1, ref, candidates: [] };
    const score = nameScore(person.nameNorm, ref.nameNorm);
    if (score >= 0.92) return { status: "exact", via: "رقم الهوية", score, ref, candidates: [] };
    if (score >= 0.8) {
      return { status: "probable", via: "رقم الهوية مع اختلاف في الاسم", score, ref, candidates: [] };
    }
    return { status: "conflict", via: "رقم الهوية", score, ref, candidates: [{ person: ref, score }] };
  }
  const ranked = rank(hits, person.nameNorm);
  const gap = (ranked[0]?.score ?? 0) - (ranked[1]?.score ?? 0);
  if (person.nameNorm && ranked[0] && ranked[0].score >= 0.92 && gap >= 0.08) {
    return {
      status: "probable",
      via: "هوية مكررة في المرجع",
      score: ranked[0].score,
      ref: ranked[0].person,
      candidates: ranked.slice(0, 4),
    };
  }
  return {
    status: "ambiguous",
    via: "الهوية مكررة في المرجع",
    score: ranked[0]?.score ?? 0,
    ref: null,
    candidates: ranked.slice(0, 4),
  };
}

function matchByName(person: Person, index: RefIndex): MatchResult {
  const exact = index.byName.get(person.nameNorm) ?? [];
  if (exact.length === 1) {
    return { status: "exact", via: "الاسم الكامل", score: 1, ref: exact[0]!, candidates: [] };
  }
  if (exact.length > 1) {
    const hits = exact.map((item) => ({ person: item, score: 1 }));
    return { status: "ambiguous", via: "الاسم الكامل يتكرر في المرجع", score: 1, ref: null, candidates: hits.slice(0, 4) };
  }
  if (person.first && person.family && person.tokens.length >= 2 && person.first !== person.family) {
    const bucket = index.byFirstFamily.get(`${person.first}|${person.family}`) ?? [];
    const byWife = person.wifeNorm ? bucket.filter((item) => wifeAgrees(person.wifeNorm, item.wifeNorm)) : [];
    if (byWife.length === 1) {
      const ref = byWife[0]!;
      return {
        status: "exact",
        via: "الاسم والعائلة والزوجة",
        score: Math.max(nameScore(person.nameNorm, ref.nameNorm), 0.97),
        ref,
        candidates: [],
      };
    }
    if (byWife.length > 1) {
      return {
        status: "ambiguous",
        via: "أكثر من شخص بنفس العائلة والزوجة",
        score: 0.9,
        ref: null,
        candidates: byWife.slice(0, 4).map((item) => ({ person: item, score: 0.9 })),
      };
    }
    if (bucket.length === 1) {
      const ref = bucket[0]!;
      return {
        status: "probable",
        via: "الاسم الأول والعائلة",
        score: nameScore(person.nameNorm, ref.nameNorm),
        ref,
        candidates: [],
      };
    }
    if (bucket.length > 1) {
      return {
        status: "ambiguous",
        via: "أكثر من شخص بنفس الاسم والعائلة",
        score: 0.84,
        ref: null,
        candidates: bucket.slice(0, 4).map((item) => ({
          person: item,
          score: nameScore(person.nameNorm, item.nameNorm),
        })),
      };
    }
  }
  if (person.family && person.nameNorm.length >= 6) {
    let family = index.byFamily.get(person.family) ?? [];
    if (family.length > 80) {
      family = family.filter((item) => item.first === person.first || item.nameNorm.includes(person.first));
    }
    const ranked = rank(family.slice(0, 80), person.nameNorm).filter((hit) => hit.score >= 0.84);
    const gap = (ranked[0]?.score ?? 0) - (ranked[1]?.score ?? 0);
    if (ranked[0] && ranked[0].score >= 0.9 && (ranked.length === 1 || gap >= 0.07)) {
      return {
        status: "probable",
        via: "تقارب إملائي داخل العائلة",
        score: ranked[0].score,
        ref: ranked[0].person,
        candidates: ranked.slice(0, 4),
      };
    }
    if (ranked.length) {
      return { status: "ambiguous", via: "مرشحون متقاربون داخل العائلة", score: ranked[0]!.score, ref: null, candidates: ranked.slice(0, 4) };
    }
  }
  return { status: "new", via: "لا يوجد في المرجع", score: 0, ref: null, candidates: [] };
}

function duplicateIds(people: Person[]): Set<string> {
  const counts = new Map<string, number>();
  for (const person of people) {
    if (!person.idNumber) continue;
    counts.set(person.idNumber, (counts.get(person.idNumber) ?? 0) + 1);
  }
  const dups = new Set<string>();
  for (const [id, count] of counts) if (count > 1) dups.add(id);
  return dups;
}

function matchFindings(person: Person, match: MatchResult): Finding[] {
  const findings: Finding[] = [];
  if (match.status === "conflict" && match.ref) {
    findings.push({
      severity: "error",
      code: "id_conflict",
      message: `الهوية نفسها في المرجع باسم «${match.ref.nameRaw}»`,
    });
    return findings;
  }
  if (match.status === "exact" && person.nameNorm && match.ref && match.score < 0.995) {
    findings.push({
      severity: "warning",
      code: "name_spelling",
      message: `الاسم قريب من «${match.ref.nameRaw}» في المرجع`,
    });
  }
  if (match.status === "exact" && !person.idNumber && match.ref) {
    findings.push({
      severity: "info",
      code: "matched_name",
      message: `تطابق الاسم مع الهوية ${match.ref.idNumber}`,
    });
  }
  if (match.status === "probable" && match.ref) {
    findings.push({
      severity: "info",
      code: "probable",
      message: `تطابق مرجّح مع «${match.ref.nameRaw}» عبر ${match.via}`,
    });
  }
  if (match.status === "ambiguous") {
    findings.push({ severity: "warning", code: "ambiguous", message: "أكثر من مرشح في المرجع — لا مطابقة تلقائية" });
  }
  if (match.status === "new") {
    findings.push({ severity: "info", code: "new", message: match.via || "لا أصل مطابق في المرجع" });
  }
  return findings;
}

function rowFindings(person: Person, match: MatchResult, dups: Set<string>): Finding[] {
  const findings = [...person.structural];
  if (!person.nameNorm && !person.idNumber) {
    findings.push({ severity: "warning", code: "empty_row", message: "صف بلا اسم ولا هوية" });
  } else if (!person.nameNorm) {
    findings.push({ severity: "error", code: "name_empty", message: "الاسم فارغ" });
  }
  if (!person.idNumber && person.nameNorm) {
    findings.push({ severity: "warning", code: "id_missing", message: "رقم الهوية فارغ" });
  }
  if (person.idNumber && dups.has(person.idNumber)) {
    findings.push({ severity: "error", code: "id_duplicate_sheet", message: "رقم الهوية مكرر داخل الكشف" });
  }
  findings.push(...matchFindings(person, match));
  return findings;
}

function currentRaw(person: Person, mapping: Mapping, key: FieldKey): string {
  if (key === "fullName") return mapping.fullName ? pick(person.raw, mapping.fullName) : person.nameRaw;
  if (key === "idNumber") return pick(person.raw, mapping.idNumber);
  return pick(person.raw, mapping[key]);
}

function sourceValue(person: Person, mapping: Mapping, key: FieldKey): string {
  switch (key) {
    case "idNumber":
      return person.idNumber;
    case "fullName":
      return person.nameRaw;
    case "birthDate":
      return person.birthIso || pick(person.raw, mapping.birthDate);
    case "phone":
      return /^05\d{8}$/.test(person.phoneNorm) ? person.phoneNorm : pick(person.raw, mapping.phone);
    case "phone2":
      return /^05\d{8}$/.test(person.phone2Norm) ? person.phone2Norm : pick(person.raw, mapping.phone2);
    case "wifeName":
      return pick(person.raw, mapping.wifeName);
    case "familyName":
      return pick(person.raw, mapping.familyName);
    case "firstName":
      return pick(person.raw, mapping.firstName);
    case "fatherName":
      return pick(person.raw, mapping.fatherName);
    case "grandfatherName":
      return pick(person.raw, mapping.grandfatherName);
    default:
      return "";
  }
}

export function proposeFills(
  sheet: Person,
  ref: Person,
  status: EnrichStatus,
  sheetMap: Mapping,
  refMap: Mapping,
): Fill[] {
  if (status !== "exact" && status !== "probable") return [];
  const keys = status === "exact" ? [...SAFE_FIELDS, ...IDENTITY_FIELDS] : SAFE_FIELDS;
  const fills: Fill[] = [];
  for (const key of keys) {
    if (currentRaw(sheet, sheetMap, key).trim()) continue;
    const value = sourceValue(ref, refMap, key).trim();
    if (!value) continue;
    fills.push({
      key,
      label: FIELD_LABEL[key],
      header: sheetMap[key] || FIELD_LABEL[key],
      value,
      on: status === "exact",
    });
  }
  return fills;
}

export function auditSheet(sheet: Person[], refs: Person[]): AuditRow[] {
  const index = buildIndex(refs);
  const dups = duplicateIds(sheet);
  return sheet.map((person) => {
    const match = matchPerson(person, index);
    const findings = rowFindings(person, match, dups);
    return { n: person.n, idNumber: person.idNumber, nameRaw: person.nameRaw, findings, worst: worst(findings) };
  });
}

function toEnrichRow(person: Person, match: MatchResult, dups: Set<string>, sheetMap: Mapping, refMap: Mapping): EnrichRow {
  const fills =
    match.ref && (match.status === "exact" || match.status === "probable")
      ? proposeFills(person, match.ref, match.status, sheetMap, refMap)
      : [];
  return {
    n: person.n,
    idNumber: person.idNumber,
    nameRaw: person.nameRaw,
    status: match.status,
    via: match.via,
    score: match.score,
    refN: match.ref?.n ?? null,
    candidates: match.status === "ambiguous" || match.status === "probable" ? asCandidates(match.candidates) : [],
    fills,
    findings: rowFindings(person, match, dups),
  };
}

export function enrichSheet(sheet: Person[], refs: Person[], sheetMap: Mapping, refMap: Mapping): EnrichRow[] {
  const index = buildIndex(refs);
  const dups = duplicateIds(sheet);
  return sheet.map((person) => toEnrichRow(person, matchPerson(person, index), dups, sheetMap, refMap));
}

export function fillsForChoice(sheet: Person, ref: Person, sheetMap: Mapping, refMap: Mapping): Fill[] {
  return proposeFills(sheet, ref, "exact", sheetMap, refMap).map((fill) => ({ ...fill, on: true }));
}

export function yieldToUi(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

export async function auditSheetAsync(
  sheet: Person[],
  refs: Person[],
  onProgress: (done: number, total: number) => void,
): Promise<AuditRow[]> {
  const index = buildIndex(refs);
  const dups = duplicateIds(sheet);
  const out: AuditRow[] = [];
  const total = sheet.length;
  for (let i = 0; i < total; i++) {
    const person = sheet[i]!;
    const match = matchPerson(person, index);
    const findings = rowFindings(person, match, dups);
    out.push({ n: person.n, idNumber: person.idNumber, nameRaw: person.nameRaw, findings, worst: worst(findings) });
    if (i % 200 === 0) {
      onProgress(i, total);
      await yieldToUi();
    }
  }
  onProgress(total, total);
  return out;
}

export async function enrichSheetAsync(
  sheet: Person[],
  refs: Person[],
  sheetMap: Mapping,
  refMap: Mapping,
  onProgress: (done: number, total: number) => void,
): Promise<EnrichRow[]> {
  const index = buildIndex(refs);
  const dups = duplicateIds(sheet);
  const out: EnrichRow[] = [];
  const total = sheet.length;
  for (let i = 0; i < total; i++) {
    const person = sheet[i]!;
    out.push(toEnrichRow(person, matchPerson(person, index), dups, sheetMap, refMap));
    if (i % 200 === 0) {
      onProgress(i, total);
      await yieldToUi();
    }
  }
  onProgress(total, total);
  return out;
}

export function countLevels(rows: AuditRow[]): Record<AuditLevel, number> {
  const counts: Record<AuditLevel, number> = { error: 0, warning: 0, info: 0, ok: 0 };
  for (const row of rows) counts[row.worst] += 1;
  return counts;
}

export function countStatuses(rows: { status: EnrichStatus }[]): Record<EnrichStatus, number> {
  const counts: Record<EnrichStatus, number> = {
    exact: 0,
    probable: 0,
    ambiguous: 0,
    conflict: 0,
    new: 0,
    empty: 0,
  };
  for (const row of rows) counts[row.status] += 1;
  return counts;
}

function headersAlign(a: string, b: string): boolean {
  const left = normalizeArabic(a);
  const right = normalizeArabic(b);
  if (!left || !right) return false;
  if (left === right) return true;
  const shorter = left.length <= right.length ? left : right;
  const longer = left.length <= right.length ? right : left;
  return shorter.length >= 4 && longer.includes(shorter);
}

export function suggestColumnLinks(destHeaders: string[], sourceHeaders: string[]): ColumnLink[] {
  const used = new Set<string>();
  const destSet = new Set(destHeaders);
  return sourceHeaders.map((sourceHeader) => {
    const aligned = destHeaders.find((header) => !used.has(`fill:${header}`) && headersAlign(header, sourceHeader));
    if (aligned) {
      used.add(`fill:${aligned}`);
      return { sourceHeader, action: "fill", destHeader: aligned };
    }
    let destHeader = sourceHeader;
    if (destSet.has(destHeader) || used.has(`add:${destHeader}`)) destHeader = `${sourceHeader} (مستورد)`;
    used.add(`add:${destHeader}`);
    return { sourceHeader, action: "add", destHeader };
  });
}

function buildCells(dest: Person, source: Person, links: ColumnLink[], on: boolean): TransferCell[] {
  const cells: TransferCell[] = [];
  for (const link of links) {
    if (link.action === "skip") continue;
    const value = (source.raw[link.sourceHeader] ?? "").trim();
    if (!value) continue;
    const header = link.destHeader.trim() || link.sourceHeader;
    if ((dest.raw[header] ?? "").trim()) continue;
    cells.push({ sourceHeader: link.sourceHeader, header, value, on, added: link.action === "add" });
  }
  return cells;
}

function toTransferRow(person: Person, index: RefIndex, links: ColumnLink[]): TransferRow {
  const match = matchPerson(person, index);
  const via = match.via.replaceAll("المرجع", "الكشف الآخر").replaceAll("مرجعاً", "صفاً في الكشف الآخر");
  const cells =
    match.ref && (match.status === "exact" || match.status === "probable")
      ? buildCells(person, match.ref, links, match.status === "exact")
      : [];
  const candidates =
    match.status === "ambiguous" || match.status === "probable"
      ? asCandidates(match.candidates.length ? match.candidates : match.ref ? [{ person: match.ref, score: match.score }] : [])
      : [];
  return {
    n: person.n,
    idNumber: person.idNumber,
    nameRaw: person.nameRaw,
    status: match.status,
    via,
    score: match.score,
    sourceN: match.ref?.n ?? null,
    candidates,
    cells,
  };
}

export function transferSheet(
  dest: Person[],
  source: Person[],
  links: ColumnLink[],
): { rows: TransferRow[]; skippedSource: number } {
  const index = buildIndex(source);
  const rows = dest.map((person) => toTransferRow(person, index, links));
  const used = new Set(rows.map((row) => row.sourceN).filter((n): n is number => n != null));
  return { rows, skippedSource: source.filter((person) => !used.has(person.n)).length };
}

export function cellsForChoice(dest: Person, source: Person, links: ColumnLink[]): TransferCell[] {
  return buildCells(dest, source, links, true);
}

export async function transferSheetAsync(
  dest: Person[],
  source: Person[],
  links: ColumnLink[],
  onProgress: (done: number, total: number) => void,
): Promise<{ rows: TransferRow[]; skippedSource: number }> {
  const index = buildIndex(source);
  const rows: TransferRow[] = [];
  const total = dest.length;
  for (let i = 0; i < total; i++) {
    rows.push(toTransferRow(dest[i]!, index, links));
    if (i % 200 === 0) {
      onProgress(i, total);
      await yieldToUi();
    }
  }
  onProgress(total, total);
  const used = new Set(rows.map((row) => row.sourceN).filter((n): n is number => n != null));
  return { rows, skippedSource: source.filter((person) => !used.has(person.n)).length };
}
