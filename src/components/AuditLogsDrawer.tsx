import React, { useEffect, useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { collection, onSnapshot, query, orderBy, limit } from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { AuditLogEntry } from '../utils/auditLogger';
import {
  X,
  Clock,
  User,
  Pencil,
  PlusCircle,
  Trash2,
  History,
  Search,
} from 'lucide-react';

interface AuditLogsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AuditLogsDrawer: React.FC<AuditLogsDrawerProps> = ({ isOpen, onClose }) => {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [actionFilter, setActionFilter] = useState<string>('ALL');

  useEffect(() => {
    if (!isOpen) return;

    setLoading(true);
    const q = query(
      collection(db, 'rate_audit_logs'),
      orderBy('timestamp', 'desc'),
      limit(100)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const records: AuditLogEntry[] = [];
        snapshot.forEach((docSnap) => {
          records.push({ id: docSnap.id, ...docSnap.data() } as AuditLogEntry);
        });
        setLogs(records);
        setLoading(false);
      },
      (err) => {
        console.error('Error fetching audit logs:', err);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase().trim();
        const corpus = `${log.universityName} ${log.updatedBy} ${log.actionType}`.toLowerCase();
        if (!corpus.includes(q)) return false;
      }

      if (actionFilter !== 'ALL' && log.actionType !== actionFilter) {
        return false;
      }

      return true;
    });
  }, [logs, searchQuery, actionFilter]);

  if (!isOpen) return null;

  const formatDate = (isoString?: string) => {
    if (!isoString) return 'N/A';
    try {
      return new Date(isoString).toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return isoString;
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] bg-slate-950/80 backdrop-blur-xs flex justify-end overflow-hidden animate-backdrop-fade"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md h-full bg-white dark:bg-[#0E1526] text-slate-900 dark:text-slate-100 border-l border-slate-200 dark:border-[#222F43] shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-right duration-200 z-[10000]"
      >
        {/* Drawer Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-[#222F43] flex items-center justify-between bg-slate-50/90 dark:bg-[#18181B]/90 shrink-0">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-blue-500/15 text-blue-500 dark:text-amber-400 rounded-xl border border-blue-400/30">
              <History className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-base text-slate-900 dark:text-slate-100">
                Audit Timeline Logs
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Real-time activity history of rate modifications
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-200 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Controls */}
        <div className="p-3.5 border-b border-slate-100 dark:border-[#222F43] bg-slate-50/50 dark:bg-[#18181B]/50 flex gap-2 text-xs shrink-0">
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search history by school or user..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 border border-slate-200 dark:border-[#222F43] rounded-xl bg-white dark:bg-[#18181B] text-slate-900 dark:text-slate-100 focus:outline-hidden"
            />
          </div>

          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="px-2.5 py-1.5 border border-slate-200 dark:border-[#222F43] rounded-xl bg-white dark:bg-[#18181B] font-semibold text-slate-800 dark:text-slate-200"
          >
            <option value="ALL">All Actions</option>
            <option value="EDIT">Edits</option>
            <option value="CREATE">Creates</option>
            <option value="DELETE">Deletes</option>
          </select>
        </div>

        {/* Timeline Log List */}
        <div className="p-4 overflow-y-auto flex-1 space-y-3.5 text-xs">
          {loading ? (
            <div className="p-8 text-center text-slate-400">
              <div className="w-6 h-6 border-2 border-blue-600 dark:border-amber-400 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
              <span>Fetching audit timeline...</span>
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="p-8 text-center text-slate-500 dark:text-slate-400">
              No audit logs recorded yet.
            </div>
          ) : (
            filteredLogs.map((log) => {
              const isEdit = log.actionType === 'EDIT';
              const isDelete = log.actionType === 'DELETE';
              const isCreate = log.actionType === 'CREATE';

              return (
                <div
                  key={log.id}
                  className="p-3.5 rounded-2xl bg-slate-50 dark:bg-[#18181B] border border-slate-200 dark:border-[#222F43] space-y-2 relative"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      {isEdit && <Pencil className="w-3.5 h-3.5 text-blue-500 dark:text-amber-400" />}
                      {isDelete && <Trash2 className="w-3.5 h-3.5 text-rose-500" />}
                      {isCreate && <PlusCircle className="w-3.5 h-3.5 text-emerald-500" />}
                      <span className="font-extrabold uppercase text-[10px] tracking-wider text-slate-700 dark:text-slate-300">
                        {log.actionType}
                      </span>
                    </div>

                    <span className="text-[10px] text-slate-400 font-mono flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {formatDate(log.timestamp)}
                    </span>
                  </div>

                  <h4 className="font-extrabold text-slate-900 dark:text-slate-100 text-xs">
                    {log.universityName}
                  </h4>

                  <div className="text-[10px] text-slate-500 dark:text-slate-400 flex items-center gap-1">
                    <User className="w-3 h-3 text-slate-400" />
                    <span className="truncate">{log.updatedBy}</span>
                  </div>

                  {/* Changes detail Delta */}
                  {log.changes && Object.keys(log.changes).length > 0 && (
                    <div className="pt-1.5 border-t border-slate-200/80 dark:border-[#222F43] space-y-1 text-[10px] font-mono">
                      {Object.entries(log.changes).map(([field, delta]) => (
                        <div key={field} className="flex items-center justify-between text-slate-600 dark:text-slate-400">
                          <span className="uppercase text-[9px] text-slate-400">{field}:</span>
                          <span>
                            <span className="line-through text-slate-400 mr-1">{String(delta.oldVal)}</span>
                            <span className="text-emerald-600 dark:text-amber-400 font-bold">→ {String(delta.newVal)}</span>
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};
