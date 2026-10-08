import React, { useEffect, useState } from 'react';
import { collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { AuditLogEntry } from '../utils/auditLogger';
import {
  X,
  History,
  Clock,
  User,
  Pencil,
  Plus,
  Trash2,
  CheckCircle2,
  RefreshCcw,
} from 'lucide-react';

interface AuditHistoryDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  targetRateId?: string;
  targetUniversityName?: string;
}

export const AuditHistoryDrawer: React.FC<AuditHistoryDrawerProps> = ({
  isOpen,
  onClose,
  targetRateId,
  targetUniversityName,
}) => {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isOpen) return;

    setLoading(true);
    const q = query(
      collection(db, 'rate_audit_logs'),
      orderBy('timestamp', 'desc'),
      limit(50)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const records: AuditLogEntry[] = [];
        snapshot.forEach((doc) => {
          records.push({ id: doc.id, ...(doc.data() as AuditLogEntry) });
        });

        // Filter for specific rate if targetRateId passed
        const filtered = targetRateId
          ? records.filter((r) => r.rateId === targetRateId)
          : records;

        setLogs(filtered);
        setLoading(false);
      },
      (err) => {
        console.error('Failed to subscribe to audit logs:', err);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [isOpen, targetRateId]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/50 backdrop-blur-xs flex justify-end">
      <div className="bg-white dark:bg-slate-900 w-full max-w-md h-full shadow-2xl border-l border-slate-200 dark:border-slate-800 flex flex-col animate-in slide-in-from-right duration-200">
        {/* Header */}
        <div className="p-5 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/80 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5 text-slate-800 dark:text-slate-100">
            <History className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            <div>
              <h3 className="font-bold text-sm">
                {targetUniversityName ? `Audit Log: ${targetUniversityName}` : 'System Revision History'}
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Tracked changes and rate updates in Firestore
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Log Stream Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4 text-xs">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 text-slate-400 space-y-2">
              <RefreshCcw className="w-6 h-6 animate-spin text-emerald-600" />
              <span>Fetching change logs...</span>
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center py-12 text-slate-400 space-y-1">
              <History className="w-8 h-8 mx-auto text-slate-300 dark:text-slate-700" />
              <p className="font-semibold text-slate-600 dark:text-slate-300">No Change Logs Found</p>
              <p className="text-[11px]">Modifications to rates will automatically be recorded here.</p>
            </div>
          ) : (
            <div className="relative border-l-2 border-slate-200 dark:border-slate-800 ml-3 pl-4 space-y-6">
              {logs.map((log) => (
                <div key={log.id} className="relative space-y-1">
                  {/* Action Icon Badge */}
                  <span
                    className={`absolute -left-6.5 top-0.5 w-5 h-5 rounded-full flex items-center justify-center text-[10px] text-white font-bold ${
                      log.actionType === 'CREATE'
                        ? 'bg-emerald-500'
                        : log.actionType === 'EDIT'
                        ? 'bg-blue-500'
                        : log.actionType === 'DELETE'
                        ? 'bg-rose-500'
                        : 'bg-indigo-500'
                    }`}
                  >
                    {log.actionType === 'CREATE' && <Plus className="w-3 h-3" />}
                    {log.actionType === 'EDIT' && <Pencil className="w-3 h-3" />}
                    {log.actionType === 'DELETE' && <Trash2 className="w-3 h-3" />}
                    {(log.actionType === 'BATCH_STATUS' || log.actionType === 'BATCH_EDIT') && (
                      <CheckCircle2 className="w-3 h-3" />
                    )}
                  </span>

                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-800 dark:text-slate-200">
                      {log.universityName}
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>

                  <p className="text-slate-500 dark:text-slate-400 flex items-center gap-1 text-[11px]">
                    <User className="w-3 h-3 text-slate-400" />
                    <span>{log.updatedBy}</span> • <span className="font-mono uppercase font-semibold">{log.actionType}</span>
                  </p>

                  {/* Changes Summary if available */}
                  {log.changes && Object.keys(log.changes).length > 0 && (
                    <div className="bg-slate-50 dark:bg-slate-800/60 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 space-y-1 font-mono text-[11px]">
                      {Object.entries(log.changes).map(([field, delta]) => (
                        <div key={field} className="flex justify-between">
                          <span className="text-slate-500 dark:text-slate-400">{field}:</span>
                          <span className="text-slate-700 dark:text-slate-300">
                            <s className="text-rose-500">{String(delta.oldVal)}</s> →{' '}
                            <strong className="text-emerald-600 dark:text-emerald-400">{String(delta.newVal)}</strong>
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
