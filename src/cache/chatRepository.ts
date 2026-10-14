import type { Contact, Conversation, PersistedMessage, Sim } from "@/types";

const DB_NAME = "simclient";

/**
 * Schema version. Bump this to force a full rebuild on next startup.
 *
 * Version 10 replaces the conversation-bucket `messages` store
 * (`keyPath: ["serveId","number"]`, holding `messages: Message[]`) with a
 * per-message store (`keyPath: ["serveId","number","timestamp"]`, one
 * record per Android SMS message). IndexedDB does not allow changing an
 * existing store's key path in place; the project's established policy is
 * a full-DB rebuild, which `openChatDbOnce` performs when the version
 * differs.
 */
export const EXPECTED_DB_VERSION = 1;

export const STORE_SIMS = "sims";
export const STORE_CONVERSATIONS = "conversations";
export const STORE_MESSAGES = "messages";
export const STORE_CONTACTS = "contacts";
export const STORE_SERVES = "serves";
export const STORE_META = "meta";

/**
 * Demo Serve identity.
 */
export const DEMO_SERVE_DEVICE_NAME = "Demo Phone";
export const DEMO_SERVE_PUBLIC_KEY =
  "u55UvQamMEansmY5G2C/SF9qjcKlSVdIbTiCXbjudyA=";

function createSchema(db: IDBDatabase): void {
  if (!db.objectStoreNames.contains(STORE_SIMS)) {
    const store = db.createObjectStore(STORE_SIMS, {
      keyPath: ["serveId", "subscription_id"],
    });
    store.createIndex("by_serve", "serveId", { unique: false });
  }
  if (!db.objectStoreNames.contains(STORE_CONVERSATIONS)) {
    const store = db.createObjectStore(STORE_CONVERSATIONS, {
      keyPath: ["serveId", "number"],
    });
    store.createIndex("by_serve", "serveId", { unique: false });
  }
  if (!db.objectStoreNames.contains(STORE_MESSAGES)) {
    const store = db.createObjectStore(STORE_MESSAGES, {
      keyPath: ["serveId", "number", "timestamp"],
    });
    store.createIndex("by_serve", "serveId", { unique: false });
    store.createIndex("by_serve_number", ["serveId", "number"], {
      unique: false,
    });
  }
  if (!db.objectStoreNames.contains(STORE_CONTACTS)) {
    const store = db.createObjectStore(STORE_CONTACTS, { keyPath: "id" });
    store.createIndex("by_serve", "serveId", { unique: false });
    store.createIndex("by_serve_number", ["serveId", "number"], {
      unique: true,
    });
  }
  if (!db.objectStoreNames.contains(STORE_SERVES)) {
    const store = db.createObjectStore(STORE_SERVES, {
      keyPath: "id",
      autoIncrement: true,
    });
    store.createIndex("by_public_key", "public_key", { unique: true });
    store.createIndex("by_device_name", "device_name", { unique: true });
  }
  if (!db.objectStoreNames.contains(STORE_META)) {
    db.createObjectStore(STORE_META, { keyPath: "key" });
  }
}

export interface OpenChatDbResult {
  db: IDBDatabase;
  created: boolean;
}
export interface PreRebuildSnapshot {
  clientPrivateKey?: string;
  clientPublicKey?: string;
  serves: Array<{ device_name: string; public_key: string }>;
}

export async function __snapshotForRebuild(
  db: IDBDatabase,
): Promise<PreRebuildSnapshot> {
  const snapshot: PreRebuildSnapshot = { serves: [] };

  try {
    const metaTx = db.transaction(STORE_META, "readonly");
    const metaStore = metaTx.objectStore(STORE_META);

    const priv = await new Promise<string | undefined>((resolve) => {
      const req = metaStore.get("CLIENT_PRIVATE_KEY") as IDBRequest<
        { key: string; value: string } | undefined
      >;
      req.onsuccess = () => resolve(req.result?.value);
      req.onerror = () => resolve(undefined);
    });
    const pub = await new Promise<string | undefined>((resolve) => {
      const req = metaStore.get("CLIENT_PUBLIC_KEY") as IDBRequest<
        { key: string; value: string } | undefined
      >;
      req.onsuccess = () => resolve(req.result?.value);
      req.onerror = () => resolve(undefined);
    });

    snapshot.clientPrivateKey = priv;
    snapshot.clientPublicKey = pub;
  } catch (error) {
    console.warn("[chatRepository] pre-rebuild meta snapshot failed:", error);
  }

  try {
    const servesTx = db.transaction(STORE_SERVES, "readonly");
    const servesStore = servesTx.objectStore(STORE_SERVES);

    const all = await new Promise<
      Array<{ id?: number; device_name: string; public_key: string }>
    >((resolve) => {
      const req = servesStore.getAll() as IDBRequest<
        Array<{ id?: number; device_name: string; public_key: string }>
      >;
      req.onsuccess = () => resolve(req.result ?? []);
      req.onerror = () => resolve([]);
    });

    snapshot.serves = all
      .filter((s) => s.id !== 1)
      .map((s) => ({
        device_name: s.device_name,
        public_key: s.public_key,
      }));
  } catch (error) {
    console.warn("[chatRepository] pre-rebuild serves snapshot failed:", error);
  }

  return snapshot;
}

export async function __restoreIdentityFromSnapshot(
  db: IDBDatabase,
  snapshot: PreRebuildSnapshot,
): Promise<void> {
  const entries: Array<{ key: string; value: string }> = [];
  if (snapshot.clientPrivateKey !== undefined) {
    entries.push({
      key: "CLIENT_PRIVATE_KEY",
      value: snapshot.clientPrivateKey,
    });
  }
  if (snapshot.clientPublicKey !== undefined) {
    entries.push({
      key: "CLIENT_PUBLIC_KEY",
      value: snapshot.clientPublicKey,
    });
  }
  if (entries.length === 0) return;

  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_META, "readwrite");
    const store = tx.objectStore(STORE_META);
    for (const entry of entries) store.put(entry);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

export async function __restoreServesFromSnapshot(
  db: IDBDatabase,
  snapshot: PreRebuildSnapshot,
): Promise<void> {
  if (snapshot.serves.length === 0) return;

  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_SERVES, "readwrite");
    const store = tx.objectStore(STORE_SERVES);
    let pending = snapshot.serves.length;
    let aborted = false;

    const fail = (error: unknown) => {
      if (aborted) return;
      aborted = true;
      try {
        tx.abort();
      } catch {
        /* ignore */
      }
      reject(error);
    };

    for (const serve of snapshot.serves) {
      const req = store.add({
        device_name: serve.device_name,
        public_key: serve.public_key,
      });
      req.onsuccess = () => {
        pending -= 1;
        if (pending === 0) resolve();
      };
      req.onerror = () => {
        const err = req.error;
        if (err && err.name === "ConstraintError") {
          pending -= 1;
          if (pending === 0) resolve();
          return;
        }
        fail(err);
      };
    }
  });
}

async function __insertDemoServe(db: IDBDatabase): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_SERVES, "readwrite");
    const store = tx.objectStore(STORE_SERVES);
    const req = store.add({
      device_name: DEMO_SERVE_DEVICE_NAME,
      public_key: DEMO_SERVE_PUBLIC_KEY,
    });
    req.onsuccess = () => resolve();
    req.onerror = () => {
      const err = req.error;
      if (err && err.name === "ConstraintError") {
        resolve();
        return;
      }
      reject(err);
    };
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

// ---------------------------------------------------------------------------
// Single shared connection
// ---------------------------------------------------------------------------

let cachedDb: IDBDatabase | null = null;
let openOncePromise: Promise<OpenChatDbResult> | null = null;

export async function getDb(): Promise<IDBDatabase> {
  if (cachedDb !== null) {
    return cachedDb;
  }
  if (openOncePromise !== null) {
    const { db } = await openOncePromise;
    return db;
  }
  throw new Error(
    "chatRepository: getDb() called before openChatDbOnce(). " +
      "initializeClient() must run first.",
  );
}

export function openChatDbOnce(): Promise<OpenChatDbResult> {
  if (openOncePromise !== null) return openOncePromise;

  openOncePromise = new Promise<OpenChatDbResult>((resolve, reject) => {
    const probe = indexedDB.open(DB_NAME);

    probe.onerror = () => reject(probe.error);

    probe.onblocked = () =>
      reject(
        new Error(
          "IndexedDB upgrade blocked: close other tabs of this app and reload.",
        ),
      );

    probe.onsuccess = async () => {
      const db = probe.result;
      const currentVersion = db.version;

      if (currentVersion === EXPECTED_DB_VERSION) {
        cachedDb = db;
        resolve({ db, created: false });
        return;
      }

      let snapshot: PreRebuildSnapshot;
      try {
        snapshot = await __snapshotForRebuild(db);
      } catch (error) {
        console.warn(
          "[chatRepository] pre-rebuild snapshot failed, proceeding with empty snapshot:",
          error,
        );
        snapshot = { serves: [] };
      }

      db.close();

      const del = indexedDB.deleteDatabase(DB_NAME);
      del.onerror = () => reject(del.error);
      del.onblocked = () =>
        reject(
          new Error(
            "IndexedDB delete blocked: close other tabs of this app and reload.",
          ),
        );
      del.onsuccess = () => {
        const fresh = indexedDB.open(DB_NAME, EXPECTED_DB_VERSION);
        fresh.onerror = () => reject(fresh.error);
        fresh.onblocked = () =>
          reject(
            new Error(
              "IndexedDB reopen blocked: close other tabs of this app.",
            ),
          );
        fresh.onupgradeneeded = () => createSchema(fresh.result);
        fresh.onsuccess = async () => {
          const newDb = fresh.result;
          try {
            await __insertDemoServe(newDb);
            await __restoreIdentityFromSnapshot(newDb, snapshot);
            await __restoreServesFromSnapshot(newDb, snapshot);
          } catch (error) {
            console.warn("[OPENDB] post-rebuild restore failed:", error);
          }
          cachedDb = newDb;
          resolve({ db: newDb, created: true });
        };
      };
    };
  });

  return openOncePromise;
}

export function closeDb(): void {
  if (cachedDb !== null) {
    cachedDb.close();
    cachedDb = null;
  }
  openOncePromise = null;
}

function runRequest<T>(
  db: IDBDatabase,
  storeName: string | string[],
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
  storeName: string | string[],
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

// ---- Reads ---------------------------------------------------------------

export async function getSims(serveId: number): Promise<Sim[]> {
  const db = await getDb();
  const sims = await runRequest<Sim[]>(
    db,
    STORE_SIMS,
    "readonly",
    (tx) =>
      tx
        .objectStore(STORE_SIMS)
        .index("by_serve")
        .getAll(serveId) as IDBRequest<Sim[]>,
  );
  return sims.sort((a, b) => a.ordinal - b.ordinal);
}

export async function getConversations(
  serveId: number,
): Promise<Conversation[]> {
  const db = await getDb();
  const conversations = await runRequest<Conversation[]>(
    db,
    STORE_CONVERSATIONS,
    "readonly",
    (tx) =>
      tx
        .objectStore(STORE_CONVERSATIONS)
        .index("by_serve")
        .getAll(serveId) as IDBRequest<Conversation[]>,
  );
  return conversations.sort((a, b) => b.timestamp - a.timestamp);
}

/**
 * Read the persisted messages for one conversation, ordered by timestamp.
 */
export async function getMessages(
  serveId: number,
  number: string,
): Promise<PersistedMessage[]> {
  const db = await getDb();
  const rows = await runRequest<PersistedMessage[]>(
    db,
    STORE_MESSAGES,
    "readonly",
    (tx) =>
      tx
        .objectStore(STORE_MESSAGES)
        .index("by_serve_number")
        .getAll([serveId, number]) as IDBRequest<PersistedMessage[]>,
  );
  return rows.sort((a, b) => a.timestamp - b.timestamp);
}

export async function getContacts(serveId: number): Promise<Contact[]> {
  const db = await getDb();
  const contacts = await runRequest<Contact[]>(
    db,
    STORE_CONTACTS,
    "readonly",
    (tx) =>
      tx
        .objectStore(STORE_CONTACTS)
        .index("by_serve")
        .getAll(serveId) as IDBRequest<Contact[]>,
  );
  return contacts.sort((a, b) => a.displayName.localeCompare(b.displayName));
}

// ---- Writes --------------------------------------------------------------

export async function saveConversation(
  serveId: number,
  conversation: Conversation,
): Promise<void> {
  if (conversation.serveId !== serveId) {
    throw new Error(
      `saveConversation: serveId mismatch (${conversation.serveId} !== ${serveId})`,
    );
  }
  const db = await getDb();
  await runTransaction(db, STORE_CONVERSATIONS, "readwrite", (tx) => {
    tx.objectStore(STORE_CONVERSATIONS).put(conversation);
  });
}

export async function saveConversations(
  serveId: number,
  conversations: Conversation[],
): Promise<void> {
  const db = await getDb();
  await runTransaction(db, STORE_CONVERSATIONS, "readwrite", (tx) => {
    const store = tx.objectStore(STORE_CONVERSATIONS);
    for (const c of conversations) {
      if (c.serveId !== serveId) {
        throw new Error(`saveConversations: serveId mismatch on ${c.number}`);
      }
      store.put(c);
    }
  });
}

export interface ConversationReconcilePlan {
  upserts: Conversation[];
  deletes: Array<[number, string]>;
}

export async function reconcileConversations(
  serveId: number,
  plan: ConversationReconcilePlan,
): Promise<void> {
  const db = await getDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_CONVERSATIONS, "readwrite");
    const store = tx.objectStore(STORE_CONVERSATIONS);

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);

    for (const c of plan.upserts) {
      if (c.serveId !== serveId) {
        try {
          tx.abort();
        } catch {
          /* ignore */
        }
        reject(
          new Error(
            `reconcileConversations: serveId mismatch (${c.serveId} !== ${serveId})`,
          ),
        );
        return;
      }
      store.put(c);
    }

    for (const [sid, number] of plan.deletes) {
      if (sid !== serveId) {
        try {
          tx.abort();
        } catch {
          /* ignore */
        }
        reject(
          new Error(
            `reconcileConversations: delete serveId mismatch (${sid} !== ${serveId})`,
          ),
        );
        return;
      }
      store.delete([sid, number]);
    }
  });
}

export async function saveSims(serveId: number, sims: Sim[]): Promise<void> {
  const db = await getDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_SIMS, "readwrite");
    const store = tx.objectStore(STORE_SIMS);

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);

    const byServe = store.index("by_serve");
    const cursorReq = byServe.openKeyCursor(IDBKeyRange.only(serveId));

    cursorReq.onsuccess = () => {
      const cursor = cursorReq.result;
      if (cursor) {
        store.delete(cursor.primaryKey);
        cursor.continue();
        return;
      }
      for (const s of sims) {
        if (s.serveId !== serveId) {
          try {
            tx.abort();
          } catch {
            /* ignore */
          }
          reject(
            new Error(
              `saveSims: serveId mismatch (${s.serveId} !== ${serveId})`,
            ),
          );
          return;
        }
        store.put(s);
      }
    };
    cursorReq.onerror = () => reject(cursorReq.error);
  });
}

export async function updateConversationSelectedSim(
  serveId: number,
  number: string,
  selectedSimForSend: number | undefined,
): Promise<void> {
  const db = await getDb();
  await runTransaction(db, STORE_CONVERSATIONS, "readwrite", (tx) => {
    const store = tx.objectStore(STORE_CONVERSATIONS);
    const req = store.get([serveId, number]) as IDBRequest<
      Conversation | undefined
    >;
    req.onsuccess = () => {
      const c = req.result;
      if (!c) return;
      store.put({ ...c, selectedSimForSend });
    };
  });
}

export async function updateConversationUnread(
  serveId: number,
  number: string,
  unread: boolean,
): Promise<void> {
  const db = await getDb();
  await runTransaction(db, STORE_CONVERSATIONS, "readwrite", (tx) => {
    const store = tx.objectStore(STORE_CONVERSATIONS);
    const req = store.get([serveId, number]) as IDBRequest<
      Conversation | undefined
    >;
    req.onsuccess = () => {
      const c = req.result;
      if (!c) return;
      store.put({ ...c, unread });
    };
  });
}

// ---- Internal helpers used only by the seeder ----------------------------

export async function __seedSims(
  serveId: number,
  sims: Array<Omit<Sim, "serveId">>,
): Promise<void> {
  const db = await getDb();
  await runTransaction(db, STORE_SIMS, "readwrite", (tx) => {
    const store = tx.objectStore(STORE_SIMS);
    for (const s of sims) store.put({ ...s, serveId });
  });
}

export async function __seedContacts(
  serveId: number,
  contacts: Array<Omit<Contact, "serveId">>,
): Promise<void> {
  const db = await getDb();
  await runTransaction(db, STORE_CONTACTS, "readwrite", (tx) => {
    const store = tx.objectStore(STORE_CONTACTS);
    for (const c of contacts) {
      store.put({ ...c, serveId, id: `${serveId}:${c.id}` });
    }
  });
}

export async function __seedConversations(
  serveId: number,
  conversations: Array<Omit<Conversation, "serveId">>,
): Promise<void> {
  const db = await getDb();
  await runTransaction(db, STORE_CONVERSATIONS, "readwrite", (tx) => {
    const store = tx.objectStore(STORE_CONVERSATIONS);
    for (const c of conversations) store.put({ ...c, serveId });
  });
}

/**
 * Seed individual message records into the per-message store.
 *
 * Duplicate primary key (`serveId`, `number`, `timestamp`) is ignored.
 * `preventDefault()` is called on the request's error event so that the
 * enclosing transaction is not aborted by a duplicate. Any other database
 * error aborts the transaction and rejects.
 */
export async function __seedMessages(
  serveId: number,
  messagesByNumber: Record<
    string,
    Array<{
      body: string;
      timestamp: number;
      subscription_id: number;
      messageType: number;
    }>
  >,
): Promise<void> {
  const db = await getDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_MESSAGES, "readwrite");
    const store = tx.objectStore(STORE_MESSAGES);

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);

    for (const [number, messages] of Object.entries(messagesByNumber)) {
      for (const m of messages) {
        if (
          !Number.isInteger(m.messageType) ||
          m.messageType < 1 ||
          m.messageType > 6
        ) {
          try {
            tx.abort();
          } catch {
            /* ignore */
          }
          reject(
            new Error(
              `__seedMessages: invalid messageType=${m.messageType} for number=${number}`,
            ),
          );
          return;
        }
        const req = store.add({
          serveId,
          number,
          timestamp: m.timestamp,
          body: m.body,
          subscription_id: m.subscription_id,
          messageType: m.messageType,
        });
        req.onerror = (event) => {
          const err = req.error;
          if (err && err.name === "ConstraintError") {
            // Duplicate primary key: keep the existing row, do not
            // abort the enclosing transaction.
            event.preventDefault();
            return;
          }
          try {
            tx.abort();
          } catch {
            /* ignore */
          }
          reject(err);
        };
      }
    }
  });
}

// ---- Meta (generic singleton key-value) ----------------------------------

export interface MetaRecord<T = string> {
  key: string;
  value: T;
}

export async function getMeta<T = string>(key: string): Promise<T | undefined> {
  const db = await getDb();
  const record = await runRequest<MetaRecord<T> | undefined>(
    db,
    STORE_META,
    "readonly",
    (tx) =>
      tx.objectStore(STORE_META).get(key) as IDBRequest<
        MetaRecord<T> | undefined
      >,
  );
  return record?.value;
}

export async function setMeta<T = string>(
  key: string,
  value: T,
): Promise<void> {
  const db = await getDb();
  await runTransaction(db, STORE_META, "readwrite", (tx) => {
    tx.objectStore(STORE_META).put({ key, value });
  });
}

// ---- Added: message-read helpers used by buildGetMessagesData -----------

/**
 * Count persisted messages for one conversation.
 *
 * Uses the `by_serve_number` index. No cursor; IndexedDB's `count` on an
 * index is bounded by the index key range.
 */
export async function countMessages(
  serveId: number,
  number: string,
): Promise<number> {
  const db = await getDb();
  return await runRequest<number>(
    db,
    STORE_MESSAGES,
    "readonly",
    (tx) =>
      tx
        .objectStore(STORE_MESSAGES)
        .index("by_serve_number")
        .count(IDBKeyRange.only([serveId, number])) as IDBRequest<number>,
  );
}

/**
 * Return the maximum `timestamp` persisted for one conversation, or
 * `null` if the conversation has no messages yet.
 */
export async function getLatestMessageTimestamp(
  serveId: number,
  number: string,
): Promise<number | null> {
  const db = await getDb();
  return await new Promise<number | null>((resolve, reject) => {
    const tx = db.transaction(STORE_MESSAGES, "readonly");
    const store = tx.objectStore(STORE_MESSAGES);
    const index = store.index("by_serve_number");

    const req = index.openCursor(IDBKeyRange.only([serveId, number]), "prev");

    req.onsuccess = () => {
      const cursor = req.result;
      if (!cursor) {
        resolve(null);
        return;
      }
      const row = cursor.value as PersistedMessage;
      resolve(row.timestamp);
    };
    req.onerror = () => reject(req.error);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

/**
 * Return the canonical `subscription_id` values for one Serve, ordered by
 * ordinal ascending.
 */
export async function getSubscriptionIdsForServe(
  serveId: number,
): Promise<number[]> {
  const db = await getDb();
  const sims = await runRequest<Sim[]>(
    db,
    STORE_SIMS,
    "readonly",
    (tx) =>
      tx
        .objectStore(STORE_SIMS)
        .index("by_serve")
        .getAll(serveId) as IDBRequest<Sim[]>,
  );
  return sims
    .sort((a, b) => a.ordinal - b.ordinal)
    .map((s) => s.subscription_id);
}

// ---- Added: page persistence --------------------------------------------

/**
 * Insert a page of messages into `messages`.
 *
 * - One readwrite transaction for the page.
 * - `add` per record; no SELECT before INSERT.
 * - Per-request `ConstraintError` -> `event.preventDefault()`. Duplicates
 *   are the expected normal case during pagination and must not abort the
 *   transaction. They are not logged.
 * - Any other per-request error rejects and aborts the transaction.
 * - Resolves on `tx.oncomplete`, not on the last request's `onsuccess`.
 *
 * Kept for compatibility. The range-based GET_MESSAGES flow uses
 * `replaceMessageRange` instead.
 */
export async function insertMessages(
  serveId: number,
  messages: Array<Omit<PersistedMessage, "serveId">>,
): Promise<void> {
  const db = await getDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_MESSAGES, "readwrite");
    const store = tx.objectStore(STORE_MESSAGES);

    let settled = false;
    const fail = (error: unknown) => {
      if (settled) return;
      settled = true;
      try {
        tx.abort();
      } catch {
        /* ignore */
      }
      reject(error);
    };

    tx.oncomplete = () => {
      if (settled) return;
      settled = true;
      resolve();
    };
    tx.onerror = () => {
      console.error("[chatRepository] insertMessages tx error:", tx.error);
      fail(tx.error);
    };
    tx.onabort = () => {
      console.error("[chatRepository] insertMessages tx abort:", tx.error);
      fail(tx.error);
    };

    for (const m of messages) {
      const req = store.add({ ...m, serveId });
      req.onerror = (event) => {
        const err = req.error;
        if (err && err.name === "ConstraintError") {
          // Intentional duplicate. Preserve the existing row; do not
          // abort the transaction; do not log.
          event.preventDefault();
          return;
        }
        console.error("[chatRepository] insertMessages add failed:", err);
        fail(err);
      };
    }
  });
}

// ---- Added: range replacement + range-relative count --------------------

/**
 * Replace one timestamp range for a conversation, atomically.
 *
 *   - delete existing rows for (serveId, number) whose timestamp is in
 *     [minTimestamp, maxTimestamp] inclusive
 *   - insert the supplied rows
 *   - both operations in ONE readwrite transaction on STORE_MESSAGES
 *
 * Rows outside the range are not touched. Rows whose timestamp falls in
 * the range but are absent from `messages` are deleted. Rows present in
 * `messages` are inserted, replacing any prior row at the same primary
 * key (serveId, number, timestamp).
 *
 * Duplicate primary keys inside `messages` abort the transaction.
 * Resolves on `tx.oncomplete`. Rejects on any request error or abort.
 *
 * Range semantics: `minTimestamp` and `maxTimestamp` are both inclusive,
 * matching the GET_MESSAGES response replacement contract.
 */
export async function replaceMessageRange(
  serveId: number,
  number: string,
  minTimestamp: number,
  maxTimestamp: number,
  messages: Array<Omit<PersistedMessage, "serveId" | "number">>,
): Promise<void> {
  const db = await getDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_MESSAGES, "readwrite");
    const store = tx.objectStore(STORE_MESSAGES);

    let settled = false;
    const fail = (error: unknown) => {
      if (settled) return;
      settled = true;
      try {
        tx.abort();
      } catch {
        /* ignore */
      }
      reject(error);
    };

    tx.oncomplete = () => {
      if (settled) return;
      settled = true;
      resolve();
    };
    tx.onerror = () => {
      console.error("[chatRepository] replaceMessageRange tx error:", tx.error);
      fail(tx.error);
    };
    tx.onabort = () => {
      console.error("[chatRepository] replaceMessageRange tx abort:", tx.error);
      fail(tx.error);
    };

    // Primary key is [serveId, number, timestamp]. The range is over the
    // primary key, so the cursor must be opened on the STORE, not on the
    // two-component `by_serve_number` index. Both bounds inclusive.
    const range = IDBKeyRange.bound(
      [serveId, number, minTimestamp],
      [serveId, number, maxTimestamp],
      false,
      false,
    );
    const cursorReq = store.openCursor(range);

    cursorReq.onsuccess = () => {
      const cursor = cursorReq.result;
      if (cursor) {
        store.delete(cursor.primaryKey);
        cursor.continue();
        return;
      }

      for (const m of messages) {
        const req = store.add({
          serveId,
          number,
          timestamp: m.timestamp,
          body: m.body,
          subscription_id: m.subscription_id,
          messageType: m.messageType,
        });
        req.onerror = () => {
          console.error(
            "[chatRepository] replaceMessageRange add failed:",
            req.error,
          );
          fail(req.error);
        };
      }
    };
    cursorReq.onerror = () => {
      console.error(
        "[chatRepository] replaceMessageRange cursor failed:",
        cursorReq.error,
      );
      fail(cursorReq.error);
    };
  });
}

/**
 * Count persisted messages for (serveId, number) whose timestamp is
 * >= `sinceTimestamp`.
 *
 * Used to build `cached_count` for a GET_MESSAGES request whose `start`
 * is `sinceTimestamp` and whose `end` is null. The Serve compares this
 * against its own count for the same range; using the conversation total
 * causes repeated "cache invalid" responses and an endless pagination
 * loop.
 */
export async function countMessagesFrom(
  serveId: number,
  number: string,
  sinceTimestamp: number,
): Promise<number> {
  const db = await getDb();
  return await new Promise<number>((resolve, reject) => {
    const tx = db.transaction(STORE_MESSAGES, "readonly");
    const store = tx.objectStore(STORE_MESSAGES);
    const range = IDBKeyRange.bound(
      [serveId, number, sinceTimestamp],
      [serveId, number, Number.MAX_SAFE_INTEGER],
      false,
      false,
    );
    const req = store.count(range);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

// ---- Added: SEND_SMS local persistence helpers --------------------------

/**
 * Insert a single message row. Duplicate primary key is ignored: the
 * request is idempotent at the DB level (the OUTBOX insert from
 * SendSmsHandler is retried only if the caller catches and rethrows).
 *
 * Resolves on `tx.oncomplete`. Rejects on any non-constraint request
 * error or abort.
 */
export async function insertMessage(message: PersistedMessage): Promise<void> {
  const db = await getDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_MESSAGES, "readwrite");
    const store = tx.objectStore(STORE_MESSAGES);

    let settled = false;
    const fail = (error: unknown) => {
      if (settled) return;
      settled = true;
      try {
        tx.abort();
      } catch {
        /* ignore */
      }
      reject(error);
    };

    tx.oncomplete = () => {
      if (settled) return;
      settled = true;
      resolve();
    };
    tx.onerror = () => fail(tx.error);
    tx.onabort = () => fail(tx.error);

    const req = store.add(message);
    req.onerror = (event) => {
      const err = req.error;
      if (err && err.name === "ConstraintError") {
        // Row already exists. Treat as a no-op, matching the "insert is
        // idempotent" contract above.
        event.preventDefault();
        return;
      }
      fail(err);
    };
  });
}

/**
 * Update the `messageType` of one persisted message, identified by
 * (serveId, number, timestamp). No-op if the row is absent.
 *
 * Resolves on `tx.oncomplete`. Rejects on any request error or abort.
 */
export async function updateMessageType(
  serveId: number,
  number: string,
  timestamp: number,
  messageType: number,
): Promise<void> {
  const db = await getDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_MESSAGES, "readwrite");
    const store = tx.objectStore(STORE_MESSAGES);

    let settled = false;
    const fail = (error: unknown) => {
      if (settled) return;
      settled = true;
      try {
        tx.abort();
      } catch {
        /* ignore */
      }
      reject(error);
    };

    tx.oncomplete = () => {
      if (settled) return;
      settled = true;
      resolve();
    };
    tx.onerror = () => fail(tx.error);
    tx.onabort = () => fail(tx.error);

    const getReq = store.get([serveId, number, timestamp]) as IDBRequest<
      PersistedMessage | undefined
    >;
    getReq.onsuccess = () => {
      const row = getReq.result;
      if (!row) return;
      const putReq = store.put({ ...row, messageType });
      putReq.onerror = () => fail(putReq.error);
    };
    getReq.onerror = () => fail(getReq.error);
  });
}

/**
 * Return the most recent message for (serveId, number) whose
 * `messageType` equals `messageType`, or null if none exists.
 *
 * Iterates the `by_serve_number` index in reverse key order, so the
 * newest timestamp is examined first. The compound primary key is
 * [serveId, number, timestamp]; reverse iteration yields descending
 * timestamps within the conversation.
 */
export async function getLatestMessageByType(
  serveId: number,
  number: string,
  messageType: number,
): Promise<PersistedMessage | null> {
  const db = await getDb();
  return await new Promise<PersistedMessage | null>((resolve, reject) => {
    const tx = db.transaction(STORE_MESSAGES, "readonly");
    const index = tx.objectStore(STORE_MESSAGES).index("by_serve_number");

    const req = index.openCursor(IDBKeyRange.only([serveId, number]), "prev");

    req.onsuccess = () => {
      const cursor = req.result;
      if (!cursor) {
        resolve(null);
        return;
      }
      const row = cursor.value as PersistedMessage;
      if (row.messageType === messageType) {
        resolve(row);
        return;
      }
      cursor.continue();
    };
    req.onerror = () => reject(req.error);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

/**
 * Count persisted messages for (serveId, number) whose timestamp is
 * <= `upToTimestamp`, inclusive.
 *
 * Contract (as required by the Serve):
 *   SELECT COUNT(*) FROM SMS
 *   WHERE subscription_id IN (...) AND address = :number
 *   AND date <= :start
 *
 * In this schema the per-Serve scope is carried by the message's
 * `serveId`, and the `subscription_id IN (...)` set is the Serve's own
 * subscriptions. Every persisted row for the Serve carries one of them,
 * so filtering by `serveId` is equivalent and avoids an extra IN-clause
 * join.
 *
 * Uses the object store's primary key range
 * [serveId, number, -inf] .. [serveId, number, upToTimestamp], inclusive.
 * `store.count` on a primary-key range is a bounded count over the
 * store, not over an index, which is what the range requires.
 */
export async function countMessagesUpTo(
  serveId: number,
  number: string,
  upToTimestamp: number,
): Promise<number> {
  const db = await getDb();
  return await new Promise<number>((resolve, reject) => {
    const tx = db.transaction(STORE_MESSAGES, "readonly");
    const store = tx.objectStore(STORE_MESSAGES);
    const range = IDBKeyRange.bound(
      [serveId, number, Number.MIN_SAFE_INTEGER],
      [serveId, number, upToTimestamp],
      false,
      false,
    );
    const req = store.count(range);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

// ---- Added: atomic full-conversation replace for GET_MESSAGES full sync --

/**
 * Delete ALL persisted messages for (serveId, number), then insert the
 * supplied rows, in one readwrite transaction.
 *
 * Used exclusively by the full-sync branch of GET_MESSAGES persistence.
 * Deletes every row for the conversation, including rows older than the
 * response's MIN timestamp. That is what distinguishes this from
 * `replaceMessageRange`, which deletes only a bounded timestamp range.
 *
 * Insertion uses `add`; a duplicate primary key inside `messages` aborts
 * the transaction.
 *
 * Resolves on `tx.oncomplete`. Rejects on any request error or abort.
 */
export async function replaceAllMessages(
  serveId: number,
  number: string,
  messages: Array<Omit<PersistedMessage, "serveId" | "number">>,
): Promise<void> {
  const db = await getDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_MESSAGES, "readwrite");
    const store = tx.objectStore(STORE_MESSAGES);

    let settled = false;
    const fail = (error: unknown) => {
      if (settled) return;
      settled = true;
      try {
        tx.abort();
      } catch {
        /* ignore */
      }
      reject(error);
    };

    tx.oncomplete = () => {
      if (settled) return;
      settled = true;
      resolve();
    };
    tx.onerror = () => fail(tx.error);
    tx.onabort = () => fail(tx.error);

    // Delete every row for (serveId, number). The compound primary key is
    // [serveId, number, timestamp]; the range spans all timestamps for
    // the pair.
    const range = IDBKeyRange.bound(
      [serveId, number, Number.MIN_SAFE_INTEGER],
      [serveId, number, Number.MAX_SAFE_INTEGER],
      false,
      false,
    );
    const cursorReq = store.openCursor(range);

    cursorReq.onsuccess = () => {
      const cursor = cursorReq.result;
      if (cursor) {
        store.delete(cursor.primaryKey);
        cursor.continue();
        return;
      }

      for (const m of messages) {
        const req = store.add({
          serveId,
          number,
          timestamp: m.timestamp,
          body: m.body,
          subscription_id: m.subscription_id,
          messageType: m.messageType,
        });
        req.onerror = () => fail(req.error);
      }
    };
    cursorReq.onerror = () => fail(cursorReq.error);
  });
}
