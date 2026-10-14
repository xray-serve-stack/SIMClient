import { getDb, STORE_SERVES } from "./chatRepository";

/**
 * A Serve device the Client knows about.
 *
 * `id` is the internal DB relationship key (auto-increment). It is NOT the
 * cryptographic identity. The cryptographic identity is `public_key`.
 *
 * `device_name` is human-readable and unique across all Serves. It exists
 * only for UI disambiguation.
 */
export interface Serve {
  id?: number;
  public_key: string;
  device_name: string;
  /** Unix epoch milliseconds; last time this Serve was known online. */
  last_online?: number;
}

function runRequest<T>(
  db: IDBDatabase,
  storeName: string,
  mode: IDBTransactionMode,
  operation: (tx: IDBTransaction) => IDBRequest<T>,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction(storeName, mode);
    const req = operation(tx);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

function runTransaction(
  db: IDBDatabase,
  storeName: string,
  mode: IDBTransactionMode,
  operation: (tx: IDBTransaction) => void,
): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(storeName, mode);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
    try {
      operation(tx);
    } catch (err) {
      try {
        tx.abort();
      } catch {
        /* ignore */
      }
      reject(err);
    }
  });
}

// A typed error so callers can distinguish "duplicate serve" from "DB failed".
export class DuplicateServeError extends Error {
  constructor(
    public readonly reason: "device_name" | "public_key",
    message: string,
  ) {
    super(message);
    this.name = "DuplicateServeError";
  }
}

function normalizePublicKey(key: string): string {
  return key.trim();
}

function normalizeDeviceName(name: string): string {
  return name.trim();
}

export async function listServes(): Promise<Serve[]> {
  const db = await getDb();
  const result = await runRequest<Serve[]>(
    db,
    STORE_SERVES,
    "readonly",
    (tx) => tx.objectStore(STORE_SERVES).getAll() as IDBRequest<Serve[]>,
  );
  return result;
}

export async function getServeById(id: number): Promise<Serve | undefined> {
  const db = await getDb();
  return await runRequest<Serve | undefined>(
    db,
    STORE_SERVES,
    "readonly",
    (tx) =>
      tx.objectStore(STORE_SERVES).get(id) as IDBRequest<Serve | undefined>,
  );
}

async function findByIndex(
  indexName: "by_device_name" | "by_public_key",
  value: string,
): Promise<Serve | undefined> {
  const db = await getDb();
  return await runRequest<Serve | undefined>(
    db,
    STORE_SERVES,
    "readonly",
    (tx) =>
      tx.objectStore(STORE_SERVES).index(indexName).get(value) as IDBRequest<
        Serve | undefined
      >,
  );
}

export function findServeByDeviceName(
  name: string,
): Promise<Serve | undefined> {
  return findByIndex("by_device_name", normalizeDeviceName(name));
}

export function findServeByPublicKey(key: string): Promise<Serve | undefined> {
  return findByIndex("by_public_key", normalizePublicKey(key));
}

/**
 * Create a new Serve. Both `public_key` and `device_name` must be unique.
 */
export async function createServe(input: {
  public_key: string;
  device_name: string;
}): Promise<Serve> {
  const public_key = normalizePublicKey(input.public_key);
  const device_name = normalizeDeviceName(input.device_name);

  if (!public_key) throw new Error("public_key is required");
  if (!device_name) throw new Error("device_name is required");

  const existingName = await findServeByDeviceName(device_name);
  if (existingName) {
    throw new DuplicateServeError(
      "device_name",
      `device_name already in use: ${device_name}`,
    );
  }
  const existingKey = await findServeByPublicKey(public_key);
  if (existingKey) {
    throw new DuplicateServeError("public_key", `public_key already in use`);
  }

  const db = await getDb();
  const id = await new Promise<number>((resolve, reject) => {
    const tx = db.transaction(STORE_SERVES, "readwrite");
    const store = tx.objectStore(STORE_SERVES);
    const req = store.add({ public_key, device_name });
    req.onsuccess = () => resolve(req.result as number);
    req.onerror = () => {
      const err = req.error;
      if (err && err.name === "ConstraintError") {
        reject(
          new DuplicateServeError("device_name", "unique constraint violated"),
        );
        return;
      }
      reject(err);
    };
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });

  return { id, public_key, device_name };
}

/**
 * Rename a Serve. The new name must be unique across all Serves.
 */
export async function renameServe(id: number, newName: string): Promise<Serve> {
  const device_name = normalizeDeviceName(newName);
  if (!device_name) throw new Error("device_name is required");

  const existing = await getServeById(id);
  if (!existing) throw new Error(`Serve not found: ${id}`);

  if (existing.device_name === device_name) return existing;

  const clash = await findServeByDeviceName(device_name);
  if (clash && clash.id !== id) {
    throw new DuplicateServeError(
      "device_name",
      `device_name already in use: ${device_name}`,
    );
  }

  const db = await getDb();
  await runTransaction(db, STORE_SERVES, "readwrite", (tx) => {
    tx.objectStore(STORE_SERVES).put({ ...existing, device_name });
  });
  return { ...existing, device_name };
}

export async function deleteServe(id: number): Promise<void> {
  const db = await getDb();
  await runTransaction(db, STORE_SERVES, "readwrite", (tx) => {
    tx.objectStore(STORE_SERVES).delete(id);
  });
}
