import type { Mapping, Person, ReferenceMeta } from "./types.ts";

const DB_NAME = "mudaqqiq";
const DB_VERSION = 1;

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains("records")) db.createObjectStore("records", { keyPath: "n" });
      if (!db.objectStoreNames.contains("meta")) db.createObjectStore("meta", { keyPath: "key" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("تعذر فتح التخزين المحلي"));
  });
}

function request<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("فشل التخزين المحلي"));
  });
}

export async function loadMeta(): Promise<ReferenceMeta | null> {
  const db = await openDb();
  try {
    const tx = db.transaction("meta", "readonly");
    const row = await request(tx.objectStore("meta").get("reference"));
    return (row as ReferenceMeta | undefined) ?? null;
  } finally {
    db.close();
  }
}

export async function loadRecords(): Promise<Person[]> {
  const db = await openDb();
  try {
    const tx = db.transaction("records", "readonly");
    const rows = await request(tx.objectStore("records").getAll());
    return (rows as Person[]).sort((a, b) => a.n - b.n);
  } finally {
    db.close();
  }
}

export async function saveReference(input: {
  fileName: string;
  headers: string[];
  mapping: Mapping;
  people: Person[];
  issueCount: number;
}) {
  const db = await openDb();
  try {
    const clearTx = db.transaction(["records", "meta"], "readwrite");
    clearTx.objectStore("records").clear();
    clearTx.objectStore("meta").delete("reference");
    await new Promise<void>((resolve, reject) => {
      clearTx.oncomplete = () => resolve();
      clearTx.onerror = () => reject(clearTx.error);
    });
    const chunk = 400;
    for (let i = 0; i < input.people.length; i += chunk) {
      const tx = db.transaction("records", "readwrite");
      const store = tx.objectStore("records");
      for (const person of input.people.slice(i, i + chunk)) store.put(person);
      await new Promise<void>((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    }
    const meta: ReferenceMeta = {
      key: "reference",
      fileName: input.fileName,
      importedAt: new Date().toISOString(),
      rowCount: input.people.length,
      issueCount: input.issueCount,
      headers: input.headers,
      mapping: input.mapping,
    };
    const metaTx = db.transaction("meta", "readwrite");
    metaTx.objectStore("meta").put(meta);
    await new Promise<void>((resolve, reject) => {
      metaTx.oncomplete = () => resolve();
      metaTx.onerror = () => reject(metaTx.error);
    });
  } finally {
    db.close();
  }
}

export async function clearReference() {
  const db = await openDb();
  try {
    const tx = db.transaction(["records", "meta"], "readwrite");
    tx.objectStore("records").clear();
    tx.objectStore("meta").delete("reference");
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}
