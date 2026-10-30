import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeftRight, Download, FileSpreadsheet, Lock, RefreshCw, Search, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  auditSheetAsync,
  cellsForChoice,
  countLevels,
  countStatuses,
  enrichSheetAsync,
  fillsForChoice,
  LEVEL_LABEL,
  peopleFromRows,
  reviewReference,
  STATUS_LABEL,
  suggestColumnLinks,
  transferSheetAsync,
  yieldToUi,
} from "@/lib/auditor/engine";
import {
  auditRecords,
  auditSummary,
  downloadSheets,
  enrichmentRecords,
  parseWorkbook,
  referenceRecords,
  transferLog,
  transferRecords,
} from "@/lib/auditor/excel";
import { FIELD_LABEL, FIELD_ORDER, guessMapping, loadProfile, mappingError, saveProfile } from "@/lib/auditor/mapping";
import { normalizeArabic, normalizeId } from "@/lib/auditor/normalize";
import { SAMPLE_HEADERS, SAMPLE_REFERENCE, SAMPLE_SHEET } from "@/lib/auditor/sample";
import { session, type FileTarget } from "@/lib/auditor/session";
import { loadMeta, loadRecords, saveReference } from "@/lib/auditor/store";
import type {
  AuditLevel,
  AuditRow,
  EnrichRow,
  EnrichStatus,
  FieldKey,
  ReferenceMeta,
  RowIssue,
  TransferRow,
} from "@/lib/auditor/types";
import { cn } from "@/lib/cn";

const PAGE = 8;

type Phase =
  | { kind: "home" }
  | { kind: "map" }
  | { kind: "ref-review" }
  | { kind: "pick" }
  | { kind: "work"; label: string; done: number; total: number }
  | { kind: "audit" }
  | { kind: "enrich" }
  | { kind: "browse" }
  | { kind: "xfer-pick" }
  | { kind: "xfer-columns" }
  | { kind: "xfer-review" };

function formatWhen(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString("ar", { dateStyle: "medium", timeStyle: "short" });
}

function tone(level: string) {
  if (level === "error" || level === "conflict") return "text-danger";
  if (level === "warning" || level === "probable" || level === "ambiguous") return "text-primary";
  if (level === "info" || level === "new" || level === "empty") return "text-muted";
  return "text-fg";
}

export function AuditorApp() {
  const fileRef = useRef<HTMLInputElement>(null);
  const targetRef = useRef<FileTarget>("reference");
  const [phase, setPhase] = useState<Phase>({ kind: "home" });
  const [meta, setMeta] = useState<ReferenceMeta | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [rev, setRev] = useState(0);
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [replaceOpen, setReplaceOpen] = useState(false);
  const [ackExport, setAckExport] = useState(false);
  const bump = () => setRev((n) => n + 1);

  useEffect(() => {
    void loadMeta()
      .then(setMeta)
      .catch(() => setError("تعذر فتح التخزين المحلي في هذا المتصفح."))
      .finally(() => setReady(true));
  }, []);

  function openFile(target: FileTarget) {
    setError("");
    targetRef.current = target;
    if (fileRef.current) {
      fileRef.current.value = "";
      fileRef.current.click();
    }
  }

  async function onFile(file: File) {
    setError("");
    setPhase({ kind: "work", label: "جارٍ قراءة الملف", done: 0, total: 1 });
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
        restored: Boolean(saved),
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
    setPhase({ kind: "work", label: "جارٍ فحص الصفوف", done: 0, total: parsed.rows.length });
    await yieldToUi();
    const people = peopleFromRows(parsed.headers, parsed.rows, parsed.mapping);
    const side = { fileName: parsed.fileName, headers: parsed.headers, mapping: parsed.mapping, people };
    if (parsed.target === "reference") {
      const reviewed = reviewReference(people);
      session.pendingRef = { ...side, people: reviewed.kept, issues: reviewed.issues };
      setPage(1);
      setPhase({ kind: "ref-review" });
      return;
    }
    if (parsed.target === "xfer-dest") {
      session.transfer = { dest: side, source: null, links: [], rows: null, skippedSource: 0 };
      setPhase({ kind: "xfer-pick" });
      return;
    }
    if (parsed.target === "xfer-source") {
      const dest = session.transfer?.dest;
      if (!dest) {
        setError("ارفع الكشف الأول أولاً.");
        setPhase({ kind: "home" });
        return;
      }
      session.transfer = {
        dest,
        source: side,
        links: suggestColumnLinks(dest.headers, side.headers),
        rows: null,
        skippedSource: 0,
      };
      setPhase({ kind: "xfer-columns" });
      return;
    }
    session.sheet = { ...side, audit: null, enrich: null };
    setPhase({ kind: "pick" });
  }

  async function commitReference() {
    const pending = session.pendingRef;
    if (!pending) return;
    setPhase({ kind: "work", label: "جارٍ حفظ المرجع على الجهاز", done: 0, total: pending.people.length });
    await yieldToUi();
    try {
      await saveReference({
        fileName: pending.fileName,
        headers: pending.headers,
        mapping: pending.mapping,
        people: pending.people,
        issueCount: pending.issues.length,
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
    const current = meta ?? (await loadMeta());
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
        setPhase({ kind: "work", label: "جارٍ التدقيق", done, total });
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
      const rows = await enrichSheetAsync(
        session.sheet.people,
        refs,
        session.sheet.mapping,
        session.refMapping,
        (done, total) => setPhase({ kind: "work", label: "جارٍ الاستكمال", done, total }),
      );
      session.sheet.enrich = rows;
      setFilter("all");
      setPage(1);
      setPhase({ kind: "enrich" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذر الاستكمال");
      setPhase({ kind: "pick" });
    }
  }

  async function runTransfer() {
    const job = session.transfer;
    if (!job?.source) return;
    setError("");
    try {
      const result = await transferSheetAsync(job.dest.people, job.source.people, job.links, (done, total) => {
        setPhase({ kind: "work", label: "جارٍ نقل الأعمدة", done, total });
      });
      job.rows = result.rows;
      job.skippedSource = result.skippedSource;
      setFilter("all");
      setPage(1);
      setPhase({ kind: "xfer-review" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذر نقل الأعمدة");
      setPhase({ kind: "xfer-columns" });
    }
  }

  async function loadDemo() {
    setError("");
    const map = guessMapping(SAMPLE_HEADERS);
    const reviewed = reviewReference(peopleFromRows(SAMPLE_HEADERS, SAMPLE_REFERENCE, map));
    setPhase({ kind: "work", label: "جارٍ تجهيز البيانات التجريبية", done: 0, total: 1 });
    await yieldToUi();
    try {
      await saveReference({
        fileName: "مرجع تجريبي.xlsx",
        headers: SAMPLE_HEADERS,
        mapping: map,
        people: reviewed.kept,
        issueCount: reviewed.issues.length,
      });
      session.refs = reviewed.kept;
      session.refMapping = map;
      session.sheet = {
        fileName: "كشف تجريبي.xlsx",
        headers: SAMPLE_HEADERS,
        mapping: map,
        people: peopleFromRows(SAMPLE_HEADERS, SAMPLE_SHEET, map),
        audit: null,
        enrich: null,
      };
      setMeta(await loadMeta());
      setPhase({ kind: "pick" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذر تجهيز التجربة");
      setPhase({ kind: "home" });
    }
  }

  async function exportReference() {
    const current = meta ?? (await loadMeta());
    if (!current) return;
    const people = session.refs.length ? session.refs : await loadRecords();
    session.refs = people;
    await downloadSheets("المرجع.xlsx", [{ name: "المرجع", rows: referenceRecords(current.headers, people) }]);
    setAckExport(true);
  }

  async function exportAudit() {
    const rows = session.sheet?.audit;
    if (!rows) return;
    await downloadSheets(`تدقيق-${session.sheet?.fileName || "كشف"}.xlsx`, [
      { name: "التدقيق", rows: auditRecords(rows) },
      { name: "ملخص", rows: auditSummary(rows) },
    ]);
  }

  async function exportEnrich() {
    const job = session.sheet;
    if (!job?.enrich) return;
    await downloadSheets(`استكمال-${job.fileName}.xlsx`, [
      { name: "النتائج", rows: enrichmentRecords(job.headers, job.people, job.enrich) },
    ]);
  }

  async function exportTransfer() {
    const job = session.transfer;
    if (!job?.source || !job.rows) return;
    await downloadSheets(`نقل-${job.dest.fileName}`, [
      { name: "الكشف", rows: transferRecords(job.dest.headers, job.dest.people, job.rows, job.links) },
      { name: "السجل", rows: transferLog(job.dest.people, job.source.people, job.rows) },
    ]);
  }

  async function downloadSample(kind: "reference" | "sheet") {
    const source = kind === "reference" ? SAMPLE_REFERENCE : SAMPLE_SHEET;
    const rows = source.map((row) => Object.fromEntries(SAMPLE_HEADERS.map((header, i) => [header, row[i] ?? ""])));
    await downloadSheets(kind === "reference" ? "مرجع-تجريبي.xlsx" : "كشف-تجريبي.xlsx", [{ name: "البيانات", rows }]);
  }

  async function openBrowse() {
    setError("");
    setPhase({ kind: "work", label: "جارٍ فتح المرجع", done: 0, total: 1 });
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

  function setMapped(field: FieldKey, header: string) {
    const parsed = session.parsed;
    if (!parsed) return;
    const mapping = { ...parsed.mapping };
    for (const key of FIELD_ORDER) {
      if (key !== field && mapping[key] === header) delete mapping[key];
    }
    if (!header) delete mapping[field];
    else mapping[field] = header;
    parsed.mapping = mapping;
    setError("");
    bump();
  }

  function setLink(sourceHeader: string, value: string) {
    const job = session.transfer;
    const link = job?.links.find((item) => item.sourceHeader === sourceHeader);
    if (!job || !link) return;
    if (value === "skip") link.action = "skip";
    else if (value === "add") {
      link.action = "add";
      if (!link.destHeader || job.dest.headers.includes(link.destHeader)) {
        link.destHeader = job.dest.headers.includes(sourceHeader) ? `${sourceHeader} (مستورد)` : sourceHeader;
      }
    } else if (value.startsWith("fill:")) {
      link.action = "fill";
      link.destHeader = value.slice(5);
    }
    bump();
  }

  function renameLink(sourceHeader: string, destHeader: string) {
    const link = session.transfer?.links.find((item) => item.sourceHeader === sourceHeader);
    if (!link) return;
    link.destHeader = destHeader;
    bump();
  }

  function chooseCandidate(row: EnrichRow, refN: number) {
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

  function toggleFill(row: EnrichRow, key: string) {
    const fill = row.fills.find((item) => item.key === key);
    if (!fill) return;
    fill.on = !fill.on;
    bump();
  }

  function setProbable(on: boolean) {
    for (const row of session.sheet?.enrich ?? []) {
      if (row.status !== "probable") continue;
      for (const fill of row.fills) fill.on = on;
    }
    bump();
  }

  function chooseTransfer(row: TransferRow, sourceN: number) {
    const job = session.transfer;
    const dest = job?.dest.people.find((person) => person.n === row.n);
    const source = job?.source?.people.find((person) => person.n === sourceN);
    if (!job?.source || !dest || !source) return;
    row.sourceN = source.n;
    row.via = "اختيار يدوي";
    row.status = "probable";
    row.score = row.candidates.find((candidate) => candidate.n === sourceN)?.score ?? row.score;
    row.cells = cellsForChoice(dest, source, job.links);
    const used = new Set((job.rows ?? []).map((item) => item.sourceN).filter((n): n is number => n != null));
    job.skippedSource = job.source.people.filter((person) => !used.has(person.n)).length;
    bump();
  }

  function toggleTransfer(row: TransferRow, sourceHeader: string) {
    const cell = row.cells.find((item) => item.sourceHeader === sourceHeader);
    if (!cell) return;
    cell.on = !cell.on;
    bump();
  }

  function setTransferProbable(on: boolean) {
    for (const row of session.transfer?.rows ?? []) {
      if (row.status !== "probable") continue;
      for (const cell of row.cells) cell.on = on;
    }
    bump();
  }

  const auditRows = session.sheet?.audit ?? [];
  const enrichRows = session.sheet?.enrich ?? [];
  const transferRows = session.transfer?.rows ?? [];
  const visibleAudit = useMemo(() => {
    if (filter === "all") return auditRows;
    return auditRows.filter((row) => row.worst === filter);
  }, [auditRows, filter, rev]);
  const visibleEnrich = useMemo(() => {
    if (filter === "all") return enrichRows;
    return enrichRows.filter((row) => row.status === filter);
  }, [enrichRows, filter, rev]);
  const visibleTransfer = useMemo(() => {
    if (filter === "all") return transferRows;
    return transferRows.filter((row) => row.status === filter);
  }, [transferRows, filter, rev]);
  const browsed = useMemo(() => {
    const q = query.trim();
    const qNorm = normalizeArabic(q);
    const qId = normalizeId(q);
    return session.refs.filter((person) => {
      if (!q) return true;
      return (qId.length > 0 && person.idNumber.includes(qId)) || person.nameNorm.includes(qNorm) || person.nameRaw.includes(q);
    });
  }, [query, rev, phase.kind]);

  const title =
    phase.kind === "map"
      ? "ربط الأعمدة"
      : phase.kind === "ref-review"
        ? "فحص المرجع"
        : phase.kind === "pick"
          ? "مهمة الكشف"
          : phase.kind === "audit"
            ? "تقرير التدقيق"
            : phase.kind === "enrich"
              ? "استكمال النواقص"
              : phase.kind === "browse"
                ? "المرجع"
                : phase.kind === "work"
                  ? "المعالجة"
                  : phase.kind === "xfer-pick"
                    ? "كشف الأعمدة"
                    : phase.kind === "xfer-columns"
                      ? "اختيار الأعمدة"
                      : phase.kind === "xfer-review"
                        ? "نتيجة النقل"
                        : "المدقّق";

  return (
    <div className="min-h-dvh bg-bg text-fg">
      <header className="sticky top-0 z-20 border-b border-border bg-bg/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-3 px-4 py-3">
          <div className="min-w-0">
            <p className="text-xs text-muted">على هذا الجهاز فقط</p>
            <h1 className="truncate text-lg font-semibold">{title}</h1>
          </div>
          <div className="flex items-center gap-2">
            {phase.kind !== "home" && phase.kind !== "work" && (
              <Button variant="ghost" onClick={() => setPhase({ kind: "home" })}>
                الرئيسية
              </Button>
            )}
            <span className="flex size-11 items-center justify-center rounded-md border border-border text-primary" aria-hidden="true">
              <Lock className="size-4" />
            </span>
          </div>
        </div>
      </header>
      <main className="mx-auto flex w-full min-w-0 max-w-3xl flex-col gap-4 px-4 py-5">
        {error && (
          <p className="rounded-md border border-danger/40 bg-surface px-3 py-2 text-sm text-danger" role="alert">
            {error}
          </p>
        )}
        {!ready && <p className="text-sm text-muted">جارٍ فتح السجل المحلي…</p>}
        {phase.kind === "home" && (
          <Home
            meta={meta}
            hasSheet={Boolean(session.sheet)}
            sheetName={session.sheet?.fileName ?? ""}
            onReference={() => openFile("reference")}
            onSheet={() => openFile("sheet")}
            onTransfer={() => openFile("xfer-dest")}
            onDemo={() => void loadDemo()}
            onBrowse={() => void openBrowse()}
            onExport={() => void exportReference()}
            onReplace={() => {
              setAckExport(false);
              setReplaceOpen(true);
            }}
            onResume={() => setPhase({ kind: "pick" })}
            onSample={(kind) => void downloadSample(kind)}
          />
        )}
        {phase.kind === "map" && session.parsed && (
          <MapView
            fileName={session.parsed.fileName}
            headers={session.parsed.headers}
            rows={session.parsed.rows}
            mapping={session.parsed.mapping}
            restored={session.parsed.restored}
            target={session.parsed.target}
            tick={rev}
            onChange={setMapped}
            onConfirm={() => void confirmMapping()}
          />
        )}
        {phase.kind === "ref-review" && session.pendingRef && (
          <ReviewView
            fileName={session.pendingRef.fileName}
            kept={session.pendingRef.people.length}
            issues={session.pendingRef.issues}
            page={page}
            onPage={setPage}
            onSave={() => void commitReference()}
          />
        )}
        {phase.kind === "pick" && session.sheet && (
          <PickView
            fileName={session.sheet.fileName}
            count={session.sheet.people.length}
            onAudit={() => void runAudit()}
            onEnrich={() => void runEnrich()}
          />
        )}
        {phase.kind === "xfer-pick" && session.transfer && (
          <section className="flex flex-col gap-4">
            <section className="rounded-lg border border-border bg-surface p-4">
              <p className="text-xs text-primary">الكشف الأول — الأسماء التي ستبقى</p>
              <h2 className="mt-1 font-semibold">{session.transfer.dest.fileName}</h2>
              <p className="mt-1 text-sm text-muted">
                <span className="num">{session.transfer.dest.people.length}</span> صف. لن يُضاف أي اسم من الكشف الثاني.
              </p>
            </section>
            <Button variant="primary" full onClick={() => openFile("xfer-source")}>
              <FileSpreadsheet className="size-4" />
              رفع كشف الأعمدة
            </Button>
          </section>
        )}
        {phase.kind === "xfer-columns" && session.transfer?.source && (
          <ColumnsView
            destName={session.transfer.dest.fileName}
            sourceName={session.transfer.source.fileName}
            destCount={session.transfer.dest.people.length}
            sourceCount={session.transfer.source.people.length}
            destHeaders={session.transfer.dest.headers}
            links={session.transfer.links}
            tick={rev}
            onLink={setLink}
            onRename={renameLink}
            onRun={() => void runTransfer()}
          />
        )}
        {phase.kind === "work" && <WorkView label={phase.label} done={phase.done} total={phase.total} />}
        {phase.kind === "audit" && (
          <AuditView
            rows={visibleAudit}
            total={auditRows.length}
            counts={countLevels(auditRows)}
            filter={filter}
            page={page}
            onFilter={(value) => {
              setFilter(value);
              setPage(1);
            }}
            onPage={setPage}
            onExport={() => void exportAudit()}
            onEnrich={() => void runEnrich()}
          />
        )}
        {phase.kind === "enrich" && (
          <EnrichView
            rows={visibleEnrich}
            total={enrichRows.length}
            counts={countStatuses(enrichRows)}
            all={enrichRows}
            filter={filter}
            page={page}
            tick={rev}
            onFilter={(value) => {
              setFilter(value);
              setPage(1);
            }}
            onPage={setPage}
            onToggle={toggleFill}
            onChoose={chooseCandidate}
            onProbable={setProbable}
            onExport={() => void exportEnrich()}
            onAudit={() => void runAudit()}
          />
        )}
        {phase.kind === "xfer-review" && session.transfer && (
          <TransferView
            rows={visibleTransfer}
            total={transferRows.length}
            counts={countStatuses(transferRows)}
            all={transferRows}
            skipped={session.transfer.skippedSource}
            filter={filter}
            page={page}
            tick={rev}
            onFilter={(value) => {
              setFilter(value);
              setPage(1);
            }}
            onPage={setPage}
            onToggle={toggleTransfer}
            onChoose={chooseTransfer}
            onProbable={setTransferProbable}
            onExport={() => void exportTransfer()}
          />
        )}
        {phase.kind === "browse" && (
          <BrowseView rows={browsed} query={query} page={page} onQuery={setQuery} onPage={setPage} />
        )}
        <p className="pt-2 text-xs text-muted">
          المرجع للقراءة فقط. الكشوف لا تُرفع، والنتيجة تُنزَّل ملفاً عندما تطلب ذلك.
        </p>
      </main>
      <input
        ref={fileRef}
        className="sr-only"
        type="file"
        accept=".xlsx,.xls,.csv,text/csv"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void onFile(file);
        }}
      />
      {replaceOpen && (
        <div className="fixed inset-0 z-30 flex items-end justify-center bg-bg/80 p-4 sm:items-center" role="dialog" aria-modal="true">
          <div className="w-full max-w-md rounded-lg border border-border bg-surface p-5">
            <h2 className="text-lg font-semibold">استبدال الملف المرجعي</h2>
            <p className="mt-2 text-sm text-muted">سيُحذف المرجع الحالي من هذا الجهاز نهائياً، ثم يُبنى مرجع جديد.</p>
            <div className="mt-4 flex flex-col gap-3">
              <Button variant="surface" full onClick={() => void exportReference()}>
                <Download className="size-4" />
                تصدير النسخة الحالية
              </Button>
              <label className="flex min-h-11 items-center gap-3 text-sm">
                <input type="checkbox" checked={ackExport} onChange={(event) => setAckExport(event.target.checked)} />
                صدّرت النسخة، أو لا أحتاجها
              </label>
              <Button
                variant="danger"
                full
                disabled={!ackExport}
                onClick={() => {
                  setReplaceOpen(false);
                  openFile("reference");
                }}
              >
                <RefreshCw className="size-4" />
                متابعة الاستبدال
              </Button>
              <Button variant="ghost" full onClick={() => setReplaceOpen(false)}>
                إلغاء
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Home({
  meta,
  hasSheet,
  sheetName,
  onReference,
  onSheet,
  onTransfer,
  onDemo,
  onBrowse,
  onExport,
  onReplace,
  onResume,
  onSample,
}: {
  meta: ReferenceMeta | null;
  hasSheet: boolean;
  sheetName: string;
  onReference: () => void;
  onSheet: () => void;
  onTransfer: () => void;
  onDemo: () => void;
  onBrowse: () => void;
  onExport: () => void;
  onReplace: () => void;
  onResume: () => void;
  onSample: (kind: "reference" | "sheet") => void;
}) {
  return (
    <>
      {!meta ? (
        <section className="rounded-lg border border-border bg-surface p-5">
          <div className="mb-4 flex size-11 items-center justify-center rounded-md bg-surface-2 text-primary">
            <ShieldCheck className="size-5" />
          </div>
          <h2 className="text-2xl font-semibold text-balance">دقق الكشف واستكمل النواقص دون أن يغادر الجهاز</h2>
          <p className="mt-2 text-sm text-muted">
            تُرفع القاعدة مرة واحدة، وتبقى للقراءة فقط. أي كشف لاحق يُقارن بها هنا، ثم تُنزَّل النتيجة.
          </p>
        </section>
      ) : (
        <section className="rounded-lg border border-border bg-surface p-5">
          <p className="text-xs text-primary">مرجع للقراءة فقط</p>
          <h2 className="mt-1 text-xl font-semibold text-balance">{meta.fileName}</h2>
          <p className="mt-2 text-sm text-muted">
            <span className="num">{meta.rowCount}</span> صف · {formatWhen(meta.importedAt)}
            {meta.issueCount > 0 && (
              <>
                {" "}
                · <span className="num">{meta.issueCount}</span> ملاحظة عند الرفع
              </>
            )}
          </p>
        </section>
      )}
      {hasSheet && meta && (
        <section className="rounded-lg border border-border bg-surface p-4">
          <p className="text-sm">كشف جاهز: {sheetName}</p>
          <Button className="mt-3" variant="primary" full onClick={onResume}>
            متابعة هذا الكشف
          </Button>
        </section>
      )}
      <Button variant="primary" full onClick={onTransfer}>
        <ArrowLeftRight className="size-4" />
        نقل أعمدة من كشف إلى آخر
      </Button>
      <p className="text-sm text-muted">
        الأسماء تبقى أسماء الكشف الأول مهما اختلف العدد. الكشف الثاني يضيف أعمدة أو يملأ الخانات الفارغة فقط.
      </p>
      {!meta ? (
        <>
          <Button variant="surface" full onClick={onReference}>
            <FileSpreadsheet className="size-4" />
            رفع الملف المرجعي
          </Button>
          <Button variant="surface" full onClick={onDemo}>
            تجربة ببيانات وهمية
          </Button>
        </>
      ) : (
        <>
          <Button variant="surface" full onClick={onSheet}>
            تدقيق أو استكمال كشف جديد
          </Button>
          <div className="grid grid-cols-2 gap-3">
            <Button variant="surface" onClick={onBrowse}>
              <Search className="size-4" />
              تصفح
            </Button>
            <Button variant="surface" onClick={onExport}>
              <Download className="size-4" />
              تصدير
            </Button>
          </div>
          <Button variant="danger" full onClick={onReplace}>
            <RefreshCw className="size-4" />
            استبدال الملف المرجعي
          </Button>
        </>
      )}
      <p className="text-xs text-muted">احفظ عمود الهوية والجوال كنص في إكسل حتى لا يضيع الصفر الأول.</p>
      <div className="flex flex-col gap-2 text-sm">
        <button className="min-h-11 text-start text-muted underline-offset-4 hover:underline" onClick={() => onSample("reference")}>
          تنزيل مرجع تجريبي
        </button>
        <button className="min-h-11 text-start text-muted underline-offset-4 hover:underline" onClick={() => onSample("sheet")}>
          تنزيل كشف تجريبي
        </button>
      </div>
    </>
  );
}

function MapView({
  fileName,
  headers,
  rows,
  mapping,
  restored,
  target,
  tick,
  onChange,
  onConfirm,
}: {
  fileName: string;
  headers: string[];
  rows: string[][];
  mapping: Partial<Record<FieldKey, string>>;
  restored: boolean;
  target: FileTarget;
  tick: number;
  onChange: (field: FieldKey, header: string) => void;
  onConfirm: () => void;
}) {
  const problem = mappingError(mapping);
  const purpose =
    target === "reference"
      ? "سيصبح المرجع"
      : target === "xfer-dest"
        ? "الكشف الذي تبقى أسماؤه"
        : target === "xfer-source"
          ? "مصدر الأعمدة والقيم"
          : "كشف للمقارنة";
  const confirm =
    target === "xfer-dest" ? "التالي: كشف الأعمدة" : target === "xfer-source" ? "اختيار الأعمدة" : "متابعة";
  return (
    <>
      <section className="rounded-lg border border-border bg-surface p-4">
        <h2 className="font-semibold">{fileName}</h2>
        <p className="mt-1 text-sm text-muted">
          <span className="num">{rows.length}</span> صف · {purpose}
          {restored ? " · استُعيد ربط سابق لهذا الشكل" : ""}
        </p>
      </section>
      <div className="flex flex-col gap-3" data-tick={tick}>
        {FIELD_ORDER.map((field) => (
          <label key={field} className="flex flex-col gap-1 text-sm">
            <span className="text-muted">{FIELD_LABEL[field]}</span>
            <select
              className="min-h-11 rounded-md border border-border bg-surface-2 px-3 text-fg"
              value={mapping[field] ?? ""}
              onChange={(event) => onChange(field, event.target.value)}
            >
              <option value="">بدون</option>
              {headers.map((header) => (
                <option key={header} value={header}>
                  {header}
                </option>
              ))}
            </select>
          </label>
        ))}
      </div>
      {problem && <p className="text-sm text-danger">{problem}</p>}
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="bg-surface-2 text-muted">
            <tr>
              {headers.slice(0, 4).map((header) => (
                <th key={header} className="px-3 py-2 text-start font-medium">
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, 3).map((row, index) => (
              <tr key={index} className="border-t border-border">
                {headers.slice(0, 4).map((header, cell) => (
                  <td key={header} className="max-w-40 truncate px-3 py-2">
                    {row[cell]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Button variant="primary" full disabled={Boolean(problem)} onClick={onConfirm}>
        {confirm}
      </Button>
    </>
  );
}

function ColumnsView({
  destName,
  sourceName,
  destCount,
  sourceCount,
  destHeaders,
  links,
  tick,
  onLink,
  onRename,
  onRun,
}: {
  destName: string;
  sourceName: string;
  destCount: number;
  sourceCount: number;
  destHeaders: string[];
  links: { sourceHeader: string; action: "skip" | "fill" | "add"; destHeader: string }[];
  tick: number;
  onLink: (sourceHeader: string, value: string) => void;
  onRename: (sourceHeader: string, destHeader: string) => void;
  onRun: () => void;
}) {
  const added = links.filter((link) => link.action === "add").length;
  const filled = links.filter((link) => link.action === "fill").length;
  return (
    <div data-tick={tick} className="flex flex-col gap-4">
      <section className="rounded-lg border border-border bg-surface p-4">
        <h2 className="font-semibold">من {sourceName}</h2>
        <p className="mt-1 text-sm text-muted">
          إلى {destName}. الكشف الأول <span className="num">{destCount}</span> صفاً، والثاني{" "}
          <span className="num">{sourceCount}</span>. الأسماء الزائدة لن تُضاف.
        </p>
        <p className="mt-2 text-sm text-muted">
          <span className="num">{filled}</span> عمود للتعبئة · <span className="num">{added}</span> عمود جديد. الخانة الممتلئة لا تُستبدل.
        </p>
      </section>
      {links.map((link) => (
        <label key={link.sourceHeader} className="flex flex-col gap-2 rounded-lg border border-border bg-surface p-4 text-sm">
          <span className="font-medium">{link.sourceHeader}</span>
          <select
            className="min-h-11 rounded-md border border-border bg-surface-2 px-3 text-fg"
            value={link.action === "fill" ? `fill:${link.destHeader}` : link.action}
            onChange={(event) => onLink(link.sourceHeader, event.target.value)}
          >
            <option value="skip">لا تنقل</option>
            <option value="add">عمود جديد</option>
            {destHeaders.map((header) => (
              <option key={header} value={`fill:${header}`}>
                تعبئة الفارغ في «{header}»
              </option>
            ))}
          </select>
          {link.action === "add" && (
            <input
              className="min-h-11 rounded-md border border-border bg-surface-2 px-3 text-fg"
              value={link.destHeader}
              aria-label={`اسم العمود الجديد لـ ${link.sourceHeader}`}
              onChange={(event) => onRename(link.sourceHeader, event.target.value)}
            />
          )}
        </label>
      ))}
      <Button variant="primary" full onClick={onRun}>
        نقل إلى الكشف الأول
      </Button>
    </div>
  );
}

function ReviewView({
  fileName,
  kept,
  issues,
  page,
  onPage,
  onSave,
}: {
  fileName: string;
  kept: number;
  issues: RowIssue[];
  page: number;
  onPage: (page: number) => void;
  onSave: () => void;
}) {
  const errors = issues.filter((issue) => issue.findings.some((f) => f.severity === "error")).length;
  const warnings = issues.length - errors;
  const slice = issues.slice((page - 1) * PAGE, page * PAGE);
  return (
    <>
      <section className="rounded-lg border border-border bg-surface p-4">
        <h2 className="font-semibold">{fileName}</h2>
        <p className="mt-2 text-sm text-muted">يمكن الحفظ رغم الملاحظات. بعد الحفظ لا يُعدَّل المرجع إلا بالاستبدال الكامل.</p>
      </section>
      <div className="grid grid-cols-3 gap-3">
        <Stat label="سيُحفظ" value={kept} />
        <Stat label="أخطاء" value={errors} warn={errors > 0} />
        <Stat label="تنبيهات" value={warnings} />
      </div>
      {issues.length === 0 && <p className="rounded-lg border border-border bg-surface p-4 text-sm">لا ملاحظات على المرجع.</p>}
      {slice.map((issue) => (
        <article key={`${issue.n}-${issue.findings[0]?.code}`} className="rounded-lg border border-border bg-surface p-4">
          <p className="text-sm">
            صف <span className="num">{issue.n}</span>
            {issue.nameRaw ? ` · ${issue.nameRaw}` : ""}
          </p>
          {issue.idNumber && <p className="num mt-1 text-sm text-muted">{issue.idNumber}</p>}
          <ul className="mt-2 flex flex-col gap-1 text-sm">
            {issue.findings.map((finding) => (
              <li key={finding.code + finding.message} className={tone(finding.severity)}>
                {finding.message}
              </li>
            ))}
          </ul>
        </article>
      ))}
      <Pager page={page} total={issues.length} onPage={onPage} />
      <Button variant="primary" full onClick={onSave}>
        حفظ المرجع على الجهاز
      </Button>
    </>
  );
}

function PickView({ fileName, count, onAudit, onEnrich }: { fileName: string; count: number; onAudit: () => void; onEnrich: () => void }) {
  return (
    <>
      <section className="rounded-lg border border-border bg-surface p-4">
        <h2 className="font-semibold">{fileName}</h2>
        <p className="mt-1 text-sm text-muted">
          <span className="num">{count}</span> صف. اختر مهمة واحدة. لا يُكتب شيء في المرجع.
        </p>
      </section>
      <button className="rounded-lg border border-border bg-surface p-4 text-start" onClick={onAudit}>
        <span className="block font-semibold">التدقيق واكتشاف الأخطاء</span>
        <span className="mt-1 block text-sm text-muted">تعارض الهوية مع الاسم، حقول ناقصة، تكرار، وأسماء لا أصل لها.</span>
      </button>
      <button className="rounded-lg border border-border bg-surface p-4 text-start" onClick={onEnrich}>
        <span className="block font-semibold">استكمال البيانات الناقصة</span>
        <span className="mt-1 block text-sm text-muted">يُقترح ملء الخلايا الفارغة فقط، بعد عرض درجة الثقة.</span>
      </button>
    </>
  );
}

function WorkView({ label, done, total }: { label: string; done: number; total: number }) {
  const pct = total > 0 ? Math.min(100, Math.round((done / total) * 100)) : 8;
  return (
    <section className="rounded-lg border border-border bg-surface p-5">
      <h2 className="font-semibold">{label}</h2>
      <p className="mt-1 text-sm text-muted">المعالجة على هذا الجهاز. أبقِ الصفحة مفتوحة.</p>
      <div className="mt-4 h-2 overflow-hidden rounded-full bg-surface-2">
        <div className="h-full bg-primary transition-all duration-200" style={{ width: `${pct}%` }} />
      </div>
      <p className="num mt-2 text-sm text-muted">{pct}%</p>
    </section>
  );
}

function AuditView({
  rows,
  total,
  counts,
  filter,
  page,
  onFilter,
  onPage,
  onExport,
  onEnrich,
}: {
  rows: AuditRow[];
  total: number;
  counts: Record<AuditLevel, number>;
  filter: string;
  page: number;
  onFilter: (value: string) => void;
  onPage: (page: number) => void;
  onExport: () => void;
  onEnrich: () => void;
}) {
  const slice = rows.slice((page - 1) * PAGE, page * PAGE);
  const filters = [
    { id: "all", label: "الكل", count: total },
    { id: "error", label: "أخطاء", count: counts.error },
    { id: "warning", label: "تنبيهات", count: counts.warning },
    { id: "info", label: "ملاحظات", count: counts.info },
    { id: "ok", label: "سليم", count: counts.ok },
  ];
  return (
    <>
      <FilterRow filters={filters} current={filter} onFilter={onFilter} />
      {slice.length === 0 && <p className="text-sm text-muted">لا صفوف في هذا التصنيف.</p>}
      {slice.map((row) => (
        <article key={row.n} className="rounded-lg border border-border bg-surface p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-medium">{row.nameRaw || "بدون اسم"}</p>
              <p className="mt-1 text-sm text-muted">
                صف <span className="num">{row.n}</span>
                {row.idNumber && (
                  <>
                    {" "}
                    · <span className="num">{row.idNumber}</span>
                  </>
                )}
              </p>
            </div>
            <span className={cn("text-sm font-medium", tone(row.worst))}>{LEVEL_LABEL[row.worst]}</span>
          </div>
          {row.findings.length > 0 && (
            <ul className="mt-3 flex flex-col gap-1 text-sm">
              {row.findings.map((finding) => (
                <li key={finding.code + finding.message} className={tone(finding.severity)}>
                  {finding.message}
                </li>
              ))}
            </ul>
          )}
        </article>
      ))}
      <Pager page={page} total={rows.length} onPage={onPage} />
      <Button variant="primary" full onClick={onExport}>
        <Download className="size-4" />
        تنزيل تقرير التدقيق
      </Button>
      <Button variant="surface" full onClick={onEnrich}>
        انتقل إلى الاستكمال بنفس الكشف
      </Button>
    </>
  );
}

function EnrichView({
  rows,
  total,
  counts,
  all,
  filter,
  page,
  tick,
  onFilter,
  onPage,
  onToggle,
  onChoose,
  onProbable,
  onExport,
  onAudit,
}: {
  rows: EnrichRow[];
  total: number;
  counts: Record<EnrichStatus, number>;
  all: EnrichRow[];
  filter: string;
  page: number;
  tick: number;
  onFilter: (value: string) => void;
  onPage: (page: number) => void;
  onToggle: (row: EnrichRow, key: string) => void;
  onChoose: (row: EnrichRow, refN: number) => void;
  onProbable: (on: boolean) => void;
  onExport: () => void;
  onAudit: () => void;
}) {
  const slice = rows.slice((page - 1) * PAGE, page * PAGE);
  const selected = all.reduce((sum, row) => sum + row.fills.filter((fill) => fill.on).length, 0);
  const filters = [
    { id: "all", label: "الكل", count: total },
    { id: "exact", label: "قطعي", count: counts.exact },
    { id: "probable", label: "مرجّح", count: counts.probable },
    { id: "ambiguous", label: "غامض", count: counts.ambiguous },
    { id: "conflict", label: "تعارض", count: counts.conflict },
    { id: "new", label: "جديد", count: counts.new },
  ];
  return (
    <div data-tick={tick} className="flex flex-col gap-4">
      <FilterRow filters={filters} current={filter} onFilter={onFilter} />
      <p className="text-sm text-muted">
        سيُكتب <span className="num">{selected}</span> حقلاً فارغاً. الموجود أصلاً لا يُستبدل.
      </p>
      {counts.probable > 0 && (
        <Button variant="surface" full onClick={() => onProbable(true)}>
          اعتماد الحقول المرجّحة أيضاً
        </Button>
      )}
      {slice.length === 0 && <p className="text-sm text-muted">لا صفوف في هذا التصنيف.</p>}
      {slice.map((row) => (
        <article key={row.n} className="rounded-lg border border-border bg-surface p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-medium">{row.nameRaw || "بدون اسم"}</p>
              <p className="mt-1 text-sm text-muted">
                صف <span className="num">{row.n}</span>
                {row.idNumber && (
                  <>
                    {" "}
                    · <span className="num">{row.idNumber}</span>
                  </>
                )}
              </p>
            </div>
            <span className={cn("text-sm font-medium", tone(row.status))}>{STATUS_LABEL[row.status]}</span>
          </div>
          {row.via && <p className="mt-2 text-sm text-muted">{row.via}</p>}
          {row.candidates.length > 0 && (
            <div className="mt-3 flex flex-col gap-2">
              {row.candidates.map((candidate) => (
                <button
                  key={candidate.n}
                  className={cn(
                    "rounded-md border px-3 py-2 text-start text-sm",
                    row.refN === candidate.n ? "border-primary bg-surface-2" : "border-border",
                  )}
                  onClick={() => onChoose(row, candidate.n)}
                >
                  <span className="block">{candidate.nameRaw}</span>
                  <span className="num text-muted">{candidate.idNumber}</span>
                </button>
              ))}
            </div>
          )}
          {row.fills.length > 0 && (
            <ul className="mt-3 flex flex-col gap-2">
              {row.fills.map((fill) => (
                <li key={fill.key}>
                  <label className="flex min-h-11 items-center gap-3 text-sm">
                    <input type="checkbox" checked={fill.on} onChange={() => onToggle(row, fill.key)} />
                    <span>
                      {fill.label}: <span className="num">{fill.value}</span>
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          )}
        </article>
      ))}
      <Pager page={page} total={rows.length} onPage={onPage} />
      <Button variant="primary" full onClick={onExport}>
        <Download className="size-4" />
        تنزيل الكشف المستكمل
      </Button>
      <Button variant="surface" full onClick={onAudit}>
        انتقل إلى التدقيق بنفس الكشف
      </Button>
    </div>
  );
}

function TransferView({
  rows,
  total,
  counts,
  all,
  skipped,
  filter,
  page,
  tick,
  onFilter,
  onPage,
  onToggle,
  onChoose,
  onProbable,
  onExport,
}: {
  rows: TransferRow[];
  total: number;
  counts: Record<EnrichStatus, number>;
  all: TransferRow[];
  skipped: number;
  filter: string;
  page: number;
  tick: number;
  onFilter: (value: string) => void;
  onPage: (page: number) => void;
  onToggle: (row: TransferRow, sourceHeader: string) => void;
  onChoose: (row: TransferRow, sourceN: number) => void;
  onProbable: (on: boolean) => void;
  onExport: () => void;
}) {
  const slice = rows.slice((page - 1) * PAGE, page * PAGE);
  const selected = all.reduce((sum, row) => sum + row.cells.filter((cell) => cell.on).length, 0);
  const filters = [
    { id: "all", label: "الكل", count: total },
    { id: "exact", label: "قطعي", count: counts.exact },
    { id: "probable", label: "مرجّح", count: counts.probable },
    { id: "ambiguous", label: "غامض", count: counts.ambiguous },
    { id: "new", label: "بلا مقابل", count: counts.new },
  ];
  return (
    <div data-tick={tick} className="flex flex-col gap-4">
      <section className="rounded-lg border border-border bg-surface p-4 text-sm">
        <p>
          سيُكتب <span className="num">{selected}</span> خانة. عدد الصفوف يبقى <span className="num">{total}</span>.
        </p>
        <p className="mt-1 text-muted">
          <span className="num">{skipped}</span> اسماً في الكشف الثاني لن تُضاف.
        </p>
      </section>
      <FilterRow filters={filters} current={filter} onFilter={onFilter} />
      {counts.probable > 0 && (
        <Button variant="surface" full onClick={() => onProbable(true)}>
          اعتماد الخانات المرجّحة أيضاً
        </Button>
      )}
      {slice.length === 0 && <p className="text-sm text-muted">لا صفوف في هذا التصنيف.</p>}
      {slice.map((row) => (
        <article key={row.n} className="rounded-lg border border-border bg-surface p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-medium">{row.nameRaw || "بدون اسم"}</p>
              <p className="mt-1 text-sm text-muted">
                صف <span className="num">{row.n}</span>
                {row.idNumber && (
                  <>
                    {" "}
                    · <span className="num">{row.idNumber}</span>
                  </>
                )}
              </p>
            </div>
            <span className={cn("text-sm font-medium", tone(row.status))}>{STATUS_LABEL[row.status]}</span>
          </div>
          {row.via && <p className="mt-2 text-sm text-muted">{row.via}</p>}
          {row.candidates.length > 1 && (
            <div className="mt-3 flex flex-col gap-2">
              {row.candidates.map((candidate) => (
                <button
                  key={candidate.n}
                  className={cn(
                    "rounded-md border px-3 py-2 text-start text-sm",
                    row.sourceN === candidate.n ? "border-primary bg-surface-2" : "border-border",
                  )}
                  onClick={() => onChoose(row, candidate.n)}
                >
                  <span className="block">{candidate.nameRaw}</span>
                  <span className="num text-muted">{candidate.idNumber}</span>
                </button>
              ))}
            </div>
          )}
          {row.cells.length > 0 && (
            <ul className="mt-3 flex flex-col gap-2">
              {row.cells.map((cell) => (
                <li key={cell.sourceHeader}>
                  <label className="flex min-h-11 items-center gap-3 text-sm">
                    <input type="checkbox" checked={cell.on} onChange={() => onToggle(row, cell.sourceHeader)} />
                    <span>
                      {cell.added ? "عمود جديد" : "تعبئة"} · {cell.header}: <span className="num">{cell.value}</span>
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          )}
          {row.cells.length === 0 && row.status === "exact" && <p className="mt-2 text-sm text-muted">لا خانة فارغة تُنقل.</p>}
        </article>
      ))}
      <Pager page={page} total={rows.length} onPage={onPage} />
      <Button variant="primary" full onClick={onExport}>
        <Download className="size-4" />
        تنزيل الكشف بعد النقل
      </Button>
    </div>
  );
}

function BrowseView({
  rows,
  query,
  page,
  onQuery,
  onPage,
}: {
  rows: { n: number; nameRaw: string; idNumber: string }[];
  query: string;
  page: number;
  onQuery: (value: string) => void;
  onPage: (page: number) => void;
}) {
  const slice = rows.slice((page - 1) * PAGE, page * PAGE);
  return (
    <>
      <p className="rounded-lg border border-border bg-surface px-4 py-3 text-sm text-primary">للقراءة فقط. لا تعديل من هنا.</p>
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-muted">بحث بالاسم أو الهوية</span>
        <input
          className="min-h-11 rounded-md border border-border bg-surface-2 px-3 text-fg"
          value={query}
          onChange={(event) => {
            onQuery(event.target.value);
            onPage(1);
          }}
        />
      </label>
      <p className="text-sm text-muted">
        <span className="num">{rows.length}</span> صف
      </p>
      {slice.map((row) => (
        <article key={row.n} className="rounded-lg border border-border bg-surface px-4 py-3">
          <p className="font-medium">{row.nameRaw || "بدون اسم"}</p>
          <p className="num mt-1 text-sm text-muted">{row.idNumber || "—"}</p>
        </article>
      ))}
      {rows.length === 0 && <p className="text-sm text-muted">لا نتائج.</p>}
      <Pager page={page} total={rows.length} onPage={onPage} />
    </>
  );
}

function Stat({ label, value, warn }: { label: string; value: number; warn?: boolean }) {
  return (
    <div className="rounded-lg border border-border bg-surface p-3">
      <p className="text-xs text-muted">{label}</p>
      <p className={cn("num mt-1 text-xl font-semibold", warn && "text-danger")}>{value}</p>
    </div>
  );
}

function FilterRow({
  filters,
  current,
  onFilter,
}: {
  filters: { id: string; label: string; count: number }[];
  current: string;
  onFilter: (value: string) => void;
}) {
  return (
    <div className="flex w-full min-w-0 gap-2 overflow-x-auto pb-1">
      {filters.map((item) => (
        <button
          key={item.id}
          className={cn(
            "min-h-11 shrink-0 rounded-full border px-3 text-sm",
            current === item.id ? "border-primary bg-surface-2 text-fg" : "border-border text-muted",
          )}
          onClick={() => onFilter(item.id)}
        >
          {item.label} <span className="num">{item.count}</span>
        </button>
      ))}
    </div>
  );
}

function Pager({ page, total, onPage }: { page: number; total: number; onPage: (page: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / PAGE));
  if (pages <= 1) return null;
  return (
    <div className="flex items-center justify-between gap-3">
      <Button variant="surface" disabled={page <= 1} onClick={() => onPage(page - 1)}>
        السابق
      </Button>
      <span className="num text-sm text-muted">
        {page} / {pages}
      </span>
      <Button variant="surface" disabled={page >= pages} onClick={() => onPage(page + 1)}>
        التالي
      </Button>
    </div>
  );
}
