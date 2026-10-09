import React, { useState } from 'react';
import type { CommissionRate } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { ensureRoleRateModelMigration } from '../../services/rateReadModels';
import { AuditLogsDrawer } from '../AuditLogsDrawer';
import { DatabaseExplorer } from './DatabaseExplorer';
import {
  ShieldCheck,
  RefreshCw,
  CheckCircle2,
  Database,
  Wifi,
  HardDrive,
  Clock,
} from 'lucide-react';

interface DataHealthTabProps {
  rates: CommissionRate[];
  onRefreshRates: () => void;
}

export const DataHealthTab: React.FC<DataHealthTabProps> = ({ rates, onRefreshRates }) => {
  const { user } = useAuth();
  const [isSyncing, setIsSyncing] = useState(false);
  const [statusNotice, setStatusNotice] = useState<string | null>(null);
  const [isAuditDrawerOpen, setIsAuditDrawerOpen] = useState(false);

  const handleSyncProjections = async () => {
    if (!user) return;
    setIsSyncing(true);
    setStatusNotice(null);

    try {
      await ensureRoleRateModelMigration(rates, user.email || 'Admin', true);
      setStatusNotice('Role projections (Staff and Agent rate models) resynced successfully.');
      onRefreshRates();
    } catch (err) {
      console.error('Error resyncing projections:', err);
      setStatusNotice('Error resyncing projections. Please check admin permissions.');
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="space-y-6">
      {statusNotice && (
        <div className="p-4 rounded-2xl bg-emerald-500/15 border border-emerald-400/30 text-emerald-900 dark:text-emerald-200 text-xs font-bold flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
            <span>{statusNotice}</span>
          </div>
          <button
            type="button"
            onClick={() => setStatusNotice(null)}
            className="text-xs hover:underline cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Database Explorer Section */}
      <div className="space-y-4">
        <div className="p-5 rounded-3xl bg-white dark:bg-[#0E1526] border border-slate-200 dark:border-[#222F43] shadow-sm space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Database className="w-5 h-5 text-blue-600 dark:text-amber-400" />
              <h3 className="font-extrabold text-base text-slate-900 dark:text-slate-100">
                Interactive Database Explorer
              </h3>
            </div>
            <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase bg-blue-100 dark:bg-amber-950 text-blue-800 dark:text-amber-300">
              CRUD & BATCH MANAGEMENT
            </span>
          </div>

          <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
            Inspect, search, and manage all database collections in real-time. Select document cards to perform batch guidance marking, field edits, bulk deletions, or inspect raw JSON payloads.
          </p>
        </div>

        <DatabaseExplorer rates={rates} onRefreshRates={onRefreshRates} />
      </div>

      {/* Role Projection Rebuild Card */}
      <div className="p-5 rounded-3xl bg-white dark:bg-[#0E1526] border border-slate-200 dark:border-[#222F43] shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-[#222F43] pb-3">
          <div className="flex items-center gap-2">
            <Database className="w-4 h-4 text-blue-600 dark:text-amber-400" />
            <h3 className="font-extrabold text-sm text-slate-900 dark:text-slate-100">
              Role Projection Sync & Maintenance
            </h3>
          </div>
          <span className="px-2 py-0.5 rounded text-[9px] font-black uppercase bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300">
            PROJECTION HEALTH
          </span>
        </div>

        <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
          Basechan CMS maintains secure, role-specific read models (<b>staff_rates</b> for Staff and <b>agent_rates</b> for Agents) projected from canonical rates. Click below to resync role projections if rates were modified manually or during offline modes.
        </p>

        <div className="flex items-center justify-between pt-2">
          <div className="text-xs text-slate-500 font-mono font-bold">
            Total Canonical Rates: {rates.length}
          </div>

          <button
            type="button"
            disabled={isSyncing}
            onClick={handleSyncProjections}
            className="px-5 py-2.5 bg-blue-600 dark:bg-amber-400 text-white dark:text-slate-950 font-extrabold text-xs rounded-xl shadow-xs hover:bg-blue-700 dark:hover:bg-amber-500 disabled:opacity-50 transition cursor-pointer flex items-center gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
            <span>{isSyncing ? 'Resyncing Projections...' : 'Resync Role Projections'}</span>
          </button>
        </div>
      </div>

      {/* System Health Status Monitor Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
        <div className="p-4 rounded-2xl bg-white dark:bg-[#0E1526] border border-slate-200 dark:border-[#222F43] space-y-1.5">
          <div className="flex items-center justify-between text-slate-500">
            <span className="font-bold">Firestore Database</span>
            <Wifi className="w-4 h-4 text-emerald-500" />
          </div>
          <p className="font-extrabold text-sm text-slate-900 dark:text-slate-100">Online & Connected</p>
          <p className="text-[10px] text-slate-400">Real-time sync active</p>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-[#0E1526] border border-slate-200 dark:border-[#222F43] space-y-1.5">
          <div className="flex items-center justify-between text-slate-500">
            <span className="font-bold">Local IndexedDB</span>
            <HardDrive className="w-4 h-4 text-blue-500 dark:text-amber-400" />
          </div>
          <p className="font-extrabold text-sm text-slate-900 dark:text-slate-100">Offline Copy Saved</p>
          <p className="text-[10px] text-slate-400">IndexedDB local database active</p>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-[#0E1526] border border-slate-200 dark:border-[#222F43] space-y-1.5">
          <div className="flex items-center justify-between text-slate-500">
            <span className="font-bold">Security Rules</span>
            <ShieldCheck className="w-4 h-4 text-emerald-500" />
          </div>
          <p className="font-extrabold text-sm text-slate-900 dark:text-slate-100">Active & Enforced</p>
          <p className="text-[10px] text-slate-400">Domain & organization rules enforced</p>
        </div>
      </div>

      {/* Embedded Audit Trail & History Log */}
      <div className="p-5 rounded-3xl bg-white dark:bg-[#0E1526] border border-slate-200 dark:border-[#222F43] shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-[#222F43] pb-3">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-blue-600 dark:text-amber-400" />
            <h3 className="font-extrabold text-sm text-slate-900 dark:text-slate-100">
              System Audit Trail & History
            </h3>
          </div>
          <span className="px-2 py-0.5 rounded text-[9px] font-black uppercase bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
            AUDIT LOGS
          </span>
        </div>

        <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
          Track all recent administrative modifications, rate edits, visibility toggles, and user access status changes in real-time.
        </p>

        <div className="flex items-center justify-between pt-2">
          <button
            type="button"
            onClick={() => setIsAuditDrawerOpen(true)}
            className="px-5 py-2.5 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-950 font-extrabold text-xs rounded-xl shadow-xs transition cursor-pointer flex items-center gap-2"
          >
            <Clock className="w-4 h-4" />
            <span>Open System Audit Log History</span>
          </button>
        </div>
      </div>

      <AuditLogsDrawer isOpen={isAuditDrawerOpen} onClose={() => setIsAuditDrawerOpen(false)} />
    </div>
  );
};
