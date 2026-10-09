import { writeBatch } from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { CommissionRate } from '../types';
import { deleteRates, writeRateOperation } from '../services/adminRateWriteService';
import { publishRelevantUpdates } from '../services/userUpdates';
import { assertFirestoreWritesAllowed } from '../services/firestoreWriteGuard';

export interface BatchUploadProgress {
  total: number;
  completed: number;
  currentBatch: number;
  totalBatches: number;
  percentage: number;
  failedCount: number;
}

/**
 * Uploads an array of CommissionRate documents to Firestore in safe chunks.
 * Uses BATCH_SIZE = 200 because each rate creates 2 writes (rates + universities = 400 operations),
 * strictly below Firestore's 500 operation batch limit.
 */
export async function uploadRatesInBatches(
  rates: CommissionRate[],
  onProgress?: (progress: BatchUploadProgress) => void,
  adminEmail = 'Admin'
): Promise<{ success: boolean; uploadedCount: number; errors: string[] }> {
  assertFirestoreWritesAllowed('Rate import');
  const BATCH_SIZE = 150;
  const total = rates.length;
  const totalBatches = Math.ceil(total / BATCH_SIZE);
  const errors: string[] = [];
  let completed = 0;
  let failedCount = 0;
  const successfullyUploaded: CommissionRate[] = [];
  const importOperationId = `import-${crypto.randomUUID()}`;

  for (let b = 0; b < totalBatches; b++) {
    const start = b * BATCH_SIZE;
    const end = Math.min(start + BATCH_SIZE, total);
    const chunk = rates.slice(start, end);

    try {
      await writeRateOperation({
        mutations: chunk.map((next) => ({ next })),
        adminEmail,
        operationId: `${importOperationId}-${b}`,
        notify: false,
        allowUpsert: true,
      });
      completed += chunk.length;
      successfullyUploaded.push(...chunk);
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

  if (completed > 0) {
    await publishRelevantUpdates({
      type: 'rates',
      title: 'Commission rates imported',
      summary: 'School commission information was updated.',
      rates: successfullyUploaded,
      operationId: `${importOperationId}-notice`,
    });
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
  onProgress?: (progress: { completed: number; total: number; percentage: number }) => void,
  adminEmail = 'Admin'
): Promise<{ success: boolean; deletedCount: number; error?: string }> {
  try {
    assertFirestoreWritesAllowed('Database cleanup');
    const { getDocs, collection } = await import('firebase/firestore');

    // Fetch all rate IDs
    const ratesSnapshot = await getDocs(collection(db, 'rates'));
    // Fetch all university IDs
    const unisSnapshot = await getDocs(collection(db, 'universities'));

    const allDocRefs = unisSnapshot.docs.map((d) => d.ref);
    const ratesToDelete = ratesSnapshot.docs.map((d) => ({ ...d.data(), id: d.id } as CommissionRate));

    const total = allDocRefs.length + ratesToDelete.length;
    if (total === 0) {
      if (!ratesToDelete.length) return { success: true, deletedCount: 0 };
    }

    if (ratesToDelete.length) await deleteRates(ratesToDelete, adminEmail);

    const BATCH_SIZE = 400; // Under Firestore's 500 operation limit
    let completed = ratesToDelete.length;

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
