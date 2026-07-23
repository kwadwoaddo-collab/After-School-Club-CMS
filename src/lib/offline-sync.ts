export interface OfflineCheckinAction {
  id: string; // unique operation id
  childId: string;
  centreId: string;
  type: 'check_in' | 'check_out';
  timestamp: string; // ISO string
  synced: boolean;
}

const DB_NAME = 'ASC_Kiosk_DB';
const STORE_NAME = 'checkins';
const DB_VERSION = 1;

/**
 * Initializes the IndexedDB for offline check-ins.
 */
function getDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      return reject('IndexedDB not supported');
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);

    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
  });
}

/**
 * Queues an action in IndexedDB.
 */
export async function queueOfflineAction(action: Omit<OfflineCheckinAction, 'synced' | 'id'>): Promise<OfflineCheckinAction> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const fullAction: OfflineCheckinAction = {
      ...action,
      id: crypto.randomUUID(),
      synced: false,
    };

    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const request = store.add(fullAction);

    request.onsuccess = () => resolve(fullAction);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Retrieves all unsynced actions from IndexedDB.
 */
export async function getUnsyncedActions(): Promise<OfflineCheckinAction[]> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.getAll();

    request.onsuccess = () => {
      const all = request.result as OfflineCheckinAction[];
      resolve(all.filter(a => !a.synced));
    };
    request.onerror = () => reject(request.error);
  });
}

/**
 * Marks an action as synced (or deletes it).
 */
export async function markActionSynced(id: string): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const request = store.delete(id); // We just remove it from queue once synced

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}
