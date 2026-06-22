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
  return new Date().toISOString().slice(0, 10);
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

export async function incrementTodayCount() {
  const today = getTodayDate();
  const count = (await getTodayCount()) + 1;
  const { store, transaction } = await getStore('daily_quota', 'readwrite');
  store.put({ date: today, count, updatedAt: Date.now() });
  await createTransactionPromise(transaction);
  return count;
}
