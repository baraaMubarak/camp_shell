import { i as __toESM } from "../_runtime.mjs";
import { G as require_jsx_runtime, K as require_react } from "../_libs/@tanstack/react-router+[...].mjs";
import { a as Lock, i as RefreshCw, n as ShieldCheck, o as FileSpreadsheet, r as Search, s as Download } from "../_libs/lucide-react.mjs";
import { n as clsx, t as cva } from "../_libs/class-variance-authority+clsx.mjs";
import { t as twMerge } from "../_libs/tailwind-merge.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/AuditorApp-CXcOkvX1.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function cn(...inputs) {
	return twMerge(clsx(inputs));
}
var variants = cva("inline-flex items-center justify-center gap-2 rounded-md px-4 text-sm font-medium transition-colors duration-200 disabled:pointer-events-none disabled:opacity-40 min-h-11", {
	variants: {
		variant: {
			primary: "bg-primary text-primary-fg hover:bg-primary/90",
			surface: "border border-border bg-surface text-fg hover:bg-surface-2",
			ghost: "bg-transparent text-fg hover:bg-surface-2",
			danger: "border border-danger/40 bg-transparent text-danger hover:bg-danger/10"
		},
		full: {
			true: "w-full",
			false: ""
		}
	},
	defaultVariants: {
		variant: "surface",
		full: false
	}
});
function Button({ className, variant, full, type = "button", ...props }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
		type,
		className: cn(variants({
			variant,
			full
		}), className),
		...props
	});
}
var DIGITS = {};
for (const [i, ch] of [..."٠١٢٣٤٥٦٧٨٩"].entries()) DIGITS[ch] = String(i);
for (const [i, ch] of [..."۰۱۲۳۴۵۶۷۸۹"].entries()) DIGITS[ch] = String(i);
function toWesternDigits(input) {
	return input.replace(/[٠-٩۰-۹]/g, (ch) => DIGITS[ch] ?? ch);
}
function normalizeArabic(input) {
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
var GLUE = /* @__PURE__ */ new Set([
	"عبد",
	"ابو",
	"ام"
]);
function nameTokens(norm) {
	const raw = norm.split(" ").filter(Boolean);
	const out = [];
	for (let i = 0; i < raw.length; i++) if (GLUE.has(raw[i] ?? "") && raw[i + 1]) {
		out.push(`${raw[i]} ${raw[i + 1]}`);
		i++;
	} else if (raw[i]) out.push(raw[i]);
	return out;
}
function normalizeId(raw) {
	let s = toWesternDigits(raw.trim()).replace(/,/g, "");
	if (/^\d+(\.\d+)?e\+?\d+$/i.test(s)) {
		const n = Number(s);
		if (Number.isFinite(n)) s = Math.round(n).toString();
	}
	if (/^\d+\.0+$/.test(s)) s = s.slice(0, s.indexOf("."));
	return s.replace(/\D/g, "");
}
function normalizePhone(raw) {
	let s = toWesternDigits(raw).replace(/\D/g, "");
	if (s.startsWith("00")) s = s.slice(2);
	if ((s.startsWith("970") || s.startsWith("972")) && s.length >= 11) s = `0${s.slice(3)}`;
	if (s.length === 9 && s.startsWith("5")) s = `0${s}`;
	return s;
}
function inspectPhone(raw) {
	const trimmed = raw.trim();
	if (!trimmed) return { norm: "" };
	const norm = normalizePhone(trimmed);
	const digits = toWesternDigits(trimmed).replace(/\D/g, "");
	if (/^05\d{8}$/.test(norm)) {
		if (digits.length === 9 && digits.startsWith("5")) return {
			norm,
			finding: {
				severity: "info",
				code: "phone_zero",
				message: `أُعيد الصفر الأول للجوال: ${norm}`
			}
		};
		return { norm };
	}
	return {
		norm,
		finding: {
			severity: "warning",
			code: "phone_invalid",
			message: "صيغة الجوال غير معتادة (المتوقع 05xxxxxxxx)"
		}
	};
}
function parseDate(raw) {
	const s = toWesternDigits(raw.trim());
	if (!s) return {
		iso: "",
		kind: "empty"
	};
	if (/^\d{4,6}(\.0+)?$/.test(s)) {
		const n = Math.round(Number(s));
		if (n >= 2e4 && n <= 8e4) return {
			iso: new Date(Date.UTC(1899, 11, 30) + n * 864e5).toISOString().slice(0, 10),
			kind: "ok"
		};
	}
	const m = s.match(/^(\d{1,4})[/\-.](\d{1,2})[/\-.](\d{1,4})$/);
	if (!m) return {
		iso: "",
		kind: "invalid"
	};
	const a = Number(m[1]);
	const b = Number(m[2]);
	const c = Number(m[3]);
	const yearFirst = (m[1] ?? "").length === 4;
	const year = yearFirst ? a : c;
	const month = b;
	const day = yearFirst ? c : a;
	if (year >= 1300 && year <= 1500) return {
		iso: s,
		kind: "hijri"
	};
	if (year < 1900 || year > 2100 || month < 1 || month > 12 || day < 1 || day > 31) return {
		iso: "",
		kind: "invalid"
	};
	const iso = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
	const check = /* @__PURE__ */ new Date(`${iso}T00:00:00Z`);
	if (check.getUTCMonth() + 1 !== month || check.getUTCDate() !== day) return {
		iso: "",
		kind: "invalid"
	};
	return {
		iso,
		kind: "ok"
	};
}
function levenshtein(a, b, max) {
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
function nameScore(a, b) {
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
	const cap = Math.max(2, Math.ceil(maxLen * .45));
	const dist = levenshtein(a, b, cap);
	const lev = dist > cap ? 0 : 1 - dist / maxLen;
	return Math.max(lev, jaccard, shorter.size >= 2 ? cover * .92 : 0);
}
var FIELD_LABEL = {
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
	notes: "ملاحظات"
};
var FIELD_ORDER = [
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
	"notes"
];
var PREPARED = Object.entries({
	idNumber: [
		"رقم الهوية",
		"رقم الهويه",
		"رقم هوية",
		"الهوية",
		"الهويه",
		"national id",
		"identity",
		"id"
	],
	fullName: [
		"الاسم الكامل",
		"الاسم الرباعي",
		"اسم كامل",
		"الاسم",
		"اسم"
	],
	firstName: [
		"الاسم الاول",
		"الاسم الأول",
		"اسم اول",
		"اسم أول"
	],
	fatherName: [
		"اسم الاب",
		"اسم الأب",
		"الأب",
		"الاب"
	],
	grandfatherName: ["اسم الجد", "الجد"],
	familyName: [
		"اسم العائلة",
		"اسم العائله",
		"العائلة",
		"العائله",
		"الشهرة",
		"اللقب",
		"الفخذ"
	],
	wifeName: [
		"اسم الزوجة",
		"اسم الزوجه",
		"الزوجة",
		"الزوجه",
		"زوجة"
	],
	birthDate: [
		"تاريخ الميلاد",
		"تاريخ الولادة",
		"تاريخ الولاده",
		"الميلاد",
		"مواليد"
	],
	phone: [
		"رقم الجوال",
		"رقم الهاتف",
		"الجوال",
		"الهاتف",
		"الموبايل",
		"جوال",
		"هاتف"
	],
	phone2: [
		"جوال اضافي",
		"جوال إضافي",
		"جوال ثانوي",
		"هاتف ثان",
		"جوال 2",
		"رقم جوال 2"
	],
	notes: [
		"ملاحظات",
		"ملاحظة",
		"بيان"
	]
}).map(([field, syns]) => ({
	field,
	syns: syns.map((s) => normalizeArabic(s)).sort((a, b) => b.length - a.length)
}));
function guessMapping(headers) {
	const mapping = {};
	const used = /* @__PURE__ */ new Set();
	const ranked = headers.map((header) => ({
		header,
		norm: normalizeArabic(header)
	}));
	for (const pass of [1, 2]) for (const { header, norm } of ranked) {
		if (Object.values(mapping).includes(header)) continue;
		let best = null;
		for (const { field, syns } of PREPARED) {
			if (used.has(field)) continue;
			for (const syn of syns) if ((pass === 1 ? norm === syn : syn.length >= 3 && (norm.includes(syn) || syn.includes(norm))) && (!best || syn.length > best.len)) best = {
				field,
				len: syn.length
			};
		}
		if (best) {
			mapping[best.field] = header;
			used.add(best.field);
		}
	}
	return mapping;
}
function mappingError(mapping) {
	if (!(Boolean(mapping.fullName) || Boolean(mapping.firstName && mapping.familyName))) return "اربط عمود الاسم، أو الاسم الأول مع العائلة.";
	return null;
}
var PROFILE_KEY = "mudaqqiq.column-profiles.v1";
function profileId(headers) {
	return headers.join("");
}
function loadProfile(headers) {
	if (typeof localStorage === "undefined") return null;
	try {
		return JSON.parse(localStorage.getItem(PROFILE_KEY) || "{}")[profileId(headers)] ?? null;
	} catch {
		return null;
	}
}
function saveProfile(headers, mapping) {
	if (typeof localStorage === "undefined") return;
	let all = {};
	try {
		all = JSON.parse(localStorage.getItem(PROFILE_KEY) || "{}");
	} catch {
		all = {};
	}
	all[profileId(headers)] = mapping;
	localStorage.setItem(PROFILE_KEY, JSON.stringify(all));
}
var SAFE_FIELDS = [
	"birthDate",
	"phone",
	"phone2",
	"wifeName",
	"familyName",
	"fatherName",
	"grandfatherName",
	"firstName"
];
var IDENTITY_FIELDS = ["idNumber", "fullName"];
var STATUS_LABEL = {
	exact: "قطعي",
	probable: "مرجّح",
	ambiguous: "غامض",
	conflict: "تعارض",
	new: "جديد",
	empty: "فارغ"
};
var LEVEL_LABEL = {
	error: "خطأ",
	warning: "تنبيه",
	info: "ملاحظة",
	ok: "سليم"
};
function pick(raw, header) {
	if (!header) return "";
	return raw[header] ?? "";
}
function personFromRow(n, headers, row, mapping) {
	const raw = {};
	headers.forEach((header, i) => {
		raw[header] = (row[i] ?? "").trim();
	});
	const idRaw = pick(raw, mapping.idNumber);
	const idNumber = normalizeId(idRaw);
	let nameRaw = pick(raw, mapping.fullName);
	if (!nameRaw) nameRaw = [
		mapping.firstName,
		mapping.fatherName,
		mapping.grandfatherName,
		mapping.familyName
	].map((header) => pick(raw, header)).filter(Boolean).join(" ");
	const nameNorm = normalizeArabic(nameRaw);
	const tokens = nameTokens(nameNorm);
	const first = normalizeArabic(pick(raw, mapping.firstName)) || tokens[0] || "";
	const family = normalizeArabic(pick(raw, mapping.familyName)) || (tokens.length ? tokens[tokens.length - 1] || "" : "");
	const birthRaw = pick(raw, mapping.birthDate);
	const date = parseDate(birthRaw);
	const phoneRaw = pick(raw, mapping.phone);
	const phone = inspectPhone(phoneRaw);
	const phone2Raw = pick(raw, mapping.phone2);
	const phone2 = inspectPhone(phone2Raw);
	const structural = [];
	if (idRaw && !idNumber) structural.push({
		severity: "error",
		code: "id_invalid",
		message: "رقم الهوية ليس أرقاماً"
	});
	else if (idNumber && idNumber.length !== 9) structural.push({
		severity: "warning",
		code: "id_length",
		message: `طول الهوية ${idNumber.length} أرقام وليس 9`
	});
	if (date.kind === "invalid") structural.push({
		severity: "warning",
		code: "date_invalid",
		message: "تعذر قراءة تاريخ الميلاد"
	});
	else if (date.kind === "hijri") structural.push({
		severity: "warning",
		code: "date_hijri",
		message: "التاريخ يبدو هجرياً ولم يُحوَّل"
	});
	if (phone.finding) structural.push(phone.finding);
	if (phone2.finding) structural.push({
		...phone2.finding,
		message: phone2.finding.message.replace("الجوال", "الجوال الإضافي")
	});
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
		structural
	};
}
function peopleFromRows(headers, rows, mapping) {
	return rows.map((row, i) => personFromRow(i + 2, headers, row, mapping));
}
function worst(findings) {
	if (findings.some((f) => f.severity === "error")) return "error";
	if (findings.some((f) => f.severity === "warning")) return "warning";
	if (findings.some((f) => f.severity === "info")) return "info";
	return "ok";
}
function reviewReference(people) {
	const buckets = /* @__PURE__ */ new Map();
	const kept = [];
	const issues = [];
	for (const person of people) {
		if (!person.idNumber && !person.nameNorm) {
			issues.push({
				n: person.n,
				idNumber: "",
				nameRaw: "",
				findings: [{
					severity: "warning",
					code: "empty_row",
					message: "صف فارغ تم تجاهله ولن يُحفظ"
				}]
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
	const dup = /* @__PURE__ */ new Set();
	for (const rows of buckets.values()) if (rows.length > 1) rows.forEach((n) => dup.add(n));
	for (const person of kept) {
		const findings = [...person.structural];
		if (!person.nameNorm) findings.push({
			severity: "error",
			code: "name_empty",
			message: "الاسم فارغ"
		});
		if (!person.idNumber) findings.push({
			severity: "warning",
			code: "id_missing",
			message: "رقم الهوية فارغ"
		});
		if (dup.has(person.n)) findings.push({
			severity: "error",
			code: "id_duplicate_reference",
			message: "رقم الهوية مكرر داخل الملف المرجعي"
		});
		if (findings.length) issues.push({
			n: person.n,
			idNumber: person.idNumber,
			nameRaw: person.nameRaw,
			findings
		});
	}
	issues.sort((a, b) => a.n - b.n);
	return {
		kept,
		issues
	};
}
function push(map, key, person) {
	if (!key) return;
	const list = map.get(key);
	if (list) list.push(person);
	else map.set(key, [person]);
}
function buildIndex(people) {
	const index = {
		byId: /* @__PURE__ */ new Map(),
		byName: /* @__PURE__ */ new Map(),
		byFirstFamily: /* @__PURE__ */ new Map(),
		byFamily: /* @__PURE__ */ new Map()
	};
	for (const person of people) {
		push(index.byId, person.idNumber, person);
		push(index.byName, person.nameNorm, person);
		if (person.family) push(index.byFamily, person.family, person);
		if (person.first && person.family && person.tokens.length >= 2 && person.first !== person.family) push(index.byFirstFamily, `${person.first}|${person.family}`, person);
	}
	return index;
}
function rank(people, nameNorm) {
	return people.map((person) => ({
		person,
		score: nameNorm ? nameScore(nameNorm, person.nameNorm) : 0
	})).sort((a, b) => b.score - a.score);
}
function wifeAgrees(a, b) {
	if (!a || !b) return false;
	return a === b || nameScore(a, b) >= .9;
}
function asCandidates(hits, limit = 4) {
	return hits.slice(0, limit).map((hit) => ({
		n: hit.person.n,
		nameRaw: hit.person.nameRaw,
		idNumber: hit.person.idNumber,
		score: hit.score
	}));
}
function matchPerson(person, index) {
	if (!person.idNumber && !person.nameNorm) return {
		status: "empty",
		via: "",
		score: 0,
		ref: null,
		candidates: []
	};
	if (person.idNumber) {
		const hits = index.byId.get(person.idNumber) ?? [];
		if (hits.length) return matchById(person, hits);
	}
	if (person.nameNorm) return matchByName(person, index);
	return {
		status: "new",
		via: "لا يوجد في المرجع",
		score: 0,
		ref: null,
		candidates: []
	};
}
function matchById(person, hits) {
	if (hits.length === 1) {
		const ref = hits[0];
		if (!person.nameNorm) return {
			status: "exact",
			via: "رقم الهوية",
			score: 1,
			ref,
			candidates: []
		};
		const score = nameScore(person.nameNorm, ref.nameNorm);
		if (score >= .92) return {
			status: "exact",
			via: "رقم الهوية",
			score,
			ref,
			candidates: []
		};
		if (score >= .8) return {
			status: "probable",
			via: "رقم الهوية مع اختلاف في الاسم",
			score,
			ref,
			candidates: []
		};
		return {
			status: "conflict",
			via: "رقم الهوية",
			score,
			ref,
			candidates: [{
				person: ref,
				score
			}]
		};
	}
	const ranked = rank(hits, person.nameNorm);
	const gap = (ranked[0]?.score ?? 0) - (ranked[1]?.score ?? 0);
	if (person.nameNorm && ranked[0] && ranked[0].score >= .92 && gap >= .08) return {
		status: "probable",
		via: "هوية مكررة في المرجع",
		score: ranked[0].score,
		ref: ranked[0].person,
		candidates: ranked.slice(0, 4)
	};
	return {
		status: "ambiguous",
		via: "الهوية مكررة في المرجع",
		score: ranked[0]?.score ?? 0,
		ref: null,
		candidates: ranked.slice(0, 4)
	};
}
function matchByName(person, index) {
	const exact = index.byName.get(person.nameNorm) ?? [];
	if (exact.length === 1) return {
		status: "exact",
		via: "الاسم الكامل",
		score: 1,
		ref: exact[0],
		candidates: []
	};
	if (exact.length > 1) return {
		status: "ambiguous",
		via: "الاسم الكامل يتكرر في المرجع",
		score: 1,
		ref: null,
		candidates: exact.map((item) => ({
			person: item,
			score: 1
		})).slice(0, 4)
	};
	if (person.first && person.family && person.tokens.length >= 2 && person.first !== person.family) {
		const bucket = index.byFirstFamily.get(`${person.first}|${person.family}`) ?? [];
		const byWife = person.wifeNorm ? bucket.filter((item) => wifeAgrees(person.wifeNorm, item.wifeNorm)) : [];
		if (byWife.length === 1) {
			const ref = byWife[0];
			return {
				status: "exact",
				via: "الاسم والعائلة والزوجة",
				score: Math.max(nameScore(person.nameNorm, ref.nameNorm), .97),
				ref,
				candidates: []
			};
		}
		if (byWife.length > 1) return {
			status: "ambiguous",
			via: "أكثر من شخص بنفس العائلة والزوجة",
			score: .9,
			ref: null,
			candidates: byWife.slice(0, 4).map((item) => ({
				person: item,
				score: .9
			}))
		};
		if (bucket.length === 1) {
			const ref = bucket[0];
			return {
				status: "probable",
				via: "الاسم الأول والعائلة",
				score: nameScore(person.nameNorm, ref.nameNorm),
				ref,
				candidates: []
			};
		}
		if (bucket.length > 1) return {
			status: "ambiguous",
			via: "أكثر من شخص بنفس الاسم والعائلة",
			score: .84,
			ref: null,
			candidates: bucket.slice(0, 4).map((item) => ({
				person: item,
				score: nameScore(person.nameNorm, item.nameNorm)
			}))
		};
	}
	if (person.family && person.nameNorm.length >= 6) {
		let family = index.byFamily.get(person.family) ?? [];
		if (family.length > 80) family = family.filter((item) => item.first === person.first || item.nameNorm.includes(person.first));
		const ranked = rank(family.slice(0, 80), person.nameNorm).filter((hit) => hit.score >= .84);
		const gap = (ranked[0]?.score ?? 0) - (ranked[1]?.score ?? 0);
		if (ranked[0] && ranked[0].score >= .9 && (ranked.length === 1 || gap >= .07)) return {
			status: "probable",
			via: "تقارب إملائي داخل العائلة",
			score: ranked[0].score,
			ref: ranked[0].person,
			candidates: ranked.slice(0, 4)
		};
		if (ranked.length) return {
			status: "ambiguous",
			via: "مرشحون متقاربون داخل العائلة",
			score: ranked[0].score,
			ref: null,
			candidates: ranked.slice(0, 4)
		};
	}
	return {
		status: "new",
		via: "لا يوجد في المرجع",
		score: 0,
		ref: null,
		candidates: []
	};
}
function duplicateIds(people) {
	const counts = /* @__PURE__ */ new Map();
	for (const person of people) {
		if (!person.idNumber) continue;
		counts.set(person.idNumber, (counts.get(person.idNumber) ?? 0) + 1);
	}
	const dups = /* @__PURE__ */ new Set();
	for (const [id, count] of counts) if (count > 1) dups.add(id);
	return dups;
}
function matchFindings(person, match) {
	const findings = [];
	if (match.status === "conflict" && match.ref) {
		findings.push({
			severity: "error",
			code: "id_conflict",
			message: `الهوية نفسها في المرجع باسم «${match.ref.nameRaw}»`
		});
		return findings;
	}
	if (match.status === "exact" && person.nameNorm && match.ref && match.score < .995) findings.push({
		severity: "warning",
		code: "name_spelling",
		message: `الاسم قريب من «${match.ref.nameRaw}» في المرجع`
	});
	if (match.status === "exact" && !person.idNumber && match.ref) findings.push({
		severity: "info",
		code: "matched_name",
		message: `تطابق الاسم مع الهوية ${match.ref.idNumber}`
	});
	if (match.status === "probable" && match.ref) findings.push({
		severity: "info",
		code: "probable",
		message: `تطابق مرجّح مع «${match.ref.nameRaw}» عبر ${match.via}`
	});
	if (match.status === "ambiguous") findings.push({
		severity: "warning",
		code: "ambiguous",
		message: "أكثر من مرشح في المرجع — لا مطابقة تلقائية"
	});
	if (match.status === "new") findings.push({
		severity: "info",
		code: "new",
		message: "لا أصل مطابق في المرجع"
	});
	return findings;
}
function rowFindings(person, match, dups) {
	const findings = [...person.structural];
	if (!person.nameNorm && !person.idNumber) findings.push({
		severity: "warning",
		code: "empty_row",
		message: "صف بلا اسم ولا هوية"
	});
	else if (!person.nameNorm) findings.push({
		severity: "error",
		code: "name_empty",
		message: "الاسم فارغ"
	});
	if (!person.idNumber && person.nameNorm) findings.push({
		severity: "warning",
		code: "id_missing",
		message: "رقم الهوية فارغ"
	});
	if (person.idNumber && dups.has(person.idNumber)) findings.push({
		severity: "error",
		code: "id_duplicate_sheet",
		message: "رقم الهوية مكرر داخل الكشف"
	});
	findings.push(...matchFindings(person, match));
	return findings;
}
function currentRaw(person, mapping, key) {
	if (key === "fullName") return mapping.fullName ? pick(person.raw, mapping.fullName) : person.nameRaw;
	if (key === "idNumber") return pick(person.raw, mapping.idNumber);
	return pick(person.raw, mapping[key]);
}
function sourceValue(person, mapping, key) {
	switch (key) {
		case "idNumber": return person.idNumber;
		case "fullName": return person.nameRaw;
		case "birthDate": return person.birthIso || pick(person.raw, mapping.birthDate);
		case "phone": return /^05\d{8}$/.test(person.phoneNorm) ? person.phoneNorm : pick(person.raw, mapping.phone);
		case "phone2": return /^05\d{8}$/.test(person.phone2Norm) ? person.phone2Norm : pick(person.raw, mapping.phone2);
		case "wifeName": return pick(person.raw, mapping.wifeName);
		case "familyName": return pick(person.raw, mapping.familyName);
		case "firstName": return pick(person.raw, mapping.firstName);
		case "fatherName": return pick(person.raw, mapping.fatherName);
		case "grandfatherName": return pick(person.raw, mapping.grandfatherName);
		default: return "";
	}
}
function proposeFills(sheet, ref, status, sheetMap, refMap) {
	if (status !== "exact" && status !== "probable") return [];
	const keys = status === "exact" ? [...SAFE_FIELDS, ...IDENTITY_FIELDS] : SAFE_FIELDS;
	const fills = [];
	for (const key of keys) {
		if (currentRaw(sheet, sheetMap, key).trim()) continue;
		const value = sourceValue(ref, refMap, key).trim();
		if (!value) continue;
		fills.push({
			key,
			label: FIELD_LABEL[key],
			header: sheetMap[key] || FIELD_LABEL[key],
			value,
			on: status === "exact"
		});
	}
	return fills;
}
function fillsForChoice(sheet, ref, sheetMap, refMap) {
	return proposeFills(sheet, ref, "exact", sheetMap, refMap);
}
function yieldToUi() {
	return new Promise((resolve) => setTimeout(resolve, 0));
}
async function auditSheetAsync(sheet, refs, onProgress) {
	const index = buildIndex(refs);
	const dups = duplicateIds(sheet);
	const out = [];
	const total = sheet.length;
	for (let i = 0; i < total; i++) {
		const person = sheet[i];
		const findings = rowFindings(person, matchPerson(person, index), dups);
		out.push({
			n: person.n,
			idNumber: person.idNumber,
			nameRaw: person.nameRaw,
			findings,
			worst: worst(findings)
		});
		if (i % 200 === 0) {
			onProgress(i, total);
			await yieldToUi();
		}
	}
	onProgress(total, total);
	return out;
}
async function enrichSheetAsync(sheet, refs, sheetMap, refMap, onProgress) {
	const index = buildIndex(refs);
	const dups = duplicateIds(sheet);
	const out = [];
	const total = sheet.length;
	for (let i = 0; i < total; i++) {
		const person = sheet[i];
		const match = matchPerson(person, index);
		const fills = match.ref && (match.status === "exact" || match.status === "probable") ? proposeFills(person, match.ref, match.status, sheetMap, refMap) : [];
		out.push({
			n: person.n,
			idNumber: person.idNumber,
			nameRaw: person.nameRaw,
			status: match.status,
			via: match.via,
			score: match.score,
			refN: match.ref?.n ?? null,
			candidates: asCandidates(match.candidates),
			fills,
			findings: rowFindings(person, match, dups)
		});
		if (i % 200 === 0) {
			onProgress(i, total);
			await yieldToUi();
		}
	}
	onProgress(total, total);
	return out;
}
function countLevels(rows) {
	const counts = {
		error: 0,
		warning: 0,
		info: 0,
		ok: 0
	};
	for (const row of rows) counts[row.worst] += 1;
	return counts;
}
function countStatuses(rows) {
	const counts = {
		exact: 0,
		probable: 0,
		ambiguous: 0,
		conflict: 0,
		new: 0,
		empty: 0
	};
	for (const row of rows) counts[row.status] += 1;
	return counts;
}
function cellToString(cell) {
	if (!cell || cell.v == null || cell.v === "") return "";
	if (cell.t === "s" || cell.t === "str") return String(cell.v).trim();
	if (cell.t === "b") return cell.v ? "نعم" : "لا";
	if (cell.t === "d" && cell.v instanceof Date && !Number.isNaN(cell.v.getTime())) return cell.v.toISOString().slice(0, 10);
	if (cell.t === "n" && typeof cell.v === "number") {
		if (Number.isFinite(cell.v) && Math.abs(cell.v - Math.round(cell.v)) < 1e-6) return String(Math.round(cell.v));
		return String(cell.v);
	}
	return String(cell.w ?? cell.v).trim();
}
async function parseWorkbook(data) {
	const XLSX = await import("../_libs/xlsx.mjs").then((n) => n.t);
	const wb = XLSX.read(data, {
		type: "array",
		cellDates: true
	});
	const sheetName = wb.SheetNames[0];
	if (!sheetName) throw new Error("الملف لا يحتوي أوراقاً");
	const sheet = wb.Sheets[sheetName];
	if (!sheet) throw new Error("تعذر قراءة الورقة الأولى");
	const range = XLSX.utils.decode_range(sheet["!ref"] || "A1:A1");
	const matrix = [];
	for (let r = range.s.r; r <= range.e.r; r++) {
		const row = [];
		for (let c = range.s.c; c <= range.e.c; c++) {
			const addr = XLSX.utils.encode_cell({
				r,
				c
			});
			row.push(cellToString(sheet[addr]));
		}
		matrix.push(row);
	}
	if (!matrix.length) throw new Error("الورقة فارغة");
	const seen = /* @__PURE__ */ new Map();
	const headers = (matrix[0] ?? []).map((header, i) => {
		const base = header.trim() || `عمود ${i + 1}`;
		const n = seen.get(base) ?? 0;
		seen.set(base, n + 1);
		return n === 0 ? base : `${base} (${n + 1})`;
	});
	return {
		sheetName,
		headers,
		rows: matrix.slice(1).filter((row) => row.some((cell) => cell.trim() !== "")).map((row) => headers.map((_, i) => row[i] ?? ""))
	};
}
async function downloadSheets(fileName, sheets) {
	const XLSX = await import("../_libs/xlsx.mjs").then((n) => n.t);
	const wb = XLSX.utils.book_new();
	for (const sheet of sheets) {
		const rows = sheet.rows.length ? sheet.rows : [{ ملاحظة: "لا توجد صفوف" }];
		const ws = XLSX.utils.json_to_sheet(rows);
		XLSX.utils.book_append_sheet(wb, ws, sheet.name.slice(0, 31));
	}
	XLSX.writeFile(wb, fileName);
}
function auditRecords(rows) {
	return rows.map((row) => ({
		الصف: String(row.n),
		"رقم الهوية": row.idNumber,
		الاسم: row.nameRaw,
		المستوى: LEVEL_LABEL[row.worst],
		الملاحظات: row.findings.map((f) => f.message).join("؛ ") || "—"
	}));
}
function auditSummary(rows) {
	const counts = {
		error: 0,
		warning: 0,
		info: 0,
		ok: 0
	};
	for (const row of rows) counts[row.worst] += 1;
	return [
		{
			البند: "الصفوف",
			العدد: String(rows.length)
		},
		{
			البند: "أخطاء",
			العدد: String(counts.error)
		},
		{
			البند: "تنبيهات",
			العدد: String(counts.warning)
		},
		{
			البند: "ملاحظات",
			العدد: String(counts.info)
		},
		{
			البند: "سليم",
			العدد: String(counts.ok)
		}
	];
}
function enrichmentRecords(headers, people, rows) {
	const byN = new Map(people.map((person) => [person.n, person]));
	const extras = [];
	for (const row of rows) for (const fill of row.fills) {
		if (!fill.on) continue;
		if (!headers.includes(fill.header) && !extras.includes(fill.header)) extras.push(fill.header);
	}
	return rows.map((row) => {
		const person = byN.get(row.n);
		const rec = {};
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
function referenceRecords(headers, people) {
	return people.map((person) => {
		const rec = {};
		for (const header of headers) rec[header] = person.raw[header] ?? "";
		return rec;
	});
}
var SAMPLE_HEADERS = [
	"رقم الهوية",
	"الاسم",
	"اسم الزوجة",
	"تاريخ الميلاد",
	"الجوال",
	"جوال إضافي"
];
var SAMPLE_REFERENCE = [
	[
		"402000001",
		"أحمد محمد علي حسن",
		"فاطمة سعيد",
		"1990-04-12",
		"0592000001",
		""
	],
	[
		"402000002",
		"محمد أحمد سعيد يوسف",
		"مريم خالد",
		"1985-01-03",
		"0592000002",
		"0562000010"
	],
	[
		"402000003",
		"سارة عبد الله خليل عمر",
		"",
		"1998-11-20",
		"0562000003",
		""
	],
	[
		"402000004",
		"يوسف إبراهيم محمود ناصر",
		"هدى عمر",
		"1976-06-01",
		"0592000004",
		""
	],
	[
		"402000005",
		"ليلى حسن عبد الرحمن قاسم",
		"",
		"2001-02-14",
		"0592000005",
		""
	],
	[
		"402000006",
		"عمر خالد سعيد حسن",
		"نور محمد",
		"1992-09-09",
		"0592000006",
		""
	],
	[
		"402000007",
		"هدى يوسف إبراهيم ناصر",
		"",
		"1980-03-22",
		"0562000007",
		""
	],
	[
		"402000008",
		"خالد عبد الرحمن علي حسن",
		"سلمى يوسف",
		"1988-12-05",
		"0592000008",
		""
	],
	[
		"402000010",
		"سعيد محمود علي ناصر",
		"آمنة",
		"1994-05-05",
		"0592000011",
		""
	],
	[
		"402000011",
		"سعيد محمود كريم ناصر",
		"رقية",
		"1996-08-08",
		"0592000012",
		""
	]
];
var SAMPLE_SHEET = [
	[
		"402000001",
		"احمد محمد علي حسن",
		"",
		"",
		"",
		""
	],
	[
		"402000002",
		"كريم فؤاد نبيل طه",
		"",
		"1985-01-03",
		"0592000002",
		""
	],
	[
		"402000099",
		"مازن رامي فادي كمال",
		"",
		"",
		"0592111999",
		""
	],
	[
		"",
		"يوسف ابراهيم محمود ناصر",
		"",
		"",
		"",
		""
	],
	[
		"",
		"خالد عبد الرحمان علي حسن",
		"سلمى يوسف",
		"",
		"",
		""
	],
	[
		"",
		"سعيد محمود ناصر",
		"",
		"",
		"",
		""
	],
	[
		"402000003",
		"سارة عبد الله خليل عمر",
		"",
		"",
		"12345",
		""
	],
	[
		"402000003",
		"سارة عبدالله خليل عمر",
		"",
		"",
		"",
		""
	],
	[
		"402000004",
		"",
		"",
		"",
		"",
		""
	],
	[
		"12345",
		"ماجد فؤاد سامي درويش",
		"",
		"30/13/2020",
		"0592000099",
		""
	],
	[
		"402000006",
		"عمر خالد سعيد حسن",
		"",
		"1445-02-01",
		"",
		""
	]
];
var session = {
	parsed: null,
	pendingRef: null,
	sheet: null,
	refs: [],
	refMapping: {}
};
var DB_NAME = "mudaqqiq";
var DB_VERSION = 1;
function openDb() {
	return new Promise((resolve, reject) => {
		const req = indexedDB.open(DB_NAME, DB_VERSION);
		req.onupgradeneeded = () => {
			const db = req.result;
			if (!db.objectStoreNames.contains("records")) db.createObjectStore("records", { keyPath: "n" });
			if (!db.objectStoreNames.contains("meta")) db.createObjectStore("meta", { keyPath: "key" });
		};
		req.onsuccess = () => resolve(req.result);
		req.onerror = () => reject(req.error ?? /* @__PURE__ */ new Error("تعذر فتح التخزين المحلي"));
	});
}
function request(req) {
	return new Promise((resolve, reject) => {
		req.onsuccess = () => resolve(req.result);
		req.onerror = () => reject(req.error ?? /* @__PURE__ */ new Error("فشل التخزين المحلي"));
	});
}
async function loadMeta() {
	const db = await openDb();
	try {
		return await request(db.transaction("meta", "readonly").objectStore("meta").get("reference")) ?? null;
	} finally {
		db.close();
	}
}
async function loadRecords() {
	const db = await openDb();
	try {
		return (await request(db.transaction("records", "readonly").objectStore("records").getAll())).sort((a, b) => a.n - b.n);
	} finally {
		db.close();
	}
}
async function saveReference(input) {
	const db = await openDb();
	try {
		const clearTx = db.transaction(["records", "meta"], "readwrite");
		clearTx.objectStore("records").clear();
		clearTx.objectStore("meta").delete("reference");
		await new Promise((resolve, reject) => {
			clearTx.oncomplete = () => resolve();
			clearTx.onerror = () => reject(clearTx.error);
		});
		const chunk = 400;
		for (let i = 0; i < input.people.length; i += chunk) {
			const tx = db.transaction("records", "readwrite");
			const store = tx.objectStore("records");
			for (const person of input.people.slice(i, i + chunk)) store.put(person);
			await new Promise((resolve, reject) => {
				tx.oncomplete = () => resolve();
				tx.onerror = () => reject(tx.error);
			});
		}
		const meta = {
			key: "reference",
			fileName: input.fileName,
			importedAt: (/* @__PURE__ */ new Date()).toISOString(),
			rowCount: input.people.length,
			issueCount: input.issueCount,
			headers: input.headers,
			mapping: input.mapping
		};
		const metaTx = db.transaction("meta", "readwrite");
		metaTx.objectStore("meta").put(meta);
		await new Promise((resolve, reject) => {
			metaTx.oncomplete = () => resolve();
			metaTx.onerror = () => reject(metaTx.error);
		});
	} finally {
		db.close();
	}
}
var PAGE = 8;
function formatWhen(iso) {
	const date = new Date(iso);
	if (Number.isNaN(date.getTime())) return iso;
	return date.toLocaleString("ar", {
		dateStyle: "medium",
		timeStyle: "short"
	});
}
function tone(level) {
	if (level === "error" || level === "conflict") return "text-danger";
	if (level === "warning" || level === "probable" || level === "ambiguous") return "text-primary";
	if (level === "info" || level === "new" || level === "empty") return "text-muted";
	return "text-fg";
}
function AuditorApp() {
	const fileRef = (0, import_react.useRef)(null);
	const targetRef = (0, import_react.useRef)("reference");
	const [phase, setPhase] = (0, import_react.useState)({ kind: "home" });
	const [meta, setMeta] = (0, import_react.useState)(null);
	const [ready, setReady] = (0, import_react.useState)(false);
	const [error, setError] = (0, import_react.useState)("");
	const [rev, setRev] = (0, import_react.useState)(0);
	const [page, setPage] = (0, import_react.useState)(1);
	const [filter, setFilter] = (0, import_react.useState)("all");
	const [query, setQuery] = (0, import_react.useState)("");
	const [replaceOpen, setReplaceOpen] = (0, import_react.useState)(false);
	const [ackExport, setAckExport] = (0, import_react.useState)(false);
	const bump = () => setRev((n) => n + 1);
	(0, import_react.useEffect)(() => {
		loadMeta().then(setMeta).catch(() => setError("تعذر فتح التخزين المحلي في هذا المتصفح.")).finally(() => setReady(true));
	}, []);
	function openFile(target) {
		setError("");
		targetRef.current = target;
		if (fileRef.current) {
			fileRef.current.value = "";
			fileRef.current.click();
		}
	}
	async function onFile(file) {
		setError("");
		setPhase({
			kind: "work",
			label: "جارٍ قراءة الملف",
			done: 0,
			total: 1
		});
		await yieldToUi();
		try {
			const parsed = await parseWorkbook(await file.arrayBuffer());
			if (!parsed.rows.length) throw new Error("لا توجد صفوف بعد صف العناوين.");
			const saved = loadProfile(parsed.headers);
			session.parsed = {
				fileName: file.name,
				headers: parsed.headers,
				rows: parsed.rows,
				mapping: saved ?? guessMapping(parsed.headers),
				target: targetRef.current,
				restored: Boolean(saved)
			};
			setPage(1);
			setPhase({ kind: "map" });
		} catch (err) {
			setError(err instanceof Error ? err.message : "تعذر قراءة الملف");
			setPhase({ kind: "home" });
		}
	}
	async function confirmMapping() {
		const parsed = session.parsed;
		if (!parsed) return;
		const problem = mappingError(parsed.mapping);
		if (problem) {
			setError(problem);
			return;
		}
		setError("");
		saveProfile(parsed.headers, parsed.mapping);
		setPhase({
			kind: "work",
			label: "جارٍ فحص الصفوف",
			done: 0,
			total: parsed.rows.length
		});
		await yieldToUi();
		const people = peopleFromRows(parsed.headers, parsed.rows, parsed.mapping);
		if (parsed.target === "reference") {
			const reviewed = reviewReference(people);
			session.pendingRef = {
				fileName: parsed.fileName,
				headers: parsed.headers,
				mapping: parsed.mapping,
				people: reviewed.kept,
				issues: reviewed.issues
			};
			setPage(1);
			setPhase({ kind: "ref-review" });
			return;
		}
		session.sheet = {
			fileName: parsed.fileName,
			headers: parsed.headers,
			mapping: parsed.mapping,
			people,
			audit: null,
			enrich: null
		};
		setPhase({ kind: "pick" });
	}
	async function commitReference() {
		const pending = session.pendingRef;
		if (!pending) return;
		setPhase({
			kind: "work",
			label: "جارٍ حفظ المرجع على الجهاز",
			done: 0,
			total: pending.people.length
		});
		await yieldToUi();
		try {
			await saveReference({
				fileName: pending.fileName,
				headers: pending.headers,
				mapping: pending.mapping,
				people: pending.people,
				issueCount: pending.issues.length
			});
			session.pendingRef = null;
			session.refs = [];
			setMeta(await loadMeta());
			setPhase({ kind: "home" });
		} catch (err) {
			setError(err instanceof Error ? err.message : "تعذر الحفظ");
			setPhase({ kind: "ref-review" });
		}
	}
	async function ensureRefs() {
		if (!session.refs.length) session.refs = await loadRecords();
		const current = meta ?? await loadMeta();
		if (current) session.refMapping = current.mapping;
		return session.refs;
	}
	async function runAudit() {
		if (!session.sheet) return;
		setError("");
		try {
			const refs = await ensureRefs();
			if (!refs.length) throw new Error("ارفع الملف المرجعي أولاً.");
			const rows = await auditSheetAsync(session.sheet.people, refs, (done, total) => {
				setPhase({
					kind: "work",
					label: "جارٍ التدقيق",
					done,
					total
				});
			});
			session.sheet.audit = rows;
			setFilter("all");
			setPage(1);
			setPhase({ kind: "audit" });
		} catch (err) {
			setError(err instanceof Error ? err.message : "تعذر التدقيق");
			setPhase({ kind: "pick" });
		}
	}
	async function runEnrich() {
		if (!session.sheet) return;
		setError("");
		try {
			const refs = await ensureRefs();
			if (!refs.length) throw new Error("ارفع الملف المرجعي أولاً.");
			const rows = await enrichSheetAsync(session.sheet.people, refs, session.sheet.mapping, session.refMapping, (done, total) => setPhase({
				kind: "work",
				label: "جارٍ الاستكمال",
				done,
				total
			}));
			session.sheet.enrich = rows;
			setFilter("all");
			setPage(1);
			setPhase({ kind: "enrich" });
		} catch (err) {
			setError(err instanceof Error ? err.message : "تعذر الاستكمال");
			setPhase({ kind: "pick" });
		}
	}
	async function loadDemo() {
		setError("");
		const map = guessMapping(SAMPLE_HEADERS);
		const reviewed = reviewReference(peopleFromRows(SAMPLE_HEADERS, SAMPLE_REFERENCE, map));
		setPhase({
			kind: "work",
			label: "جارٍ تجهيز البيانات التجريبية",
			done: 0,
			total: 1
		});
		await yieldToUi();
		try {
			await saveReference({
				fileName: "مرجع تجريبي.xlsx",
				headers: SAMPLE_HEADERS,
				mapping: map,
				people: reviewed.kept,
				issueCount: reviewed.issues.length
			});
			session.refs = reviewed.kept;
			session.refMapping = map;
			session.sheet = {
				fileName: "كشف تجريبي.xlsx",
				headers: SAMPLE_HEADERS,
				mapping: map,
				people: peopleFromRows(SAMPLE_HEADERS, SAMPLE_SHEET, map),
				audit: null,
				enrich: null
			};
			setMeta(await loadMeta());
			setPhase({ kind: "pick" });
		} catch (err) {
			setError(err instanceof Error ? err.message : "تعذر تجهيز التجربة");
			setPhase({ kind: "home" });
		}
	}
	async function exportReference() {
		const current = meta ?? await loadMeta();
		if (!current) return;
		const people = session.refs.length ? session.refs : await loadRecords();
		session.refs = people;
		await downloadSheets("المرجع.xlsx", [{
			name: "المرجع",
			rows: referenceRecords(current.headers, people)
		}]);
		setAckExport(true);
	}
	async function exportAudit() {
		const rows = session.sheet?.audit;
		if (!rows) return;
		await downloadSheets(`تدقيق-${session.sheet?.fileName || "كشف"}.xlsx`, [{
			name: "التدقيق",
			rows: auditRecords(rows)
		}, {
			name: "ملخص",
			rows: auditSummary(rows)
		}]);
	}
	async function exportEnrich() {
		const job = session.sheet;
		if (!job?.enrich) return;
		await downloadSheets(`استكمال-${job.fileName}.xlsx`, [{
			name: "النتائج",
			rows: enrichmentRecords(job.headers, job.people, job.enrich)
		}]);
	}
	async function downloadSample(kind) {
		const rows = (kind === "reference" ? SAMPLE_REFERENCE : SAMPLE_SHEET).map((row) => Object.fromEntries(SAMPLE_HEADERS.map((header, i) => [header, row[i] ?? ""])));
		await downloadSheets(kind === "reference" ? "مرجع-تجريبي.xlsx" : "كشف-تجريبي.xlsx", [{
			name: "البيانات",
			rows
		}]);
	}
	async function openBrowse() {
		setError("");
		setPhase({
			kind: "work",
			label: "جارٍ فتح المرجع",
			done: 0,
			total: 1
		});
		try {
			session.refs = await loadRecords();
			setQuery("");
			setPage(1);
			setPhase({ kind: "browse" });
		} catch (err) {
			setError(err instanceof Error ? err.message : "تعذر قراءة المرجع");
			setPhase({ kind: "home" });
		}
	}
	function setMapped(field, header) {
		const parsed = session.parsed;
		if (!parsed) return;
		const mapping = { ...parsed.mapping };
		for (const key of FIELD_ORDER) if (key !== field && mapping[key] === header) delete mapping[key];
		if (!header) delete mapping[field];
		else mapping[field] = header;
		parsed.mapping = mapping;
		setError("");
		bump();
	}
	function chooseCandidate(row, refN) {
		const job = session.sheet;
		const sheetPerson = job?.people.find((person) => person.n === row.n);
		const ref = session.refs.find((person) => person.n === refN);
		if (!job || !sheetPerson || !ref) return;
		row.refN = ref.n;
		row.via = "اختيار يدوي";
		row.score = row.candidates.find((candidate) => candidate.n === refN)?.score ?? row.score;
		row.fills = fillsForChoice(sheetPerson, ref, job.mapping, session.refMapping);
		bump();
	}
	function toggleFill(row, key) {
		const fill = row.fills.find((item) => item.key === key);
		if (!fill) return;
		fill.on = !fill.on;
		bump();
	}
	function setProbable(on) {
		for (const row of session.sheet?.enrich ?? []) {
			if (row.status !== "probable") continue;
			for (const fill of row.fills) fill.on = on;
		}
		bump();
	}
	const auditRows = session.sheet?.audit ?? [];
	const enrichRows = session.sheet?.enrich ?? [];
	const visibleAudit = (0, import_react.useMemo)(() => {
		if (filter === "all") return auditRows;
		return auditRows.filter((row) => row.worst === filter);
	}, [
		auditRows,
		filter,
		rev
	]);
	const visibleEnrich = (0, import_react.useMemo)(() => {
		if (filter === "all") return enrichRows;
		return enrichRows.filter((row) => row.status === filter);
	}, [
		enrichRows,
		filter,
		rev
	]);
	const browsed = (0, import_react.useMemo)(() => {
		const q = query.trim();
		const norm = q.replace(/\s+/g, "");
		return session.refs.filter((person) => {
			if (!q) return true;
			return person.idNumber.includes(norm) || person.nameRaw.includes(q) || person.nameNorm.includes(q);
		});
	}, [
		query,
		rev,
		phase.kind
	]);
	const title = phase.kind === "map" ? "ربط الأعمدة" : phase.kind === "ref-review" ? "فحص المرجع" : phase.kind === "pick" ? "مهمة الكشف" : phase.kind === "audit" ? "تقرير التدقيق" : phase.kind === "enrich" ? "استكمال النواقص" : phase.kind === "browse" ? "المرجع" : phase.kind === "work" ? "المعالجة" : "المدقّق";
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "min-h-dvh bg-bg text-fg",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("header", {
				className: "sticky top-0 z-20 border-b border-border bg-bg/95 backdrop-blur",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "mx-auto flex w-full max-w-3xl items-center justify-between gap-3 px-4 py-3",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "min-w-0",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-xs text-muted",
							children: "على هذا الجهاز فقط"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
							className: "truncate text-lg font-semibold",
							children: title
						})]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-center gap-2",
						children: [phase.kind !== "home" && phase.kind !== "work" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							variant: "ghost",
							onClick: () => setPhase({ kind: "home" }),
							children: "الرئيسية"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "flex size-11 items-center justify-center rounded-md border border-border text-primary",
							"aria-hidden": "true",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Lock, { className: "size-4" })
						})]
					})]
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("main", {
				className: "mx-auto flex w-full min-w-0 max-w-3xl flex-col gap-4 px-4 py-5",
				children: [
					error && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "rounded-md border border-danger/40 bg-surface px-3 py-2 text-sm text-danger",
						role: "alert",
						children: error
					}),
					!ready && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-sm text-muted",
						children: "جارٍ فتح السجل المحلي…"
					}),
					ready && phase.kind === "home" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Home, {
						meta,
						hasSheet: Boolean(session.sheet),
						sheetName: session.sheet?.fileName ?? "",
						onReference: () => openFile("reference"),
						onSheet: () => openFile("sheet"),
						onDemo: () => void loadDemo(),
						onBrowse: () => void openBrowse(),
						onExport: () => void exportReference(),
						onReplace: () => {
							setAckExport(false);
							setReplaceOpen(true);
						},
						onResume: () => setPhase({ kind: "pick" }),
						onSample: (kind) => void downloadSample(kind)
					}),
					phase.kind === "map" && session.parsed && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(MapView, {
						fileName: session.parsed.fileName,
						headers: session.parsed.headers,
						rows: session.parsed.rows,
						mapping: session.parsed.mapping,
						restored: session.parsed.restored,
						target: session.parsed.target,
						tick: rev,
						onChange: setMapped,
						onConfirm: () => void confirmMapping()
					}),
					phase.kind === "ref-review" && session.pendingRef && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ReviewView, {
						fileName: session.pendingRef.fileName,
						kept: session.pendingRef.people.length,
						issues: session.pendingRef.issues,
						page,
						onPage: setPage,
						onSave: () => void commitReference()
					}),
					phase.kind === "pick" && session.sheet && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(PickView, {
						fileName: session.sheet.fileName,
						count: session.sheet.people.length,
						onAudit: () => void runAudit(),
						onEnrich: () => void runEnrich()
					}),
					phase.kind === "work" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(WorkView, {
						label: phase.label,
						done: phase.done,
						total: phase.total
					}),
					phase.kind === "audit" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AuditView, {
						rows: visibleAudit,
						total: auditRows.length,
						counts: countLevels(auditRows),
						filter,
						page,
						onFilter: (value) => {
							setFilter(value);
							setPage(1);
						},
						onPage: setPage,
						onExport: () => void exportAudit(),
						onEnrich: () => void runEnrich()
					}),
					phase.kind === "enrich" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(EnrichView, {
						rows: visibleEnrich,
						total: enrichRows.length,
						counts: countStatuses(enrichRows),
						all: enrichRows,
						filter,
						page,
						tick: rev,
						onFilter: (value) => {
							setFilter(value);
							setPage(1);
						},
						onPage: setPage,
						onToggle: toggleFill,
						onChoose: chooseCandidate,
						onProbable: setProbable,
						onExport: () => void exportEnrich(),
						onAudit: () => void runAudit()
					}),
					phase.kind === "browse" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(BrowseView, {
						rows: browsed,
						query,
						page,
						onQuery: setQuery,
						onPage: setPage
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "pt-2 text-xs text-muted",
						children: "المرجع للقراءة فقط. الكشف الجديد لا يُحفظ هنا، والنتيجة تُنزَّل ملفاً عندما تطلب ذلك."
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
				ref: fileRef,
				className: "sr-only",
				type: "file",
				accept: ".xlsx,.xls,.csv,text/csv",
				onChange: (event) => {
					const file = event.target.files?.[0];
					if (file) onFile(file);
				}
			}),
			replaceOpen && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "fixed inset-0 z-30 flex items-end justify-center bg-bg/80 p-4 sm:items-center",
				role: "dialog",
				"aria-modal": "true",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "w-full max-w-md rounded-lg border border-border bg-surface p-5",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
							className: "text-lg font-semibold",
							children: "استبدال الملف المرجعي"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "mt-2 text-sm text-muted",
							children: "سيُحذف المرجع الحالي من هذا الجهاز نهائياً، ثم يُبنى مرجع جديد. لا يمكن التراجع بعد الحفظ."
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "mt-4 flex flex-col gap-3",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
									variant: "surface",
									full: true,
									onClick: () => void exportReference(),
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Download, { className: "size-4" }), "تصدير النسخة الحالية"]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
									className: "flex min-h-11 items-center gap-3 text-sm",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
										type: "checkbox",
										checked: ackExport,
										onChange: (event) => setAckExport(event.target.checked)
									}), "صدّرت النسخة، أو لا أحتاجها"]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
									variant: "danger",
									full: true,
									disabled: !ackExport,
									onClick: () => {
										setReplaceOpen(false);
										openFile("reference");
									},
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(RefreshCw, { className: "size-4" }), "متابعة الاستبدال"]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
									variant: "ghost",
									full: true,
									onClick: () => setReplaceOpen(false),
									children: "إلغاء"
								})
							]
						})
					]
				})
			})
		]
	});
}
function Home({ meta, hasSheet, sheetName, onReference, onSheet, onDemo, onBrowse, onExport, onReplace, onResume, onSample }) {
	if (!meta) return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
			className: "rounded-lg border border-border bg-surface p-5",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "mb-4 flex size-11 items-center justify-center rounded-md bg-surface-2 text-primary",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ShieldCheck, { className: "size-5" })
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
					className: "text-2xl font-semibold text-balance",
					children: "دقق الكشف واستكمل النواقص دون أن يغادر الجهاز"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-2 text-sm text-muted",
					children: "تُرفع القاعدة مرة واحدة، وتبقى للقراءة فقط. أي كشف لاحق يُقارن بها هنا، ثم تُنزَّل النتيجة."
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("ol", {
					className: "mt-5 flex flex-col gap-3 text-sm",
					children: [
						"ارفع الملف المرجعي مرة واحدة",
						"دقق كشفاً أو استكمل حقوله الفارغة",
						"نزّل ملف إكسل بالنتيجة"
					].map((step, index) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
						className: "flex items-center gap-3",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "num flex size-7 shrink-0 items-center justify-center rounded-full bg-surface-2 text-primary",
							children: index + 1
						}), step]
					}, step))
				})
			]
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
			variant: "primary",
			full: true,
			onClick: onReference,
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(FileSpreadsheet, { className: "size-4" }), "رفع الملف المرجعي"]
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
			variant: "surface",
			full: true,
			onClick: onDemo,
			children: "تجربة ببيانات وهمية"
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "text-xs text-muted",
			children: "احفظ عمود الهوية والجوال كنص في إكسل حتى لا يضيع الصفر الأول."
		})
	] });
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
			className: "rounded-lg border border-border bg-surface p-5",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-xs text-primary",
					children: "مرجع للقراءة فقط"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
					className: "mt-1 text-xl font-semibold text-balance",
					children: meta.fileName
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
					className: "mt-2 text-sm text-muted",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "num",
							children: meta.rowCount
						}),
						" صف · ",
						formatWhen(meta.importedAt),
						meta.issueCount > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
							" ",
							"· ",
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "num",
								children: meta.issueCount
							}),
							" ملاحظة عند الرفع"
						] })
					]
				})
			]
		}),
		hasSheet && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
			className: "rounded-lg border border-border bg-surface p-4",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
				className: "text-sm",
				children: ["كشف جاهز: ", sheetName]
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
				className: "mt-3",
				variant: "primary",
				full: true,
				onClick: onResume,
				children: "متابعة هذا الكشف"
			})]
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
			variant: "primary",
			full: true,
			onClick: onSheet,
			children: "تدقيق أو استكمال كشف جديد"
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "grid grid-cols-2 gap-3",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
				variant: "surface",
				onClick: onBrowse,
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Search, { className: "size-4" }), "تصفح"]
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
				variant: "surface",
				onClick: onExport,
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Download, { className: "size-4" }), "تصدير"]
			})]
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
			variant: "danger",
			full: true,
			onClick: onReplace,
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(RefreshCw, { className: "size-4" }), "استبدال الملف المرجعي"]
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "flex flex-col gap-2 text-sm",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
				className: "min-h-11 text-start text-muted underline-offset-4 hover:underline",
				onClick: () => onSample("reference"),
				children: "تنزيل مرجع تجريبي"
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
				className: "min-h-11 text-start text-muted underline-offset-4 hover:underline",
				onClick: () => onSample("sheet"),
				children: "تنزيل كشف تجريبي"
			})]
		})
	] });
}
function MapView({ fileName, headers, rows, mapping, restored, target, tick, onChange, onConfirm }) {
	const problem = mappingError(mapping);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
			className: "rounded-lg border border-border bg-surface p-4",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
				className: "font-semibold",
				children: fileName
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
				className: "mt-1 text-sm text-muted",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "num",
						children: rows.length
					}),
					" صف · ",
					target === "reference" ? "سيصبح المرجع" : "كشف للمقارنة",
					restored ? " · استُعيد ربط سابق لهذا الشكل" : ""
				]
			})]
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "flex flex-col gap-3",
			"data-tick": tick,
			children: FIELD_ORDER.map((field) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
				className: "flex flex-col gap-1 text-sm",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "text-muted",
					children: FIELD_LABEL[field]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("select", {
					className: "min-h-11 rounded-md border border-border bg-surface-2 px-3 text-fg",
					value: mapping[field] ?? "",
					onChange: (event) => onChange(field, event.target.value),
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
						value: "",
						children: "بدون"
					}), headers.map((header) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
						value: header,
						children: header
					}, header))]
				})]
			}, field))
		}),
		problem && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "text-sm text-danger",
			children: problem
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "overflow-x-auto rounded-lg border border-border",
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("table", {
				className: "w-full min-w-full text-sm",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("thead", {
					className: "bg-surface-2 text-muted",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("tr", { children: headers.slice(0, 4).map((header) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
						className: "px-3 py-2 text-start font-medium",
						children: header
					}, header)) })
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("tbody", { children: rows.slice(0, 3).map((row, index) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("tr", {
					className: "border-t border-border",
					children: headers.slice(0, 4).map((header, cell) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
						className: "max-w-40 truncate px-3 py-2",
						children: row[cell]
					}, header))
				}, index)) })]
			})
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
			variant: "primary",
			full: true,
			disabled: Boolean(problem),
			onClick: onConfirm,
			children: "متابعة"
		})
	] });
}
function ReviewView({ fileName, kept, issues, page, onPage, onSave }) {
	const errors = issues.filter((issue) => issue.findings.some((f) => f.severity === "error")).length;
	const warnings = issues.length - errors;
	const slice = issues.slice((page - 1) * PAGE, page * PAGE);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
			className: "rounded-lg border border-border bg-surface p-4",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
				className: "font-semibold",
				children: fileName
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-2 text-sm text-muted",
				children: "يمكن الحفظ رغم الملاحظات. بعد الحفظ لا يُعدَّل المرجع إلا بالاستبدال الكامل."
			})]
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "grid grid-cols-3 gap-3",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Stat, {
					label: "سيُحفظ",
					value: kept
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Stat, {
					label: "أخطاء",
					value: errors,
					warn: errors > 0
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Stat, {
					label: "تنبيهات",
					value: warnings
				})
			]
		}),
		issues.length === 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "rounded-lg border border-border bg-surface p-4 text-sm",
			children: "لا ملاحظات على المرجع."
		}),
		slice.map((issue) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("article", {
			className: "rounded-lg border border-border bg-surface p-4",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
					className: "text-sm",
					children: [
						"صف ",
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "num",
							children: issue.n
						}),
						issue.nameRaw ? ` · ${issue.nameRaw}` : ""
					]
				}),
				issue.idNumber && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "num mt-1 text-sm text-muted",
					children: issue.idNumber
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
					className: "mt-2 flex flex-col gap-1 text-sm",
					children: issue.findings.map((finding) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", {
						className: tone(finding.severity),
						children: finding.message
					}, finding.code + finding.message))
				})
			]
		}, `${issue.n}-${issue.findings[0]?.code}`)),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Pager, {
			page,
			total: issues.length,
			onPage
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
			variant: "primary",
			full: true,
			onClick: onSave,
			children: "حفظ المرجع على الجهاز"
		})
	] });
}
function PickView({ fileName, count, onAudit, onEnrich }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
			className: "rounded-lg border border-border bg-surface p-4",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
				className: "font-semibold",
				children: fileName
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
				className: "mt-1 text-sm text-muted",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "num",
					children: count
				}), " صف. اختر مهمة واحدة. لا يُكتب شيء في المرجع."]
			})]
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
			className: "rounded-lg border border-border bg-surface p-4 text-start",
			onClick: onAudit,
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "block font-semibold",
				children: "التدقيق واكتشاف الأخطاء"
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "mt-1 block text-sm text-muted",
				children: "تعارض الهوية مع الاسم، حقول ناقصة، تكرار، وأسماء لا أصل لها."
			})]
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
			className: "rounded-lg border border-border bg-surface p-4 text-start",
			onClick: onEnrich,
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "block font-semibold",
				children: "استكمال البيانات الناقصة"
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "mt-1 block text-sm text-muted",
				children: "يُقترح ملء الخلايا الفارغة فقط، بعد عرض درجة الثقة."
			})]
		})
	] });
}
function WorkView({ label, done, total }) {
	const pct = total > 0 ? Math.min(100, Math.round(done / total * 100)) : 8;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
		className: "rounded-lg border border-border bg-surface p-5",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
				className: "font-semibold",
				children: label
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-1 text-sm text-muted",
				children: "المعالجة على هذا الجهاز. أبقِ الصفحة مفتوحة."
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "mt-4 h-2 overflow-hidden rounded-full bg-surface-2",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "h-full bg-primary transition-all duration-200",
					style: { width: `${pct}%` }
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
				className: "num mt-2 text-sm text-muted",
				children: [pct, "%"]
			})
		]
	});
}
function AuditView({ rows, total, counts, filter, page, onFilter, onPage, onExport, onEnrich }) {
	const slice = rows.slice((page - 1) * PAGE, page * PAGE);
	const filters = [
		{
			id: "all",
			label: "الكل",
			count: total
		},
		{
			id: "error",
			label: "أخطاء",
			count: counts.error
		},
		{
			id: "warning",
			label: "تنبيهات",
			count: counts.warning
		},
		{
			id: "info",
			label: "ملاحظات",
			count: counts.info
		},
		{
			id: "ok",
			label: "سليم",
			count: counts.ok
		}
	];
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(FilterRow, {
			filters,
			current: filter,
			onFilter
		}),
		slice.length === 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "text-sm text-muted",
			children: "لا صفوف في هذا التصنيف."
		}),
		slice.map((row) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("article", {
			className: "rounded-lg border border-border bg-surface p-4",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex items-start justify-between gap-3",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "font-medium",
					children: row.nameRaw || "بدون اسم"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
					className: "mt-1 text-sm text-muted",
					children: [
						"صف ",
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "num",
							children: row.n
						}),
						row.idNumber && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
							" ",
							"· ",
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "num",
								children: row.idNumber
							})
						] })
					]
				})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: cn("text-sm font-medium", tone(row.worst)),
					children: LEVEL_LABEL[row.worst]
				})]
			}), row.findings.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
				className: "mt-3 flex flex-col gap-1 text-sm",
				children: row.findings.map((finding) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", {
					className: tone(finding.severity),
					children: finding.message
				}, finding.code + finding.message))
			})]
		}, row.n)),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Pager, {
			page,
			total: rows.length,
			onPage
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
			variant: "primary",
			full: true,
			onClick: onExport,
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Download, { className: "size-4" }), "تنزيل تقرير التدقيق"]
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
			variant: "surface",
			full: true,
			onClick: onEnrich,
			children: "انتقل إلى الاستكمال بنفس الكشف"
		})
	] });
}
function EnrichView({ rows, total, counts, all, filter, page, tick, onFilter, onPage, onToggle, onChoose, onProbable, onExport, onAudit }) {
	const slice = rows.slice((page - 1) * PAGE, page * PAGE);
	const selected = all.reduce((sum, row) => sum + row.fills.filter((fill) => fill.on).length, 0);
	const filters = [
		{
			id: "all",
			label: "الكل",
			count: total
		},
		{
			id: "exact",
			label: "قطعي",
			count: counts.exact
		},
		{
			id: "probable",
			label: "مرجّح",
			count: counts.probable
		},
		{
			id: "ambiguous",
			label: "غامض",
			count: counts.ambiguous
		},
		{
			id: "conflict",
			label: "تعارض",
			count: counts.conflict
		},
		{
			id: "new",
			label: "جديد",
			count: counts.new
		}
	];
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		"data-tick": tick,
		className: "flex flex-col gap-4",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(FilterRow, {
				filters,
				current: filter,
				onFilter
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
				className: "text-sm text-muted",
				children: [
					"سيُكتب ",
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "num",
						children: selected
					}),
					" حقلاً فارغاً. الموجود أصلاً لا يُستبدل."
				]
			}),
			counts.probable > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
				variant: "surface",
				full: true,
				onClick: () => onProbable(true),
				children: "اعتماد الحقول المرجّحة أيضاً"
			}),
			slice.length === 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-sm text-muted",
				children: "لا صفوف في هذا التصنيف."
			}),
			slice.map((row) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("article", {
				className: "rounded-lg border border-border bg-surface p-4",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-start justify-between gap-3",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "font-medium",
							children: row.nameRaw || "بدون اسم"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
							className: "mt-1 text-sm text-muted",
							children: [
								"صف ",
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "num",
									children: row.n
								}),
								row.idNumber && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
									" ",
									"· ",
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "num",
										children: row.idNumber
									})
								] })
							]
						})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: cn("text-sm font-medium", tone(row.status)),
							children: STATUS_LABEL[row.status]
						})]
					}),
					row.via && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-2 text-sm text-muted",
						children: row.via
					}),
					row.candidates.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "mt-3 flex flex-col gap-2",
						children: row.candidates.map((candidate) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
							className: cn("rounded-md border px-3 py-2 text-start text-sm", row.refN === candidate.n ? "border-primary bg-surface-2" : "border-border"),
							onClick: () => onChoose(row, candidate.n),
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "block",
								children: candidate.nameRaw
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "num text-muted",
								children: candidate.idNumber
							})]
						}, candidate.n))
					}),
					row.fills.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
						className: "mt-3 flex flex-col gap-2",
						children: row.fills.map((fill) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
							className: "flex min-h-11 items-center gap-3 text-sm",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
								type: "checkbox",
								checked: fill.on,
								onChange: () => onToggle(row, fill.key)
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [
								fill.label,
								": ",
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "num",
									children: fill.value
								})
							] })]
						}) }, fill.key))
					}),
					row.findings.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
						className: "mt-2 flex flex-col gap-1 text-sm",
						children: row.findings.map((finding) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", {
							className: tone(finding.severity),
							children: finding.message
						}, finding.code + finding.message))
					})
				]
			}, row.n)),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Pager, {
				page,
				total: rows.length,
				onPage
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
				variant: "primary",
				full: true,
				onClick: onExport,
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Download, { className: "size-4" }), "تنزيل الكشف المستكمل"]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
				variant: "surface",
				full: true,
				onClick: onAudit,
				children: "انتقل إلى التدقيق بنفس الكشف"
			})
		]
	});
}
function BrowseView({ rows, query, page, onQuery, onPage }) {
	const slice = rows.slice((page - 1) * PAGE, page * PAGE);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "rounded-lg border border-border bg-surface px-4 py-3 text-sm text-primary",
			children: "للقراءة فقط. لا تعديل من هنا."
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
			className: "flex flex-col gap-1 text-sm",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "text-muted",
				children: "بحث بالاسم أو الهوية"
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
				className: "min-h-11 rounded-md border border-border bg-surface-2 px-3 text-fg",
				value: query,
				onChange: (event) => {
					onQuery(event.target.value);
					onPage(1);
				}
			})]
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
			className: "text-sm text-muted",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "num",
				children: rows.length
			}), " صف"]
		}),
		slice.map((row) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("article", {
			className: "rounded-lg border border-border bg-surface px-4 py-3",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "font-medium",
				children: row.nameRaw || "بدون اسم"
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "num mt-1 text-sm text-muted",
				children: row.idNumber || "—"
			})]
		}, row.n)),
		rows.length === 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "text-sm text-muted",
			children: "لا نتائج."
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Pager, {
			page,
			total: rows.length,
			onPage
		})
	] });
}
function Stat({ label, value, warn }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "rounded-lg border border-border bg-surface p-3",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "text-xs text-muted",
			children: label
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: cn("num mt-1 text-xl font-semibold", warn && "text-danger"),
			children: value
		})]
	});
}
function FilterRow({ filters, current, onFilter }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "flex w-full min-w-0 gap-2 overflow-x-auto pb-1",
		children: filters.map((item) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
			className: cn("min-h-11 shrink-0 rounded-full border px-3 text-sm", current === item.id ? "border-primary bg-surface-2 text-fg" : "border-border text-muted"),
			onClick: () => onFilter(item.id),
			children: [
				item.label,
				" ",
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "num",
					children: item.count
				})
			]
		}, item.id))
	});
}
function Pager({ page, total, onPage }) {
	const pages = Math.max(1, Math.ceil(total / PAGE));
	if (pages <= 1) return null;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "flex items-center justify-between gap-3",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
				variant: "surface",
				disabled: page <= 1,
				onClick: () => onPage(page - 1),
				children: "السابق"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
				className: "num text-sm text-muted",
				children: [
					page,
					" / ",
					pages
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
				variant: "surface",
				disabled: page >= pages,
				onClick: () => onPage(page + 1),
				children: "التالي"
			})
		]
	});
}
//#endregion
export { AuditorApp };
