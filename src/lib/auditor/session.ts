import type { AuditRow, ColumnLink, EnrichRow, Mapping, Person, RowIssue, TransferRow } from "./types";

export type FileTarget = "reference" | "sheet" | "xfer-dest" | "xfer-source";

export type ParsedFile = {
  fileName: string;
  headers: string[];
  rows: string[][];
  mapping: Mapping;
  target: FileTarget;
  restored: boolean;
};

export type PendingRef = {
  fileName: string;
  headers: string[];
  mapping: Mapping;
  people: Person[];
  issues: RowIssue[];
};

export type SheetJob = {
  fileName: string;
  headers: string[];
  mapping: Mapping;
  people: Person[];
  audit: AuditRow[] | null;
  enrich: EnrichRow[] | null;
};

export type TransferSide = {
  fileName: string;
  headers: string[];
  mapping: Mapping;
  people: Person[];
};

export type TransferJob = {
  dest: TransferSide;
  source: TransferSide | null;
  links: ColumnLink[];
  rows: TransferRow[] | null;
  skippedSource: number;
};

export const session: {
  parsed: ParsedFile | null;
  pendingRef: PendingRef | null;
  sheet: SheetJob | null;
  refs: Person[];
  refMapping: Mapping;
  transfer: TransferJob | null;
} = {
  parsed: null,
  pendingRef: null,
  sheet: null,
  refs: [],
  refMapping: {},
  transfer: null,
};
