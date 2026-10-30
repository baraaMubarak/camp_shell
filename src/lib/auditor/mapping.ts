import { normalizeArabic } from "./normalize.ts";
import type { FieldKey, Mapping } from "./types.ts";

export const FIELD_LABEL: Record<FieldKey, string> = {
  idNumber: "رقم الهوية",
  fullName: "الاسم",
  firstName: "الاسم الأول",
  fatherName: "اسم الأب",
  grandfatherName: "اسم الجد",
  familyName: "العائلة",
  wifeName: "اسم الزوجة",
  birthDate: "تاريخ الميلاد",
  phone: "الجوال",
  phone2: "جوال إضافي",
  notes: "ملاحظات",
};

export const FIELD_ORDER: FieldKey[] = [
  "idNumber",
  "fullName",
  "firstName",
  "fatherName",
  "grandfatherName",
  "familyName",
  "wifeName",
  "birthDate",
  "phone",
  "phone2",
  "notes",
];

const SYNONYMS: Record<FieldKey, string[]> = {
  idNumber: ["رقم الهوية", "رقم الهويه", "رقم هوية", "الهوية", "الهويه", "national id", "identity", "id"],
  fullName: ["الاسم الكامل", "الاسم الرباعي", "اسم كامل", "الاسم", "اسم"],
  firstName: ["الاسم الاول", "الاسم الأول", "اسم اول", "اسم أول"],
  fatherName: ["اسم الاب", "اسم الأب", "الأب", "الاب"],
  grandfatherName: ["اسم الجد", "الجد"],
  familyName: ["اسم العائلة", "اسم العائله", "العائلة", "العائله", "الشهرة", "اللقب", "الفخذ"],
  wifeName: ["اسم الزوجة", "اسم الزوجه", "الزوجة", "الزوجه", "زوجة"],
  birthDate: ["تاريخ الميلاد", "تاريخ الولادة", "تاريخ الولاده", "الميلاد", "مواليد"],
  phone: ["رقم الجوال", "رقم الهاتف", "الجوال", "الهاتف", "الموبايل", "جوال", "هاتف"],
  phone2: ["جوال اضافي", "جوال إضافي", "جوال ثانوي", "هاتف ثان", "جوال 2", "رقم جوال 2"],
  notes: ["ملاحظات", "ملاحظة", "بيان"],
};

const PREPARED = (Object.entries(SYNONYMS) as [FieldKey, string[]][]).map(([field, syns]) => ({
  field,
  syns: syns.map((s) => normalizeArabic(s)).sort((a, b) => b.length - a.length),
}));

export function guessMapping(headers: string[]): Mapping {
  const mapping: Mapping = {};
  const used = new Set<FieldKey>();
  const ranked = headers.map((header) => ({ header, norm: normalizeArabic(header) }));
  for (const pass of [1, 2] as const) {
    for (const { header, norm } of ranked) {
      if (Object.values(mapping).includes(header)) continue;
      let best: { field: FieldKey; len: number } | null = null;
      for (const { field, syns } of PREPARED) {
        if (used.has(field)) continue;
        for (const syn of syns) {
          const hit = pass === 1 ? norm === syn : syn.length >= 3 && (norm.includes(syn) || syn.includes(norm));
          if (hit && (!best || syn.length > best.len)) best = { field, len: syn.length };
        }
      }
      if (best) {
        mapping[best.field] = header;
        used.add(best.field);
      }
    }
  }
  return mapping;
}

export function mappingError(mapping: Mapping): string | null {
  const hasName = Boolean(mapping.fullName) || Boolean(mapping.firstName && mapping.familyName);
  if (!hasName) return "اربط عمود الاسم، أو الاسم الأول مع العائلة.";
  return null;
}

const PROFILE_KEY = "mudaqqiq.column-profiles.v1";

function profileId(headers: string[]): string {
  return headers.join("\u0001");
}

export function loadProfile(headers: string[]): Mapping | null {
  if (typeof localStorage === "undefined") return null;
  try {
    const all = JSON.parse(localStorage.getItem(PROFILE_KEY) || "{}") as Record<string, Mapping>;
    return all[profileId(headers)] ?? null;
  } catch {
    return null;
  }
}

export function saveProfile(headers: string[], mapping: Mapping) {
  if (typeof localStorage === "undefined") return;
  let all: Record<string, Mapping> = {};
  try {
    all = JSON.parse(localStorage.getItem(PROFILE_KEY) || "{}") as Record<string, Mapping>;
  } catch {
    all = {};
  }
  all[profileId(headers)] = mapping;
  localStorage.setItem(PROFILE_KEY, JSON.stringify(all));
}
