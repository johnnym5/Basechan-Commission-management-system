import { collection, addDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';

export interface AuditLogEntry {
  id?: string;
  rateId: string;
  universityName: string;
  actionType: 'EDIT' | 'CREATE' | 'DELETE' | 'BATCH_STATUS' | 'BATCH_EDIT';
  updatedBy: string;
  timestamp: string;
  changes?: Record<string, { oldVal: any; newVal: any }>;
}

export const logRateChange = async (
  updatedByEmail: string,
  actionType: 'EDIT' | 'CREATE' | 'DELETE' | 'BATCH_STATUS' | 'BATCH_EDIT',
  rateId: string,
  universityName: string,
  changes?: Record<string, { oldVal: any; newVal: any }>
): Promise<void> => {
  try {
    const entry: AuditLogEntry = {
      rateId,
      universityName,
      actionType,
      updatedBy: updatedByEmail || 'System Admin',
      timestamp: new Date().toISOString(),
      changes: changes || {},
    };

    await addDoc(collection(db, 'rate_audit_logs'), entry);
  } catch (err) {
    console.error('Failed to record audit log:', err);
  }
};
