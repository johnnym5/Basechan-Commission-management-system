export type StudyLevel = 'FD' | 'UG' | 'PG' | 'ALL';
export type NetOrGross = 'NET' | 'GROSS';
export type UniversityStatus = 'ACTIVE' | 'TBC' | 'NIL';
export type UserRole = 'ADMIN' | 'STAFF' | 'AGENT';
export type SchoolGuidance = 'FOCUS' | 'ALLOWED' | 'DO_NOT_USE';

export interface University {
  id: string; // e.g. aberdeen_university
  name: string;
  country?: string;
  status: UniversityStatus;
  lastUpdated?: string;
}

export interface CommissionRate {
  id: string; // Composite: [universityId]_[intake]_[aggregator]_[studyLevel]
  universityId: string;
  universityName: string;
  country?: string;
  intake: string; // e.g. "Jan 2026", "Sept 2026", "Oct - Feb 2026"
  aggregator: string; // e.g. "SI-UK", "EDVOY", "UAP", "CRIZAC", "BASECHAN"
  studyLevel: StudyLevel;
  masterRate: number; // Incoming % or flat fee
  agentRate: number; // Outgoing % or flat fee
  diffMargin: number; // Calculated: masterRate - agentRate
  isFlatFee: boolean; // false = %, true = flat amount (e.g. £)
  netOrGross: NetOrGross;
  guidance?: SchoolGuidance; // FOCUS (In the Green), ALLOWED, DO_NOT_USE (Avoid)
  notes?: string;
  updatedAt?: string;
  // Extended color and multi-table metadata from openpyxl parity
  rowColor?: string; // Hex color (e.g. "#E0F7FA" or "-")
  sourceSheet?: string; // Tab origin (e.g. "RAW DATA", "REAL", "UK - Agents")
  sourceRow?: number; // Row index in original Excel sheet
}

export interface UserProfile {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  role: UserRole;
  isAuthorized: boolean;
}

export interface UserRecord {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
  role: UserRole;
  createdAt: string;
  lastLoginAt: string;
  isOnline: boolean;
  isDisabled?: boolean;
}
