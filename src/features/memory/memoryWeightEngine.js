import { getAllMemories, updateMemory, initDB } from './memoryStore.js';
import { getTodayDate } from './memoryQuota.js';

export const INITIAL_WEIGHT = 80;
export const INIT_WEIGHT = 90;
export const RESTORED_WEIGHT = 90;
export const PROTECTION_DAYS = 90;
export const RESTORED_PROTECTION_DAYS = 90;
export const DECAY_PER_DAY = 1;
export const WARNING_THRESHOLD = 10;
export const MIN_WEIGHT = 10;
export const INIT_PROTECTION = Infinity;

const DAY_MS = 24 * 60 * 60 * 1000;

export function calculateProtectedUntil(createdAt, days) {
  if (days === Infinity) {
    return Infinity;
  }

  return createdAt + days * DAY_MS;
}

export function shouldDecay(memory) {
  if (memory.isInitial) {
    return false;
  }

  if (Date.now() < memory.protectedUntil) {
    return false;
  }

  return true;
}

export function decayWeight(memory) {
  if (!shouldDecay(memory)) {
    return memory;
  }

  return {
    ...memory,
    weight: Math.max(MIN_WEIGHT, memory.weight - DECAY_PER_DAY),
    updatedAt: Date.now(),
  };
}

export function needsWarning(memory) {
  return memory.weight <= WARNING_THRESHOLD && !memory.reminderSentAt;
}

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

async function hasRunDecayToday(today) {
  const db = await initDB();
  const transaction = db.transaction('daily_quota', 'readonly');
  const record = await createRequestPromise(transaction.objectStore('daily_quota').get('decay_date'));
  await createTransactionPromise(transaction);
  return record?.value === today;
}

async function markDecayRun(today) {
  const db = await initDB();
  const transaction = db.transaction('daily_quota', 'readwrite');
  transaction.objectStore('daily_quota').put({ date: 'decay_date', value: today, updatedAt: Date.now() });
  await createTransactionPromise(transaction);
}

export async function runDailyDecay() {
  const today = getTodayDate();

  if (await hasRunDecayToday(today)) {
    return [];
  }

  const memories = await getAllMemories();
  const warningMemories = [];

  await Promise.all(
    memories.map(async (memory) => {
      let nextMemory = decayWeight(memory);

      if (needsWarning(nextMemory)) {
        nextMemory = {
          ...nextMemory,
          reminderSentAt: Date.now(),
        };
        warningMemories.push(nextMemory);
      }

      if (nextMemory !== memory) {
        await updateMemory(memory.id, nextMemory);
      }
    }),
  );

  await markDecayRun(today);
  return warningMemories;
}
