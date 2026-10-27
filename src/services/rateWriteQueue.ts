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
  let firstOperation: PendingRateOperation | undefined;
  for (const [index, mutation] of input.mutations.entries()) {
    const operationId = input.operationId
      ? (input.mutations.length === 1 ? input.operationId : `${input.operationId}_${index + 1}`)
      : crypto.randomUUID();
    const operation: PendingRateOperation = {
      operationId,
      uid,
      adminEmail: input.adminEmail,
      mutations: [mutation],
      category: input.category || 'rates',
      notify: input.notify !== false,
      status: 'pending',
      attemptCount: 0,
      createdAt: now,
      updatedAt: now,
    };
    const staged = await stageLocalRateOperation(uid, operation);
    firstOperation ||= staged;
  }
  return firstOperation!;
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

