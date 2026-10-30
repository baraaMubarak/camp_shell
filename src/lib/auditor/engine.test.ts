import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { auditSheet, enrichSheet, matchPerson, buildIndex, peopleFromRows, reviewReference, suggestColumnLinks, transferSheet } from "./engine.ts";
import { guessMapping } from "./mapping.ts";
import { nameScore, normalizeArabic, normalizeId, normalizePhone, parseDate } from "./normalize.ts";
import { SAMPLE_HEADERS, SAMPLE_REFERENCE, SAMPLE_SHEET } from "./sample.ts";

const mapping = guessMapping(SAMPLE_HEADERS);

describe("normalize", () => {
  it("folds arabic letters and strips noise", () => {
    assert.equal(normalizeArabic("إِبْرَاهِيم أَحْمَد ـ ة"), "ابراهيم احمد ه");
    assert.equal(normalizeArabic("ليلى"), "ليلي");
  });

  it("keeps an id as text, including arabic digits", () => {
    assert.equal(normalizeId("٤٠٢٠٠٠٠٠١"), "402000001");
    assert.equal(normalizeId("402000001.0"), "402000001");
    assert.equal(normalizeId("4.02000001e8"), "402000001");
  });

  it("restores a mobile leading zero", () => {
    assert.equal(normalizePhone("592000001"), "0592000001");
    assert.equal(normalizePhone("+970592000001"), "0592000001");
  });

  it("reads dates and flags hijri", () => {
    assert.equal(parseDate("12/04/1990").iso, "1990-04-12");
    assert.equal(parseDate("1445-02-01").kind, "hijri");
    assert.equal(parseDate("30/13/2020").kind, "invalid");
  });

  it("scores a spelling variant above a different person", () => {
    const close = nameScore(normalizeArabic("سارة عبد الله خليل عمر"), normalizeArabic("سارة عبدالله خليل عمر"));
    const far = nameScore(normalizeArabic("سارة عبد الله خليل عمر"), normalizeArabic("كريم فؤاد نبيل طه"));
    assert.ok(close >= 0.92, `close ${close}`);
    assert.ok(far < 0.8, `far ${far}`);
  });
});

describe("sheets", () => {
  const refs = reviewReference(peopleFromRows(SAMPLE_HEADERS, SAMPLE_REFERENCE, mapping)).kept;
  const sheet = peopleFromRows(SAMPLE_HEADERS, SAMPLE_SHEET, mapping);

  it("guesses the demo headers", () => {
    assert.equal(mapping.idNumber, "رقم الهوية");
    assert.equal(mapping.fullName, "الاسم");
    assert.equal(mapping.wifeName, "اسم الزوجة");
    assert.equal(mapping.phone2, "جوال إضافي");
  });

  it("audits conflict, duplicate, new, and structural rows", () => {
    const rows = auditSheet(sheet, refs);
    const byName = (name: string) => rows.find((row) => row.nameRaw.includes(name));
    assert.equal(byName("كريم")?.worst, "error");
    assert.ok(byName("كريم")?.findings.some((f) => f.code === "id_conflict"));
    assert.equal(rows.filter((row) => row.idNumber === "402000003").every((row) => row.worst === "error"), true);
    assert.ok(byName("مازن")?.findings.some((f) => f.code === "new"));
    assert.ok(rows.find((row) => row.idNumber === "12345")?.findings.some((f) => f.code === "id_length"));
    assert.ok(rows.find((row) => row.idNumber === "12345")?.findings.some((f) => f.code === "date_invalid"));
    assert.ok(byName("عمر خالد")?.findings.some((f) => f.code === "date_hijri"));
  });

  it("enriches only empty cells and keeps probable fills off", () => {
    const rows = enrichSheet(sheet, refs, mapping, mapping);
    const exact = rows.find((row) => row.idNumber === "402000001");
    assert.equal(exact?.status, "exact");
    assert.ok(exact?.fills.some((f) => f.key === "birthDate" && f.on && f.value === "1990-04-12"));
    assert.equal(exact?.fills.some((f) => f.key === "phone"), true);
    const typedPhone = rows.find((row) => row.n === 8);
    assert.equal(typedPhone?.fills.some((f) => f.key === "phone"), false);
    assert.ok(typedPhone?.fills.some((f) => f.key === "birthDate"));
    const ambiguous = rows.find((row) => row.nameRaw === "سعيد محمود ناصر");
    assert.equal(ambiguous?.status, "ambiguous");
    assert.equal(ambiguous?.fills.length, 0);
    assert.ok((ambiguous?.candidates.length ?? 0) >= 2);
  });

  it("matches a normalized full name and a wife-confirmed variant", () => {
    const index = buildIndex(refs);
    const byName = sheet.find((row) => row.nameRaw.startsWith("يوسف"));
    const byWife = sheet.find((row) => row.nameRaw.startsWith("خالد"));
    assert.ok(byName && byWife);
    assert.equal(matchPerson(byName, index).status, "exact");
    assert.equal(matchPerson(byName, index).via, "الاسم الكامل");
    assert.equal(matchPerson(byWife, index).status, "exact");
    assert.equal(matchPerson(byWife, index).via, "الاسم والعائلة والزوجة");
  });

  it("does not enrich a known name when the identity differs", () => {
    const alien = peopleFromRows(SAMPLE_HEADERS, [["999000111", "أحمد محمد علي حسن", "", "", "", ""]], mapping);
    const match = matchPerson(alien[0]!, buildIndex(refs));
    assert.equal(match.status, "new");
    assert.equal(match.ref, null);
    const [row] = enrichSheet(alien, refs, mapping, mapping);
    assert.equal(row?.fills.length, 0);
    assert.match(row?.via ?? "", /402000001/);
  });

  it("flags duplicate ids inside the reference", () => {
    const broken = peopleFromRows(
      SAMPLE_HEADERS,
      [
        ["402000001", "أحمد محمد", "", "", "", ""],
        ["402000001", "أحمد محمد", "", "", "", ""],
        ["", "", "", "", "", ""],
      ],
      mapping,
    );
    const reviewed = reviewReference(broken);
    assert.equal(reviewed.kept.length, 2);
    assert.ok(reviewed.issues.some((issue) => issue.findings.some((f) => f.code === "id_duplicate_reference")));
    assert.ok(reviewed.issues.some((issue) => issue.findings.some((f) => f.code === "empty_row")));
  });

  it("fills empty cells and adds columns without adding extra names", () => {
    const destHeaders = ["رقم الهوية", "الاسم", "الجوال"];
    const sourceHeaders = ["رقم الهوية", "الاسم", "الجوال", "الحي"];
    const destMap = guessMapping(destHeaders);
    const sourceMap = guessMapping(sourceHeaders);
    const dest = peopleFromRows(
      destHeaders,
      [
        ["402000001", "أحمد محمد علي حسن", ""],
        ["402000002", "محمد أحمد سعيد يوسف", "0592000002"],
      ],
      destMap,
    );
    const source = peopleFromRows(
      sourceHeaders,
      [
        ["402000001", "أحمد محمد علي حسن", "0592000001", "الرمال"],
        ["402000002", "محمد أحمد سعيد يوسف", "0599999999", "الشجاعية"],
        ["402000099", "شخص زائد تماما", "0592000099", "التفاح"],
      ],
      sourceMap,
    );
    const links = suggestColumnLinks(destHeaders, sourceHeaders);
    assert.equal(links.find((link) => link.sourceHeader === "الحي")?.action, "add");
    assert.equal(links.find((link) => link.sourceHeader === "الجوال")?.action, "fill");
    const { rows, skippedSource } = transferSheet(dest, source, links);
    assert.equal(rows.length, dest.length);
    assert.equal(skippedSource, 1);
    const first = rows[0]!;
    assert.equal(first.status, "exact");
    assert.ok(first.cells.some((cell) => cell.header === "الجوال" && cell.value === "0592000001" && cell.on));
    assert.ok(first.cells.some((cell) => cell.header === "الحي" && cell.value === "الرمال" && cell.added));
    const second = rows[1]!;
    assert.equal(second.cells.some((cell) => cell.header === "الجوال"), false);
    assert.ok(second.cells.some((cell) => cell.header === "الحي" && cell.value === "الشجاعية"));
    assert.equal(
      rows.some((row) => row.nameRaw.includes("زائد")),
      false,
    );
  });
});
