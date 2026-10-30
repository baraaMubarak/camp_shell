export type FieldKey =
  | "idNumber"
  | "fullName"
  | "firstName"
  | "fatherName"
  | "grandfatherName"
  | "familyName"
  | "wifeName"
  | "birthDate"
  | "phone"
  | "phone2"
  | "notes";

export type Mapping = Partial<Record<FieldKey, string>>;

export type Severity = "error" | "warning" | "info";

export type Finding = {
  severity: Severity;
  code: string;
  message: string;
};

export type Person = {
  n: number;
  idRaw: string;
  idNumber: string;
  nameRaw: string;
  nameNorm: string;
  tokens: string[];
  first: string;
  family: string;
  wifeNorm: string;
  birthRaw: string;
  birthIso: string;
  phoneRaw: string;
  phoneNorm: string;
  phone2Raw: string;
  phone2Norm: string;
  raw: Record<string, string>;
  structural: Finding[];
};

export type AuditLevel = "error" | "warning" | "info" | "ok";

export type AuditRow = {
  n: number;
  idNumber: string;
  nameRaw: string;
  findings: Finding[];
  worst: AuditLevel;
};

export type EnrichStatus = "exact" | "probable" | "ambiguous" | "conflict" | "new" | "empty";

export type Fill = {
  key: FieldKey;
  label: string;
  header: string;
  value: string;
  on: boolean;
};

export type Candidate = {
  n: number;
  nameRaw: string;
  idNumber: string;
  score: number;
};

export type EnrichRow = {
  n: number;
  idNumber: string;
  nameRaw: string;
  status: EnrichStatus;
  via: string;
  score: number;
  refN: number | null;
  candidates: Candidate[];
  fills: Fill[];
  findings: Finding[];
};

export type RowIssue = {
  n: number;
  idNumber: string;
  nameRaw: string;
  findings: Finding[];
};

export type ReferenceMeta = {
  key: "reference";
  fileName: string;
  importedAt: string;
  rowCount: number;
  issueCount: number;
  headers: string[];
  mapping: Mapping;
};

export type ColumnAction = "skip" | "fill" | "add";

export type ColumnLink = {
  sourceHeader: string;
  action: ColumnAction;
  destHeader: string;
};

export type TransferCell = {
  sourceHeader: string;
  header: string;
  value: string;
  on: boolean;
  added: boolean;
};

export type TransferRow = {
  n: number;
  idNumber: string;
  nameRaw: string;
  status: EnrichStatus;
  via: string;
  score: number;
  sourceN: number | null;
  candidates: Candidate[];
  cells: TransferCell[];
};
