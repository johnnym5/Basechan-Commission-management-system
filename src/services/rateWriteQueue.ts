import {
  getLocalRateOperations,
  stageLocalRateOperation,
  updateLocalRateOperation,
  finishLocalRateOperation,
  discardLocalRateOperation,
} from './localRateDatabase';
import type {
  PendingRateOperation,
  PendingRateOperationPatch,
  StageRateOperationInput,
} from '../types/rateWriteQueue';

export async function stageRateOperation(
  uid: string,
  input: StageRateOperationInput,
): Promise<PendingRateOperation> {
  if (!input.mutations.length) throw new Error('A rate operation needs at least one change.');
  const now = new Date().toISOString();
  const operation: PendingRateOperation = {
    operationId: input.operationId || crypto.randomUUID(),
    uid,
    adminEmail: input.adminEmail,
    mutations: input.mutations,
    category: input.category || 'rates',
    notify: input.notify !== false,
    status: 'pending',
    attemptCount: 0,
    createdAt: now,
    updatedAt: now,
  };
  return stageLocalRateOperation(uid, operation);
}

export async function getPendingRateOperations(uid: string): Promise<PendingRateOperation[]> {
  return getLocalRateOperations(uid);
}

export async function updatePendingRateOperation(
  uid: string,
  operationId: string,
  patch: PendingRateOperationPatch,
): Promise<void> {
  await updateLocalRateOperation(uid, operationId, { ...patch, updatedAt: patch.updatedAt || new Date().toISOString() });
}

export async function finishPendingRateOperation(uid: string, operationId: string, canonicalRates: import('../types').CommissionRate[]): Promise<void> {
  await finishLocalRateOperation(uid, operationId, canonicalRates);
}

export async function subscribeToRateWriteQueue(uid: string, listener: () => void): Promise<() => void> {
  const { subscribeToLocalRateChanges } = await import('./localRateDatabase');
  return subscribeToLocalRateChanges(uid, listener);
}


export async function discardPendingRateOperation(uid: string, operationId: string): Promise<boolean> {
  return discardLocalRateOperation(uid, operationId);
}

