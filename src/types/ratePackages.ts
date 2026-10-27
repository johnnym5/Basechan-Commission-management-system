import type { AgentRateReadModel, CommissionRate, StaffRateReadModel } from './index';

export type RatePackageScope = 'admin' | 'staff' | 'agent';

export interface RatePackageAudit {
  rateId: string;
  universityName: string;
  actionType: 'EDIT' | 'CREATE' | 'DELETE';
  updatedBy: string;
  changes?: Record<string, { oldVal: unknown; newVal: unknown }>;
}

export interface RatePackageDelta {
  operationId: string;
  kind: 'upsert' | 'delete';
  id: string;
  record?: CommissionRate | Partial<CommissionRate> | StaffRateReadModel | Partial<StaffRateReadModel> | AgentRateReadModel | Partial<AgentRateReadModel>;
  unsetFields?: string[];
  audit?: RatePackageAudit;
}

export interface RatePackageEnvelope {
  packageId: string;
  scope: RatePackageScope;
  cursor: number;
  schemaVersion: 1;
  createdAt: string;
  actorUid?: string;
  changeCount: number;
  chunkIds: string[];
}

export interface RatePackageChunk {
  packageId: string;
  scope: RatePackageScope;
  cursor: number;
  chunkIndex: number;
  changes: RatePackageDelta[];
}

export interface RatePackageHead {
  cursor: number;
  packageId: string;
  updatedAt: string;
}

