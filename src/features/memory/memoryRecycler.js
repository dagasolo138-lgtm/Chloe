import {
  deleteFromRecycleBin,
  getRecycledMemories,
  restoreFromRecycleBin,
  updateMemory,
} from './memoryStore.js';
import { calculateProtectedUntil } from './memoryWeightEngine.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const TIER1_DAYS = 45;
const RECYCLE_RETENTION_DAYS = 145;

function getAgeDays(recycledAt) {
  return (Date.now() - recycledAt) / DAY_MS;
}

export async function getRecycledByTier() {
  const recycledMemories = await getRecycledMemories();
  const tier1 = [];
  const tier2 = [];

  recycledMemories.forEach((memory) => {
    const ageDays = getAgeDays(memory.recycledAt);

    if (ageDays < TIER1_DAYS) {
      tier1.push(memory);
      return;
    }

    if (ageDays < RECYCLE_RETENTION_DAYS) {
      tier2.push(memory);
    }
  });

  return { tier1, tier2 };
}

export async function purgeExpired() {
  const recycledMemories = await getRecycledMemories();
  const expiredMemories = recycledMemories.filter(
    (memory) => getAgeDays(memory.recycledAt) >= RECYCLE_RETENTION_DAYS,
  );

  await Promise.all(expiredMemories.map((memory) => deleteFromRecycleBin(memory.id)));
  return expiredMemories.length;
}

export async function restoreMemory(id) {
  const restoredMemory = await restoreFromRecycleBin(id);

  if (!restoredMemory) {
    return undefined;
  }

  const now = Date.now();
  return updateMemory(restoredMemory.id, {
    weight: 90,
    isUserRestored: true,
    protectedUntil: calculateProtectedUntil(now, 90),
    updatedAt: now,
  });
}

export async function getRecycledCount() {
  const recycledMemories = await getRecycledMemories();
  return recycledMemories.length;
}
