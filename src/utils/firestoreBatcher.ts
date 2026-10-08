import { writeBatch, doc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { CommissionRate } from '../types';

export interface BatchUploadProgress {
  total: number;
  completed: number;
  currentBatch: number;
  totalBatches: number;
  percentage: number;
  failedCount: number;
}

/**
 * Sanitizes an object by removing any properties with value `undefined`.
 * Firestore throws an error if any field is explicitly `undefined`.
 */
function sanitizeForFirestore<T extends Record<string, unknown>>(obj: T): Record<string, unknown> {
  const clean: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(obj)) {
    if (val !== undefined) {
      clean[key] = val;
    }
  }
  return clean;
}

/**
 * Uploads an array of CommissionRate documents to Firestore in safe chunks.
 * Uses BATCH_SIZE = 200 because each rate creates 2 writes (rates + universities = 400 operations),
 * strictly below Firestore's 500 operation batch limit.
 */
export async function uploadRatesInBatches(
  rates: CommissionRate[],
  onProgress?: (progress: BatchUploadProgress) => void
): Promise<{ success: boolean; uploadedCount: number; errors: string[] }> {
  const BATCH_SIZE = 200;
  const total = rates.length;
  const totalBatches = Math.ceil(total / BATCH_SIZE);
  const errors: string[] = [];
  let completed = 0;
  let failedCount = 0;

  for (let b = 0; b < totalBatches; b++) {
    const start = b * BATCH_SIZE;
    const end = Math.min(start + BATCH_SIZE, total);
    const chunk = rates.slice(start, end);

    const batch = writeBatch(db);

    for (const rate of chunk) {
      // 1. Rates collection write (sanitized to remove any `undefined` values)
      const rateRef = doc(db, 'rates', rate.id);
      const cleanRateData = sanitizeForFirestore(rate as unknown as Record<string, unknown>);
      batch.set(rateRef, cleanRateData, { merge: true });

      // 2. Universities collection write
      const uniRef = doc(db, 'universities', rate.universityId);
      const uniData: Record<string, unknown> = {
        id: rate.universityId,
        name: rate.universityName,
        lastUpdated: new Date().toISOString(),
        status: 'ACTIVE',
      };
      if (rate.country && rate.country !== '-') {
        uniData.country = rate.country;
      }
      batch.set(uniRef, uniData, { merge: true });
    }

    try {
      await batch.commit();
      completed += chunk.length;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown Firestore batch error';
      errors.push(`Batch ${b + 1} failed: ${msg}`);
      failedCount += chunk.length;
    }

    if (onProgress) {
      onProgress({
        total,
        completed,
        currentBatch: b + 1,
        totalBatches,
        percentage: Math.round((completed / total) * 100),
        failedCount,
      });
    }
  }

  return {
    success: errors.length === 0,
    uploadedCount: completed,
    errors,
  };
}

/**
 * Deletes all documents from 'rates' and 'universities' collections in chunked batches.
 */
export async function deleteAllRatesAndUniversities(
  onProgress?: (progress: { completed: number; total: number; percentage: number }) => void
): Promise<{ success: boolean; deletedCount: number; error?: string }> {
  try {
    const { getDocs, collection } = await import('firebase/firestore');

    // Fetch all rate IDs
    const ratesSnapshot = await getDocs(collection(db, 'rates'));
    // Fetch all university IDs
    const unisSnapshot = await getDocs(collection(db, 'universities'));

    const allDocRefs = [
      ...ratesSnapshot.docs.map((d) => d.ref),
      ...unisSnapshot.docs.map((d) => d.ref),
    ];

    const total = allDocRefs.length;
    if (total === 0) {
      return { success: true, deletedCount: 0 };
    }

    const BATCH_SIZE = 400; // Under Firestore's 500 operation limit
    let completed = 0;

    for (let i = 0; i < total; i += BATCH_SIZE) {
      const chunk = allDocRefs.slice(i, i + BATCH_SIZE);
      const batch = writeBatch(db);
      chunk.forEach((ref) => batch.delete(ref));
      await batch.commit();

      completed += chunk.length;
      if (onProgress) {
        onProgress({
          completed,
          total,
          percentage: Math.round((completed / total) * 100),
        });
      }
    }

    return { success: true, deletedCount: completed };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to purge database';
    return { success: false, deletedCount: 0, error: msg };
  }
}
