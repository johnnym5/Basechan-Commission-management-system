import React, { useState } from 'react';
import type { CommissionRate } from '../types';
import { useAuth } from '../context/AuthContext';
import { SheetVisibilityTab } from './settings/SheetVisibilityTab';
import { UserManagementTab } from './settings/UserManagementTab';
import { IntakeMigrationTab } from './settings/IntakeMigrationTab';
import { AnnouncementsTab } from './settings/AnnouncementsTab';
import { DataHealthTab } from './settings/DataHealthTab';
import {
  SlidersHorizontal,
  Users,
  Copy,
  Megaphone,
  ShieldCheck,
  Lock,
} from 'lucide-react';

interface SettingsViewProps {
  rates: CommissionRate[];
  onRefreshRates: () => void;
}

export type SettingsTab = 'sheets' | 'users' | 'migration' | 'announcements' | 'health';

export const SettingsView: React.FC<SettingsViewProps> = ({ rates, onRefreshRates }) => {
  const { role } = useAuth();
  const [activeTab, setActiveTab] = useState<SettingsTab>('sheets');

  // Role Access Guard: Non-admin users are blocked from rendering SettingsView
  if (role !== 'ADMIN') {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center p-6 text-center space-y-3">
        <div className="p-3 bg-rose-500/15 text-rose-500 rounded-2xl border border-rose-400/30">
          <Lock className="w-8 h-8" />
        </div>
        <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Access Restricted</h2>
        <p className="text-xs text-slate-500 max-w-sm">
          System Settings are available exclusively to Administrator accounts.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-2 sm:px-4 py-4 animate-page-enter">
      {/* Top Page Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-5 rounded-3xl bg-slate-900 text-white shadow-xl border border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-amber-400 text-slate-950">
              ADMIN CONTROL CENTER
            </span>
            <span className="text-xs text-slate-400 font-mono">Basechan CMS v1.0</span>
          </div>
          <h1 className="mt-1 text-xl sm:text-2xl font-extrabold tracking-tight">
            System Settings & Administration
          </h1>
          <p className="text-xs text-slate-300 mt-0.5">
            Configure system defaults, manage sheet & role visibility, agency access requests, intake migration, announcements, and data health.
          </p>
        </div>
      </div>

      {/* Top Navigation Tab Bar */}
      <div className="flex items-center gap-1.5 p-1.5 rounded-2xl bg-slate-100 dark:bg-[#0E1526] border border-slate-200 dark:border-[#222F43] overflow-x-auto text-xs font-bold scrollbar-none">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'sheets'}
          onClick={() => setActiveTab('sheets')}
          className={`px-4 py-2.5 rounded-xl transition cursor-pointer flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'sheets'
              ? 'bg-white dark:bg-[#18181B] text-blue-600 dark:text-amber-400 shadow-xs border border-slate-200/80 dark:border-[#222F43]'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          <SlidersHorizontal className="w-4 h-4 shrink-0" />
          <span>Sheet & Default Filters</span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'users'}
          onClick={() => setActiveTab('users')}
          className={`px-4 py-2.5 rounded-xl transition cursor-pointer flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'users'
              ? 'bg-white dark:bg-[#18181B] text-blue-600 dark:text-amber-400 shadow-xs border border-slate-200/80 dark:border-[#222F43]'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          <Users className="w-4 h-4 shrink-0" />
          <span>Users & Agencies</span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'migration'}
          onClick={() => setActiveTab('migration')}
          className={`px-4 py-2.5 rounded-xl transition cursor-pointer flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'migration'
              ? 'bg-white dark:bg-[#18181B] text-blue-600 dark:text-amber-400 shadow-xs border border-slate-200/80 dark:border-[#222F43]'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          <Copy className="w-4 h-4 shrink-0" />
          <span>Intake & Migration</span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'announcements'}
          onClick={() => setActiveTab('announcements')}
          className={`px-4 py-2.5 rounded-xl transition cursor-pointer flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'announcements'
              ? 'bg-white dark:bg-[#18181B] text-blue-600 dark:text-amber-400 shadow-xs border border-slate-200/80 dark:border-[#222F43]'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          <Megaphone className="w-4 h-4 shrink-0" />
          <span>Announcements</span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'health'}
          onClick={() => setActiveTab('health')}
          className={`px-4 py-2.5 rounded-xl transition cursor-pointer flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'health'
              ? 'bg-white dark:bg-[#18181B] text-blue-600 dark:text-amber-400 shadow-xs border border-slate-200/80 dark:border-[#222F43]'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          <ShieldCheck className="w-4 h-4 shrink-0" />
          <span>Data Health & Audit</span>
        </button>
      </div>

      {/* Tab Contents */}
      <div className="pt-2">
        {activeTab === 'sheets' && <SheetVisibilityTab rates={rates} />}
        {activeTab === 'users' && <UserManagementTab />}
        {activeTab === 'migration' && <IntakeMigrationTab rates={rates} onRefreshRates={onRefreshRates} />}
        {activeTab === 'announcements' && <AnnouncementsTab />}
        {activeTab === 'health' && <DataHealthTab rates={rates} onRefreshRates={onRefreshRates} />}
      </div>
    </div>
  );
};
