import React, { useEffect, useState, useMemo } from 'react';
import type { CommissionRate, UserRole } from '../types';
import {
  Search,
  X,
  LayoutDashboard,
  TrendingUp,
  Users,
  Briefcase,
  Award,
  Calculator,
  Building2,
  ArrowRight,
  Upload,
  PlusCircle,
} from 'lucide-react';

interface CommandPaletteModalProps {
  isOpen: boolean;
  onClose: () => void;
  rates: CommissionRate[];
  role: UserRole;
  setCurrentPage: (page: string) => void;
  onOpenUpload?: () => void;
  onOpenAddRate?: () => void;
}

export const CommandPaletteModal: React.FC<CommandPaletteModalProps> = ({
  isOpen,
  onClose,
  rates,
  role,
  setCurrentPage,
  onOpenUpload,
  onOpenAddRate,
}) => {
  const [query, setQuery] = useState('');

  // Keyboard shortcut listener for Ctrl + K or Cmd + K
  useEffect(() => {
    if (!isOpen) {
      setQuery('');
    }
  }, [isOpen]);

  // Search Results
  const matchedRates = useMemo(() => {
    if (role !== 'ADMIN' || !query.trim()) return [];
    const q = query.toLowerCase().trim();
    return rates
      .filter((r) => `${r.universityName} ${r.aggregator} ${r.intake} ${r.studyLevel}`.toLowerCase().includes(q))
      .slice(0, 5);
  }, [rates, query, role]);

  const navActions = useMemo(() => {
    if (role !== 'ADMIN') return [{ name: 'Chat', icon: Briefcase, category: 'Pages' }];
    const pages = [
      { name: 'Dashboard', icon: LayoutDashboard, category: 'Pages' },
      { name: 'Compare Rates', icon: TrendingUp, category: 'Pages' },
      { name: 'Deal Calculator', icon: Calculator, category: 'Tools' },
      { name: 'Users & Activity', icon: Users, category: 'Management' },
      { name: 'Application Directory', icon: Briefcase, category: 'Portals' },
      { name: 'Agent Commissions', icon: Award, category: 'Portals' },
    ];

    if (!query.trim()) return pages;
    const q = query.toLowerCase().trim();
    return pages.filter((p) => p.name.toLowerCase().includes(q));
  }, [query, role]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 dark:bg-slate-950/80 backdrop-blur-xs flex items-start justify-center pt-16 sm:pt-24 p-4">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl max-w-xl w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150 flex flex-col">
        {/* Search Bar Input Header */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center gap-3 bg-slate-50 dark:bg-slate-800/60">
          <Search className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <input
            type="text"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type a university, intake, page, or command... (e.g. Aberdeen, Calculator)"
            className="w-full text-sm bg-transparent border-none focus:outline-hidden text-slate-900 dark:text-slate-100 placeholder-slate-400"
          />
          <span className="hidden sm:inline-block px-2 py-0.5 text-[10px] font-mono font-bold bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-md">
            ESC
          </span>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-lg cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Results List */}
        <div className="max-h-96 overflow-y-auto p-3 space-y-4 text-xs">
          {/* Action Commands Section */}
          <div className="space-y-1">
            <div className="px-2 py-1 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
              Navigation & Pages
            </div>

            {navActions.map((nav) => {
              const Icon = nav.icon;
              return (
                <button
                  key={nav.name}
                  onClick={() => {
                    setCurrentPage(nav.name);
                    onClose();
                  }}
                  className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-emerald-50 dark:hover:bg-emerald-950/40 text-slate-800 dark:text-slate-200 transition cursor-pointer text-left group"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-slate-100 dark:bg-slate-800 rounded-lg group-hover:bg-emerald-100 dark:group-hover:bg-emerald-900/60 text-slate-600 dark:text-slate-300 group-hover:text-emerald-700 dark:group-hover:text-emerald-300">
                      <Icon className="w-4 h-4" />
                    </div>
                    <span className="font-semibold">{nav.name}</span>
                  </div>
                  <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition" />
                </button>
              );
            })}
          </div>

          {/* Quick System Actions */}
          {!query && (
            <div className="space-y-1 pt-1 border-t border-slate-100 dark:border-slate-800">
              <div className="px-2 py-1 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                Quick Shortcuts
              </div>

              {onOpenAddRate && (
                <button
                  onClick={() => {
                    onOpenAddRate();
                    onClose();
                  }}
                  className="w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 transition cursor-pointer text-left"
                >
                  <PlusCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <span className="font-semibold">Add New Commission Rate</span>
                </button>
              )}

              {onOpenUpload && (
                <button
                  onClick={() => {
                    onOpenUpload();
                    onClose();
                  }}
                  className="w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 transition cursor-pointer text-left"
                >
                  <Upload className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  <span className="font-semibold">Import Excel Workbook</span>
                </button>
              )}
            </div>
          )}

          {/* University Rate Search Results */}
          {matchedRates.length > 0 && (
            <div className="space-y-1 pt-1 border-t border-slate-100 dark:border-slate-800">
              <div className="px-2 py-1 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                Matching Universities ({matchedRates.length})
              </div>

              {matchedRates.map((r) => (
                <button
                  key={r.id}
                  onClick={() => {
                    setCurrentPage('Dashboard');
                    onClose();
                  }}
                  className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 transition cursor-pointer text-left"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Building2 className="w-4 h-4 text-slate-400 shrink-0" />
                    <div className="truncate">
                      <p className="font-semibold text-slate-900 dark:text-slate-100 truncate">{r.universityName}</p>
                      <p className="text-[10px] text-slate-400">{r.aggregator} • {r.intake} • {r.studyLevel}</p>
                    </div>
                  </div>

                  <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 shrink-0">
                    {r.diffMargin}{r.isFlatFee ? '£' : '%'}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 bg-slate-50 dark:bg-slate-800/60 border-t border-slate-200 dark:border-slate-800 text-[11px] text-slate-400 flex items-center justify-between">
          <span>Tip: Press <kbd className="font-mono bg-slate-200 dark:bg-slate-700 px-1 py-0.5 rounded text-slate-700 dark:text-slate-300">Ctrl + K</kbd> anywhere to open</span>
          <span className="font-semibold">Basechan CMS</span>
        </div>
      </div>
    </div>
  );
};
