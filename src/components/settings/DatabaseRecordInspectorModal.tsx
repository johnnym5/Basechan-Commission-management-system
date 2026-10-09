import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Database,
  Code2,
  Copy,
  Check,
  Pencil,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  FileText,
} from 'lucide-react';

interface DatabaseRecordInspectorModalProps {
  record: any | null;
  collectionName: string;
  isOpen: boolean;
  onClose: () => void;
  onEdit?: (record: any) => void;
  onDelete?: (recordId: string) => void;
  onMarkStatus?: (record: any, guidance: 'FOCUS' | 'ALLOWED' | 'DO_NOT_USE') => void;
}

export const DatabaseRecordInspectorModal: React.FC<DatabaseRecordInspectorModalProps> = ({
  record,
  collectionName,
  isOpen,
  onClose,
  onEdit,
  onDelete,
  onMarkStatus,
}) => {
  const [activeTab, setActiveTab] = useState<'fields' | 'json'>('fields');
  const [copied, setCopied] = useState(false);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);

  // Lock body scroll ONLY when modal is active with a valid record
  useEffect(() => {
    if (!isOpen || !record) return;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen, record]);

  // Keyboard navigation: Escape closes modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !record) return null;

  const docId = record.id || record.uid || record.universityId || 'document';
  const jsonString = JSON.stringify(record, null, 2);

  const handleCopyJson = () => {
    navigator.clipboard.writeText(jsonString);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDelete = () => {
    if (isConfirmingDelete) {
      if (onDelete) onDelete(docId);
      setIsConfirmingDelete(false);
      onClose();
    } else {
      setIsConfirmingDelete(true);
      setTimeout(() => setIsConfirmingDelete(false), 4000);
    }
  };

  const g = record.guidance || 'ALLOWED';

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-hidden animate-backdrop-fade"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative m-auto max-w-xl w-full max-h-[85vh] bg-white dark:bg-[#0E1526] text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-[#222F43] rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-modal-pop z-[10000]"
      >
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-[#222F43] flex items-center justify-between bg-slate-50/90 dark:bg-[#18181B]/90 shrink-0">
          <div className="flex items-center gap-3 min-w-0 pr-2">
            <div className="p-2 bg-blue-50 dark:bg-amber-950/60 text-blue-600 dark:text-amber-400 rounded-2xl shrink-0">
              <Database className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded text-[9px] font-black uppercase bg-blue-100 dark:bg-blue-950/80 text-blue-800 dark:text-blue-300 font-mono">
                  {collectionName}
                </span>
                <span className="text-[10px] text-slate-400 font-mono truncate">{docId}</span>
              </div>
              <h3 className="font-extrabold text-sm sm:text-base text-slate-900 dark:text-slate-100 truncate mt-0.5">
                {record.universityName || record.displayName || record.email || record.title || docId}
              </h3>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close inspector"
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-800 rounded-xl transition cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* View Switcher Tabs */}
        <div className="flex items-center gap-2 px-5 py-2.5 bg-slate-100/60 dark:bg-[#18181B] border-b border-slate-200/80 dark:border-[#222F43] text-xs shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('fields')}
            className={`px-3 py-1.5 rounded-xl font-extrabold transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'fields'
                ? 'bg-white dark:bg-[#0E1526] text-blue-600 dark:text-amber-400 shadow-2xs'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Structured Fields</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('json')}
            className={`px-3 py-1.5 rounded-xl font-extrabold transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'json'
                ? 'bg-white dark:bg-[#0E1526] text-blue-600 dark:text-amber-400 shadow-2xs'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <Code2 className="w-3.5 h-3.5" />
            <span>Raw JSON Payload</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-5 overflow-y-auto flex-1 text-xs">
          {activeTab === 'fields' ? (
            <div className="space-y-4">
              {/* Guidance Status Pill if available */}
              {record.guidance && (
                <div className="p-3 bg-slate-50 dark:bg-[#18181B]/80 rounded-2xl border border-slate-200 dark:border-[#222F43] flex items-center justify-between">
                  <span className="font-semibold text-slate-500 dark:text-slate-400 text-xs">School Status Guidance:</span>
                  {g === 'FOCUS' ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                      <span>Focus / Preferred</span>
                    </span>
                  ) : g === 'DO_NOT_USE' ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-100 dark:bg-rose-950/80 text-rose-800 dark:text-rose-300 border border-rose-300 dark:border-rose-800">
                      <AlertTriangle className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400 shrink-0" />
                      <span>Do Not Use</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                      <Check className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                      <span>Allowed</span>
                    </span>
                  )}
                </div>
              )}

              {/* Formatted Key-Value Table */}
              <div className="rounded-2xl border border-slate-200 dark:border-[#222F43] overflow-hidden bg-white dark:bg-[#18181B]/80 divide-y divide-slate-100 dark:divide-[#222F43]">
                {Object.entries(record).map(([key, value]) => {
                  if (typeof value === 'object' && value !== null) {
                    value = JSON.stringify(value);
                  }
                  return (
                    <div key={key} className="p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-1 sm:gap-4">
                      <span className="font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider text-[10px] font-mono shrink-0">
                        {key}
                      </span>
                      <span className="font-medium text-slate-800 dark:text-slate-200 font-mono text-xs break-all sm:text-right">
                        {String(value)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="relative space-y-2">
              <div className="flex items-center justify-between text-slate-400 font-mono text-[10px]">
                <span>Format: JSON</span>
                <button
                  type="button"
                  onClick={handleCopyJson}
                  className="px-2.5 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg text-slate-700 dark:text-slate-300 font-bold transition flex items-center gap-1 cursor-pointer"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'Copied Payload!' : 'Copy JSON'}</span>
                </button>
              </div>

              <pre className="p-4 bg-slate-900 text-amber-300 rounded-2xl border border-slate-800 font-mono text-[11px] overflow-x-auto leading-relaxed">
                {jsonString}
              </pre>
            </div>
          )}
        </div>

        {/* Modal Footer Actions */}
        <div className="p-4 bg-slate-50/90 dark:bg-[#18181B]/90 border-t border-slate-100 dark:border-[#222F43] flex flex-wrap items-center justify-between gap-3 shrink-0 text-xs">
          {/* Status Marking Quick Triggers */}
          {onMarkStatus && record.guidance !== undefined && (
            <div className="flex items-center gap-1.5">
              <span className="text-slate-400 font-bold text-[10px] uppercase tracking-wider hidden sm:inline">
                Mark Status:
              </span>
              <button
                type="button"
                onClick={() => onMarkStatus(record, 'FOCUS')}
                className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-bold text-[11px] transition cursor-pointer"
              >
                Focus (Green)
              </button>
              <button
                type="button"
                onClick={() => onMarkStatus(record, 'DO_NOT_USE')}
                className="px-2.5 py-1 bg-rose-600 hover:bg-rose-500 text-white rounded-lg font-bold text-[11px] transition cursor-pointer"
              >
                Do Not Use
              </button>
              <button
                type="button"
                onClick={() => onMarkStatus(record, 'ALLOWED')}
                className="px-2.5 py-1 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-bold text-[11px] transition cursor-pointer"
              >
                Allowed
              </button>
            </div>
          )}

          <div className="flex items-center gap-2 ml-auto">
            {onEdit && (
              <button
                type="button"
                onClick={() => {
                  onEdit(record);
                  onClose();
                }}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold rounded-xl transition cursor-pointer flex items-center gap-1.5"
              >
                <Pencil className="w-3.5 h-3.5" />
                <span>Edit Document</span>
              </button>
            )}

            {onDelete && (
              <button
                type="button"
                onClick={handleDelete}
                className={`px-4 py-2 rounded-xl font-extrabold transition cursor-pointer flex items-center gap-1.5 ${
                  isConfirmingDelete
                    ? 'bg-rose-600 text-white hover:bg-rose-500'
                    : 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 hover:bg-rose-100'
                }`}
              >
                {isConfirmingDelete ? (
                  <>
                    <AlertTriangle className="w-3.5 h-3.5 text-white" />
                    <span>Confirm Delete?</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};
