import React, { useMemo } from 'react';
import { createPortal } from 'react-dom';
import type { CommissionRate } from '../types';
import { useSheetVisibility } from '../hooks/useSheetVisibility';
import { useAuth } from '../context/AuthContext';
import {
  X,
  EyeOff,
  UserCheck,
  UserX,
  Layers3,
  Check,
} from 'lucide-react';

interface SheetVisibilityModalProps {
  rates: CommissionRate[];
  isOpen: boolean;
  onClose: () => void;
}

export const SheetVisibilityModal: React.FC<SheetVisibilityModalProps> = ({
  rates,
  isOpen,
  onClose,
}) => {
  const { user } = useAuth();
  const { sheetSettings, updateSheetVisibility } = useSheetVisibility();

  // Extract unique intake sheets & total counts
  const sheetSummary = useMemo(() => {
    const map = new Map<string, number>();

    rates.forEach((r) => {
      const sheetName = r.sourceSheet || r.intake || 'Standard Sheet';
      map.set(sheetName, (map.get(sheetName) || 0) + 1);
    });

    return Array.from(map.entries()).map(([name, count]) => ({
      name,
      count,
    })).sort((a, b) => b.count - a.count);
  }, [rates]);

  if (!isOpen) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-hidden animate-backdrop-fade"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative my-auto max-w-lg w-full max-h-[85vh] bg-white dark:bg-[#0E1526] text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-[#222F43] rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-modal-pop z-[10000]"
      >
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-[#222F43] flex items-center justify-between bg-slate-50/90 dark:bg-[#18181B]/90 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-indigo-500/15 text-indigo-500 dark:text-amber-400 rounded-xl border border-indigo-400/30">
              <EyeOff className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm sm:text-base text-slate-900 dark:text-slate-100">
                Sheet & Intake Visibility Manager
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Disable or enable specific intake sheets for Staff or Agents
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

        {/* Modal Body */}
        <div className="p-5 space-y-4 overflow-y-auto flex-1 text-xs">
          <div className="p-3 bg-indigo-50/60 dark:bg-indigo-950/40 rounded-2xl border border-indigo-200 dark:border-indigo-800/80 text-indigo-900 dark:text-indigo-200 text-xs">
            <p className="font-semibold">
              Disabling a sheet hides all associated universities, rates, and totals for selected user roles (Staff or Agents). Admin access remains unaffected.
            </p>
          </div>

          <div className="space-y-3">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              Active Intake Sheets ({sheetSummary.length}):
            </span>

            {sheetSummary.map((sheet) => {
              const setting = sheetSettings.find((s) => s.sheetName === sheet.name || s.id === sheet.name);
              const isHiddenStaff = setting?.disabledForStaff || false;
              const isHiddenAgents = setting?.disabledForAgents || false;

              return (
                <div
                  key={sheet.name}
                  className="p-4 rounded-2xl bg-slate-50 dark:bg-[#18181B] border border-slate-200 dark:border-[#222F43] space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Layers3 className="w-4 h-4 text-indigo-500 dark:text-amber-400" />
                      <span className="font-extrabold text-xs text-slate-900 dark:text-slate-100">
                        {sheet.name}
                      </span>
                    </div>

                    <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                      {sheet.count} {sheet.count === 1 ? 'Rate' : 'Rates'}
                    </span>
                  </div>

                  {/* Toggle Controls Grid */}
                  <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-200/80 dark:border-[#222F43]">
                    {/* Hide for Staff */}
                    <button
                      type="button"
                      onClick={() =>
                        updateSheetVisibility(
                          sheet.name,
                          'STAFF',
                          !isHiddenStaff,
                          user?.email || 'Admin'
                        )
                      }
                      className={`p-2.5 rounded-xl border font-bold text-[11px] flex items-center justify-between transition cursor-pointer ${
                        isHiddenStaff
                          ? 'bg-rose-50 dark:bg-rose-950/60 border-rose-300 dark:border-rose-800 text-rose-700 dark:text-rose-300'
                          : 'bg-white dark:bg-[#0E1526] border-slate-200 dark:border-[#222F43] text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                      }`}
                    >
                      <span className="flex items-center gap-1.5">
                        <UserCheck className="w-3.5 h-3.5" />
                        <span>Hide for Staff</span>
                      </span>
                      {isHiddenStaff ? <EyeOff className="w-3.5 h-3.5 text-rose-500" /> : <Check className="w-3.5 h-3.5 text-emerald-500" />}
                    </button>

                    {/* Hide for Agents */}
                    <button
                      type="button"
                      onClick={() =>
                        updateSheetVisibility(
                          sheet.name,
                          'AGENT',
                          !isHiddenAgents,
                          user?.email || 'Admin'
                        )
                      }
                      className={`p-2.5 rounded-xl border font-bold text-[11px] flex items-center justify-between transition cursor-pointer ${
                        isHiddenAgents
                          ? 'bg-rose-50 dark:bg-rose-950/60 border-rose-300 dark:border-rose-800 text-rose-700 dark:text-rose-300'
                          : 'bg-white dark:bg-[#0E1526] border-slate-200 dark:border-[#222F43] text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                      }`}
                    >
                      <span className="flex items-center gap-1.5">
                        <UserX className="w-3.5 h-3.5" />
                        <span>Hide for Agents</span>
                      </span>
                      {isHiddenAgents ? <EyeOff className="w-3.5 h-3.5 text-rose-500" /> : <Check className="w-3.5 h-3.5 text-emerald-500" />}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50/90 dark:bg-[#18181B]/90 border-t border-slate-100 dark:border-[#222F43] flex items-center justify-end shrink-0">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-blue-600 dark:bg-amber-400 text-white dark:text-slate-950 font-extrabold text-xs rounded-xl shadow-xs hover:bg-blue-700 dark:hover:bg-amber-500 transition cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};
