export type LogLevel = "debug" | "info" | "warn" | "error";

export interface ClientLog {
  id?: number;
  ts_utc: string;
  level: LogLevel;
  module: string;
  message: string;
  context: unknown;
  exc_text: string | null;
}

const DB_NAME = "blueprint_logs";
const STORE = "logs";
const VERSION = 1;

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE)) {
          db.createObjectStore(STORE, { keyPath: "id", autoIncrement: true });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }
  return dbPromise;
}

export async function log(
  level: LogLevel,
  module: string,
  message: string,
  context?: unknown,
): Promise<void> {
  const entry: ClientLog = {
    ts_utc: new Date().toISOString(),
    level,
    module,
    message,
    context: context ?? null,
    exc_text: null,
  };
  const consoleMethod = level === "debug" ? "log" : level;
  console[consoleMethod](`[${module}] ${message}`, context ?? "");
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).add(entry);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (error) {
    console.warn("日志写入 IndexedDB 失败", error);
  }
}

export async function queryLogs(
  start: string,
  end: string,
  level: string,
): Promise<ClientLog[]> {
  const db = await openDb();
  const all = await new Promise<ClientLog[]>((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const request = tx.objectStore(STORE).getAll();
    request.onsuccess = () => resolve(request.result as ClientLog[]);
    request.onerror = () => reject(request.error);
  });
  return all
    .filter((item) => item.ts_utc >= start && item.ts_utc <= end)
    .filter((item) => level === "all" || item.level === level)
    .sort((a, b) => a.ts_utc.localeCompare(b.ts_utc));
}

export function downloadJson(filename: string, data: unknown): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}
