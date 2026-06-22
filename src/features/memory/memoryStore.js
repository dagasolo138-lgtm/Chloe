const DB_NAME = 'chloe-db';
const DB_VERSION = 1;
const RECYCLE_RETENTION_DAYS = 145;
const DAY_MS = 24 * 60 * 60 * 1000;

let dbPromise;

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

function ensureStore(db, storeName, options, indexes = []) {
  const store = db.objectStoreNames.contains(storeName)
    ? null
    : db.createObjectStore(storeName, options);

  if (!store) {
    return;
  }

  indexes.forEach((indexName) => {
    store.createIndex(indexName, indexName, { unique: false });
  });
}

export function initDB() {
  if (dbPromise) {
    return dbPromise;
  }

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;

      ensureStore(db, 'memories', { keyPath: 'id' }, ['layer', 'weight', 'createdAt', 'updatedAt']);
      ensureStore(db, 'recycled_memories', { keyPath: 'id' }, ['recycledAt', 'layer']);
      ensureStore(db, 'daily_quota', { keyPath: 'date' });
      ensureStore(db, 'checkins', { keyPath: 'date' });
      ensureStore(db, 'stage_log', { keyPath: 'id' });
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

  return dbPromise;
}

async function getStore(storeName, mode = 'readonly') {
  const db = await initDB();
  const transaction = db.transaction(storeName, mode);
  return {
    store: transaction.objectStore(storeName),
    transaction,
  };
}

export async function saveMemory(memory) {
  const now = Date.now();
  const memoryToSave = {
    ...memory,
    id: memory.id ?? crypto.randomUUID(),
    createdAt: memory.createdAt ?? now,
    updatedAt: now,
    lastReferencedAt: memory.lastReferencedAt ?? now,
  };
  const { store, transaction } = await getStore('memories', 'readwrite');
  store.put(memoryToSave);
  await createTransactionPromise(transaction);
  return memoryToSave;
}

export async function getMemory(id) {
  const { store } = await getStore('memories');
  return createRequestPromise(store.get(id));
}

export async function getMemoriesByLayer(layer) {
  const { store } = await getStore('memories');
  return createRequestPromise(store.index('layer').getAll(layer));
}

export async function getAllMemories() {
  const { store } = await getStore('memories');
  return createRequestPromise(store.getAll());
}

export async function updateMemory(id, updates) {
  const existing = await getMemory(id);

  if (!existing) {
    return undefined;
  }

  const updatedMemory = {
    ...existing,
    ...updates,
    id,
    updatedAt: Date.now(),
  };

  const { store, transaction } = await getStore('memories', 'readwrite');
  store.put(updatedMemory);
  await createTransactionPromise(transaction);
  return updatedMemory;
}

export async function deleteMemory(id) {
  const { store, transaction } = await getStore('memories', 'readwrite');
  store.delete(id);
  await createTransactionPromise(transaction);
}

export async function moveToRecycleBin(memory) {
  const recycledMemory = {
    ...memory,
    recycledAt: Date.now(),
  };
  const db = await initDB();
  const transaction = db.transaction(['memories', 'recycled_memories'], 'readwrite');
  transaction.objectStore('memories').delete(memory.id);
  transaction.objectStore('recycled_memories').put(recycledMemory);
  await createTransactionPromise(transaction);
  return recycledMemory;
}

export async function getRecycledMemories() {
  const { store } = await getStore('recycled_memories');
  return createRequestPromise(store.getAll());
}

export async function restoreFromRecycleBin(id) {
  const db = await initDB();
  const transaction = db.transaction(['memories', 'recycled_memories'], 'readwrite');
  const recycledStore = transaction.objectStore('recycled_memories');
  const recycledMemory = await createRequestPromise(recycledStore.get(id));

  if (!recycledMemory) {
    transaction.abort();
    return undefined;
  }

  const { recycledAt, ...memory } = recycledMemory;
  const restoredMemory = {
    ...memory,
    weight: 80,
    isUserRestored: true,
    updatedAt: Date.now(),
  };

  transaction.objectStore('memories').put(restoredMemory);
  recycledStore.delete(id);
  await createTransactionPromise(transaction);
  return restoredMemory;
}

export async function deleteFromRecycleBin(id) {
  const { store, transaction } = await getStore('recycled_memories', 'readwrite');
  store.delete(id);
  await createTransactionPromise(transaction);
}

export async function purgeExpiredRecycled() {
  const cutoff = Date.now() - RECYCLE_RETENTION_DAYS * DAY_MS;
  const recycledMemories = await getRecycledMemories();
  const expired = recycledMemories.filter((memory) => memory.recycledAt < cutoff);
  const { store, transaction } = await getStore('recycled_memories', 'readwrite');

  expired.forEach((memory) => {
    store.delete(memory.id);
  });

  await createTransactionPromise(transaction);
  return expired;
}
