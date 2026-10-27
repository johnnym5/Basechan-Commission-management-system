import type { CommissionRate } from './index';

export type RateWriteCategory = 'rates' | 'guidance' | 'intake' | 'routing';
export type RateWriteStatus = 'pending' | 'selected' | 'publishing' | 'syncing' | 'quota-paused' | 'conflict' | 'failed' | 'cancelled';

export type PendingRateMutation =
  | { kind: 'create'; next: CommissionRate }
  | { kind: 'update'; id: string; nextId: string; patch: Partial<CommissionRate>; baseFields: Partial<CommissionRate>; baseSnapshot?: CommissionRate }
  | { kind: 'delete'; id: string; baseFingerprint: string; baseRate?: CommissionRate };

export interface PendingRateConflict {
  mutationIndex: number;
  id: string;
  reason: string;
  cloudRate?: CommissionRate;
}

export interface PendingRateOperation {
  operationId: string;
  uid: string;
  adminEmail: string;
  mutations: PendingRateMutation[];
  category: RateWriteCategory;
  notify: boolean;
  status: RateWriteStatus;
  packageId?: string;
  packageChangeIds?: string[];
  attemptCount: number;
  createdAt: string;
  updatedAt: string;
  lastError?: string;
  lastAttemptAt?: string;
  nextRetryAt?: string;
  conflicts?: PendingRateConflict[];
}

export type StageRateOperationInput = Pick<PendingRateOperation, 'adminEmail' | 'mutations'>
  & Partial<Pick<PendingRateOperation, 'operationId' | 'category' | 'notify'>>;

export type PendingRateOperationPatch = Partial<Pick<PendingRateOperation,
  'status' | 'packageId' | 'packageChangeIds' | 'attemptCount' | 'updatedAt' | 'lastError' | 'lastAttemptAt' | 'nextRetryAt' | 'conflicts' | 'mutations'>>;




