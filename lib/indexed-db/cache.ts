import type { DashboardResponse } from '@/types/dashboard';

const DB_NAME = 'marketplace-dashboard-cache';
const STORE_NAME = 'dashboardResponses';
const DB_VERSION = 1;

type CacheRecord = {
  key: string;
  payload: DashboardResponse;
  cachedAt: string;
};

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = () => {
      const db = request.result;

      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'key' });
      }
    };
  });
}

export async function getCachedDashboardResponse(
  key: string
): Promise<DashboardResponse | null> {
  if (typeof window === 'undefined' || !('indexedDB' in window)) {
    return null;
  }

  const db = await openDb();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get(key);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const record = request.result as CacheRecord | undefined;
      resolve(record?.payload ?? null);
    };
  });
}

export async function setCachedDashboardResponse(
  key: string,
  payload: DashboardResponse
): Promise<void> {
  if (typeof window === 'undefined' || !('indexedDB' in window)) {
    return;
  }

  const db = await openDb();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.put({
      key,
      payload,
      cachedAt: new Date().toISOString()
    } satisfies CacheRecord);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}
