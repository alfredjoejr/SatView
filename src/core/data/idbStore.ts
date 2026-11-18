/**
 * Tiny promise wrapper around IndexedDB used as a key/value cache.
 * (The Starlink catalog is several MB of JSON — too large for localStorage.)
 */
const DB_NAME = 'satview';
const DB_VERSION = 1;
const STORE_NAME = 'kv';

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB is not available'));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) {
        request.result.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Failed to open IndexedDB'));
  });
  // Allow a retry later if opening failed.
  dbPromise.catch(() => { dbPromise = null; });
  return dbPromise;
}

function runRequest<T>(mode: IDBTransactionMode, op: (store: IDBObjectStore) => IDBRequest): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, mode);
        const request = op(tx.objectStore(STORE_NAME));
        request.onsuccess = () => resolve(request.result as T);
        request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed'));
      }),
  );
}

export async function idbGet<T>(key: string): Promise<T | undefined> {
  try {
    return await runRequest<T | undefined>('readonly', (s) => s.get(key));
  } catch (err) {
    console.warn('[idb] get failed', err);
    return undefined;
  }
}

export async function idbSet<T>(key: string, value: T): Promise<void> {
  try {
    await runRequest('readwrite', (s) => s.put(value, key));
  } catch (err) {
    console.warn('[idb] set failed', err);
  }
}
