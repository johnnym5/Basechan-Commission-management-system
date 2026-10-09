import { collection, addDoc, doc, setDoc } from 'firebase/firestore';
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
  changes?: Record<string, { oldVal: any; newVal: any }>,
  entryId?: string,
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

    if (entryId) await setDoc(doc(db, 'rate_audit_logs', entryId), entry);
    else await addDoc(collection(db, 'rate_audit_logs'), entry);
  } catch (err) {
    console.error('Failed to record audit log:', err);
    if (entryId) throw err;
  }
};
