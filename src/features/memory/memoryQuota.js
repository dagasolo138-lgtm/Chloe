import { initDB } from './memoryStore.js';

export const DAILY_LIMIT = 5;

function createRequestPromise(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function createTransactionPromise(transaction) {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}

async function getStore(storeName, mode = 'readonly') {
  const db = await initDB();
  const transaction = db.transaction(storeName, mode);
  return {
    store: transaction.objectStore(storeName),
    transaction,
  };
}

export function getTodayDate() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export async function checkIn() {
  const today = getTodayDate();
  const { store, transaction } = await getStore('checkins', 'readwrite');
  store.put({ date: today, checkedInAt: Date.now() });
  await createTransactionPromise(transaction);
}

export async function getTotalCheckins() {
  const { store } = await getStore('checkins');
  return createRequestPromise(store.count());
}

export async function getTodayCount() {
  const today = getTodayDate();
  const { store } = await getStore('daily_quota');
  const quota = await createRequestPromise(store.get(today));
  return quota?.count ?? 0;
}

export async function canAddMemory() {
  return (await getTodayCount()) < DAILY_LIMIT;
}

export async function tryConsumeQuota() {
  const today = getTodayDate();
  const { store, transaction } = await getStore('daily_quota', 'readwrite');
  const quota = await createRequestPromise(store.get(today));
  const count = quota?.count ?? 0;

  if (count >= DAILY_LIMIT) {
    await createTransactionPromise(transaction);
    return false;
  }

  store.put({ date: today, count: count + 1, updatedAt: Date.now() });
  await createTransactionPromise(transaction);
  return true;
}
