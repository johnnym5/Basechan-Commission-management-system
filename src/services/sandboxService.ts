import { doc, writeBatch } from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { CommissionRate } from '../types';
import {
  getLocalRates,
  stageRatesToLocalDatabase,
  saveLocalOfflineImport,
  clearPendingOfflineImports,
  type PendingOfflineImport,
} from './localRateDatabase';

const SANDBOX_ACTIVE_KEY = 'basechan_sandbox_active_v1';

export function isSandboxActive(): boolean {
  try {
    return localStorage.getItem(SANDBOX_ACTIVE_KEY) === 'true';
  } catch {
    return false;
  }
}

export function setSandboxActive(active: boolean): void {
  try {
    if (active) {
      localStorage.setItem(SANDBOX_ACTIVE_KEY, 'true');
    } else {
      localStorage.removeItem(SANDBOX_ACTIVE_KEY);
    }
  } catch (e) {
    console.error('Failed to set sandbox active state in localStorage', e);
  }
}

export async function importToSandbox(
  uid: string,
  rates: CommissionRate[],
  sheetNames: string[] = ['2027 Master Baseline'],
  importId?: string,
  importedBy?: string
): Promise<void> {
  if (!rates || rates.length === 0) return;

  // Stage rates into local IndexedDB
  await stageRatesToLocalDatabase(uid, rates);

  // Record pending import entry in IndexedDB
  const pendingItem: PendingOfflineImport = {
    id: importId || `import-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
    rates,
    sheetNames,
    importedAt: new Date().toISOString(),
    importedBy: importedBy || uid,
  };

  await saveLocalOfflineImport(uid, pendingItem);
}

export async function getSandboxStagedRates(uid: string): Promise<CommissionRate[]> {
  return getLocalRates(uid);
}

export async function getSandboxStagedCount(uid: string): Promise<number> {
  const rates = await getLocalRates(uid);
  return rates.length;
}

export interface MigrationProgress {
  total: number;
  completed: number;
  percentage: number;
  currentChunk: number;
  totalChunks: number;
}

export async function migrateSandboxToCloud(
  uid: string,
  onProgress?: (progress: MigrationProgress) => void
): Promise<{ migratedCount: number }> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    throw new Error('An active internet connection is required to migrate sandbox data to Firestore.');
  }

  const stagedRates = await getLocalRates(uid);
  if (!stagedRates || stagedRates.length === 0) {
    return { migratedCount: 0 };
  }

  const CHUNK_SIZE = 400; // Batch limit safe under Firestore 500 ops limit
  const total = stagedRates.length;
  const totalChunks = Math.ceil(total / CHUNK_SIZE);
  let completed = 0;

  for (let i = 0; i < totalChunks; i++) {
    const chunk = stagedRates.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
    const batch = writeBatch(db);

    for (const rate of chunk) {
      const rateRef = doc(db, 'rates', rate.id);
      batch.set(
        rateRef,
        {
          ...rate,
          migratedFromSandboxAt: new Date().toISOString(),
          updatedBy: uid,
        },
        { merge: true }
      );
    }

    await batch.commit();
    completed += chunk.length;

    if (onProgress) {
      onProgress({
        total,
        completed,
        percentage: Math.round((completed / total) * 100),
        currentChunk: i + 1,
        totalChunks,
      });
    }
  }

  // Clear pending offline imports once successfully migrated to cloud
  await clearPendingOfflineImports(uid);

  return { migratedCount: completed };
}
