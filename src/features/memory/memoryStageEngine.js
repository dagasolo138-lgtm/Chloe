import { evaluate } from './memoryFamiliarityScore.js';
import { getTotalCheckins } from './memoryQuota.js';
import { getAllMemories, initDB, moveToRecycleBin } from './memoryStore.js';

export const STAGES = {
  0: { name: '白色迷雾', desc: '初识' },
  1: { name: '彩色迷雾', desc: '开始了解' },
  2: { name: '星云凝聚', desc: '逐渐熟悉' },
  3: { name: '清晰星系', desc: '深入了解' },
  4: { name: '神经网络', desc: '高度熟悉' },
  5: { name: '剪枝稳态', desc: '深度融合' },
};

const MAX_STAGE = 5;
const MAX_MEMORY_COUNT = 500;
const NON_IDENTITY_LAYERS = ['event', 'habit', 'project', 'knowledge'];

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

async function getStageRecords() {
  const db = await initDB();
  const transaction = db.transaction('stage_log', 'readonly');
  return createRequestPromise(transaction.objectStore('stage_log').getAll());
}

async function saveStageRecord(stage) {
  const db = await initDB();
  const transaction = db.transaction('stage_log', 'readwrite');
  const record = {
    id: crypto.randomUUID(),
    stage,
    unlockedAt: Date.now(),
  };

  transaction.objectStore('stage_log').put(record);
  await createTransactionPromise(transaction);
  return record;
}

function countByLayer(memories) {
  return memories.reduce((counts, memory) => {
    counts[memory.layer] = (counts[memory.layer] ?? 0) + 1;
    return counts;
  }, {});
}

function minNonIdentityLayerCount(layerCounts) {
  return Math.min(...NON_IDENTITY_LAYERS.map((layer) => layerCounts[layer] ?? 0));
}

function buildCondition(label, current, required) {
  return {
    label,
    current,
    required,
    met: current >= required,
  };
}

function getConditionsForNextStage(currentStage, memories, conversationCount, checkinCount, familiarityScore = 0) {
  const totalMemories = memories.length;
  const layerCounts = countByLayer(memories);
  const nonIdentityCount = NON_IDENTITY_LAYERS.reduce(
    (total, layer) => total + (layerCounts[layer] ?? 0),
    0,
  );
  const minLayerCount = minNonIdentityLayerCount(layerCounts);

  if (currentStage === 0) {
    return [buildCondition('非身份层记忆', nonIdentityCount, 1)];
  }

  if (currentStage === 1) {
    return [
      buildCondition('记忆总数', totalMemories, 40),
      buildCondition('非身份各层记忆', minLayerCount, 5),
    ];
  }

  if (currentStage === 2) {
    return [
      buildCondition('记忆总数', totalMemories, 150),
      buildCondition('非身份各层记忆', minLayerCount, 10),
      buildCondition('对话数量', conversationCount, 200),
      buildCondition('使用天数', checkinCount, 30),
      buildCondition('AI熟悉度评分', familiarityScore, 80),
    ];
  }

  if (currentStage === 3) {
    return [
      buildCondition('记忆总数', totalMemories, 300),
      buildCondition('对话数量', conversationCount, 600),
      buildCondition('使用天数', checkinCount, 100),
      buildCondition('AI熟悉度评分', familiarityScore, 80),
    ];
  }

  if (currentStage === 4) {
    return [
      buildCondition('记忆总数', totalMemories, MAX_MEMORY_COUNT),
      buildCondition('对话数量', conversationCount, 600),
      buildCondition('使用天数', checkinCount, 100),
    ];
  }

  return [];
}

function areConditionsMet(conditions) {
  return conditions.length > 0 && conditions.every((condition) => condition.met);
}

async function getStageInputs(conversationCount) {
  const [memories, checkinCount] = await Promise.all([
    getAllMemories(),
    getTotalCheckins(),
  ]);

  return { memories, checkinCount, conversationCount };
}

export async function getCurrentStage() {
  const records = await getStageRecords();

  if (!records.length) {
    return 0;
  }

  return records.sort((a, b) => b.unlockedAt - a.unlockedAt)[0].stage;
}

export async function checkStageAdvance(conversationCount, apiKey) {
  const currentStage = await getCurrentStage();

  if (currentStage >= MAX_STAGE) {
    return { advanced: false, currentStage };
  }

  const { memories, checkinCount } = await getStageInputs(conversationCount);
  const needsFamiliarityScore = currentStage === 2 || currentStage === 3;
  const familiarityScore = needsFamiliarityScore ? await evaluate(apiKey) : 0;
  const conditions = getConditionsForNextStage(
    currentStage,
    memories,
    conversationCount,
    checkinCount,
    familiarityScore,
  );

  if (!areConditionsMet(conditions)) {
    return { advanced: false, currentStage };
  }

  const newStage = currentStage + 1;
  await saveStageRecord(newStage);
  return { advanced: true, newStage };
}

export async function getStageProgress(conversationCount = 0) {
  const currentStage = await getCurrentStage();
  const nextStage = currentStage >= MAX_STAGE ? null : currentStage + 1;
  const { memories, checkinCount } = await getStageInputs(conversationCount);

  return {
    currentStage,
    nextStage,
    conditions: nextStage === null
      ? []
      : getConditionsForNextStage(currentStage, memories, conversationCount, checkinCount),
  };
}

export async function shouldPrune() {
  const [currentStage, memories] = await Promise.all([
    getCurrentStage(),
    getAllMemories(),
  ]);

  return currentStage === MAX_STAGE && memories.length >= MAX_MEMORY_COUNT;
}

export async function pruneOneMemory() {
  const memories = await getAllMemories();
  const pruneCandidate = memories
    .filter((memory) => !memory.isInitial)
    .sort((a, b) => a.weight - b.weight || a.updatedAt - b.updatedAt)[0];

  if (!pruneCandidate) {
    return undefined;
  }

  await moveToRecycleBin(pruneCandidate);
  return pruneCandidate;
}
