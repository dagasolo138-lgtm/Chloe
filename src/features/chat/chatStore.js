import { initDB } from '../memory/index.js';

export const ACTIVE_CONVERSATION_KEY = 'chloe-active-conversation';
export const CONVERSATION_COUNT_KEY = 'chloe-conversation-count';

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

async function getStore(mode = 'readonly') {
  const db = await initDB();
  const transaction = db.transaction('conversations', mode);
  return {
    store: transaction.objectStore('conversations'),
    transaction,
  };
}

export async function createConversation() {
  const now = Date.now();
  const conversation = {
    id: crypto.randomUUID(),
    title: '新对话',
    messages: [],
    createdAt: now,
    updatedAt: now,
  };

  await saveConversation(conversation);
  incrementConversationCount();
  return conversation;
}

export async function getConversation(id) {
  if (!id) {
    return undefined;
  }

  const { store } = await getStore();
  return createRequestPromise(store.get(id));
}

export async function saveConversation(conversation) {
  const conversationToSave = {
    ...conversation,
    updatedAt: Date.now(),
  };
  const { store, transaction } = await getStore('readwrite');
  store.put(conversationToSave);
  await createTransactionPromise(transaction);
  return conversationToSave;
}

export async function getAllConversations() {
  const { store } = await getStore();
  const conversations = await createRequestPromise(store.getAll());
  return conversations.sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function deleteConversation(id) {
  const { store, transaction } = await getStore('readwrite');
  store.delete(id);
  await createTransactionPromise(transaction);

  if (getActiveConversationId() === id) {
    localStorage.removeItem(ACTIVE_CONVERSATION_KEY);
  }
}

export function getActiveConversationId() {
  return localStorage.getItem(ACTIVE_CONVERSATION_KEY);
}

export function setActiveConversationId(id) {
  localStorage.setItem(ACTIVE_CONVERSATION_KEY, id);
}

export function getConversationCount() {
  return Number.parseInt(localStorage.getItem(CONVERSATION_COUNT_KEY), 10) || 0;
}

export function incrementConversationCount() {
  const count = getConversationCount() + 1;
  localStorage.setItem(CONVERSATION_COUNT_KEY, String(count));
  return count;
}
