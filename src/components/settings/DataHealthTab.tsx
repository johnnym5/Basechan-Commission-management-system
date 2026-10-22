import React, { useState, useEffect, useCallback } from 'react';
import type { CommissionRate } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { ensureRoleRateModelMigration, partitionMasterIntoRateSheets } from '../../services/rateReadModels';
import { AuditLogsDrawer } from '../AuditLogsDrawer';
import { DatabaseExplorer } from './DatabaseExplorer';
import {
  clearLocalSheetBuckets,
  clearPendingOfflineImports,
  deleteLocalRateDatabase,
  getPendingOfflineImports,
  type PendingOfflineImport,
} from '../../services/localRateDatabase';
import { uploadRatesInBatches } from '../../utils/firestoreBatcher';
import { archivePreviousIntakes } from '../../services/sheetManagementService';
import { isQuotaOffline, subscribeToFirestoreMode } from '../../services/firestoreOfflineMode';
import {
  ShieldCheck,
  RefreshCw,
  CheckCircle2,
  Database,
  Wifi,
  HardDrive,
  Clock,
  Shield,
  UploadCloud,
  Trash2,
} from 'lucide-react';

interface DataHealthTabProps {
  rates: CommissionRate[];
  onRefreshRates: () => void;
  onOpenAuditLogs?: () => void;
  onOpenLegalModal?: () => void;
  pendingOfflineImports?: PendingOfflineImport[];
  onPushOfflineImports?: () => Promise<void> | void;
}

export const DataHealthTab: React.FC<DataHealthTabProps> = ({
  rates,
  onRefreshRates,
  onOpenAuditLogs,
  onOpenLegalModal,
  pendingOfflineImports: propPendingImports,
  onPushOfflineImports,
}) => {
  const { user, role } = useAuth();
  const [isSyncing, setIsSyncing] = useState(false);
  const [isRebuilding, setIsRebuilding] = useState(false);
  const [statusNotice, setStatusNotice] = useState<string | null>(null);
  const [isAuditDrawerOpen, setIsAuditDrawerOpen] = useState(false);

  const [pendingImports, setPendingImports] = useState<PendingOfflineImport[]>(propPendingImports || []);
  const [isPushing, setIsPushing] = useState(false);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [isQuotaMode, setIsQuotaMode] = useState(isQuotaOffline(user?.uid));

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    return subscribeToFirestoreMode((uid) => {
      if (!uid || uid === user?.uid) setIsQuotaMode(isQuotaOffline(user?.uid));
    });
  }, [user?.uid]);

  const refreshPendingImports = useCallback(async () => {
    if (!user?.uid) {
      setPendingImports([]);
      return;
    }
    try {
      const items = await getPendingOfflineImports(user.uid);
      setPendingImports(items);
    } catch {
      setPendingImports([]);
    }
  }, [user?.uid]);

  useEffect(() => {
    if (propPendingImports) {
      setPendingImports(propPendingImports);
    } else {
      void refreshPendingImports();
    }
  }, [user?.uid, isOffline, isQuotaMode, propPendingImports, refreshPendingImports]);

  const handlePushOfflineImportsToCloud = async () => {
    if (!user?.uid || pendingImports.length === 0 || !navigator.onLine || isQuotaMode) return;
    setIsPushing(true);
    try {
      if (onPushOfflineImports) {
        await onPushOfflineImports();
      } else {
        const adminEmail = user.email || 'Admin';
        for (const item of pendingImports) {
          await uploadRatesInBatches(item.rates, undefined, adminEmail);
          const importedSheetNames = Array.from(
            new Set([
              ...(item.sheetNames || []),
              ...item.rates.map((r) => r.sourceSheet || r.intake).filter(Boolean) as string[],
            ])
          );
          for (const sheetName of importedSheetNames) {
            const clean = sheetName.trim();
            if (
              clean.toUpperCase() === '2027 MASTER BASELINE' ||
              clean.toUpperCase() === '2027 AGENT CONSOLIDATED MASTER'
            ) {
              try {
                await archivePreviousIntakes(clean, adminEmail);
              } catch (archiveErr) {
                console.error(`Error archiving previous intakes for ${clean}:`, archiveErr);
              }
            }
          }
        }
        await clearPendingOfflineImports(user.uid);
      }
      await refreshPendingImports();
      setStatusNotice('Offline imports pushed to Cloud successfully.');
      onRefreshRates();
    } catch (err) {
      console.error('Error pushing offline imports:', err);
      setStatusNotice('Error pushing offline imports to Cloud.');
    } finally {
      setIsPushing(false);
    }
  };

  const handleDeleteOfflineData = async () => {
    if (!user?.uid) return;
    if (!window.confirm(`Are you sure you want to delete ${pendingImports.length} offline batch(es) and clear local cached data? This cannot be undone.`)) return;
    try {
      await clearPendingOfflineImports(user.uid);
      await deleteLocalRateDatabase(user.uid).catch(() => {});
      await refreshPendingImports();
      setStatusNotice('Offline imported data and local cache deleted.');
      onRefreshRates();
    } catch (err) {
      console.error('Error deleting offline data:', err);
      setStatusNotice('Error deleting offline data.');
    }
  };

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

  const handleRebuildRateSheets = async () => {
    if (!user) return;
    setIsRebuilding(true);
    setStatusNotice(null);
    try {
      // Clear corrupted local sheetBuckets cache so next load re-fetches fresh data
      await clearLocalSheetBuckets(user.uid);
      // Rebuild ALL rate_sheets Firestore buckets from the canonical rates collection
      const count = await partitionMasterIntoRateSheets(user.email || 'Admin');
      setStatusNotice(`Admin rate sheets rebuilt successfully from ${count} canonical rates. Refreshing...`);
      onRefreshRates();
    } catch (err) {
      console.error('Error rebuilding rate sheets:', err);
      setStatusNotice('Error rebuilding rate sheets. Please check admin permissions and try again.');
    } finally {
      setIsRebuilding(false);
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

      {/* Offline Imports Sync Card (Admin Only) */}
      {(role === 'ADMIN' || !role) && (
        <div className="p-5 rounded-3xl bg-white dark:bg-[#0E1526] border border-slate-200 dark:border-[#222F43] shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-[#222F43] pb-3">
            <div className="flex items-center gap-2">
              <UploadCloud className="w-4 h-4 text-amber-500" />
              <h3 className="font-extrabold text-sm text-slate-900 dark:text-slate-100">
                Offline Imports Cloud Push
              </h3>
            </div>
            <span className="px-2 py-0.5 rounded text-[9px] font-black uppercase bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300">
              OFFLINE SYNC
            </span>
          </div>

          <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
            Manually push offline imported rate sheets and batches stored locally in IndexedDB to Firestore Cloud once connection is restored.
          </p>

          <div className="flex items-center justify-between pt-2 flex-wrap gap-2">
            <div className="text-xs text-slate-500 font-mono font-bold">
              Pending Batches: {pendingImports.length}
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                disabled={!navigator.onLine || isQuotaMode || pendingImports.length === 0 || isPushing}
                onClick={handlePushOfflineImportsToCloud}
                className={`px-5 py-2.5 font-extrabold text-xs rounded-xl shadow-xs transition cursor-pointer flex items-center gap-2 ${
                  !navigator.onLine || isQuotaMode || pendingImports.length === 0 || isPushing
                    ? 'bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-500 disabled opacity-50 cursor-not-allowed'
                    : 'bg-amber-400 hover:bg-amber-300 text-slate-950 dark:bg-amber-400 dark:hover:bg-amber-300'
                }`}
              >
                <UploadCloud className={`w-4 h-4 ${isPushing ? 'animate-spin' : ''}`} />
                <span>Push Offline Imports to Cloud</span>
              </button>

              <button
                type="button"
                onClick={handleDeleteOfflineData}
                className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-extrabold text-xs rounded-xl shadow-xs transition cursor-pointer flex items-center gap-1.5"
                title="Delete all pending offline imports and clear cached data"
              >
                <Trash2 className="w-4 h-4 text-rose-400" />
                <span>Delete Offline Data</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Admin Rate Sheets Repair Card */}
      {(role === 'ADMIN' || !role) && (
        <div className="p-5 rounded-3xl bg-white dark:bg-[#0E1526] border border-rose-200 dark:border-rose-900/50 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-rose-100 dark:border-rose-900/40 pb-3">
            <div className="flex items-center gap-2">
              <RefreshCw className="w-4 h-4 text-rose-500" />
              <h3 className="font-extrabold text-sm text-slate-900 dark:text-slate-100">
                Repair Admin Rate Sheets
              </h3>
            </div>
            <span className="px-2 py-0.5 rounded text-[9px] font-black uppercase bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300">
              DATA REPAIR
            </span>
          </div>

          <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
            Use this if the Admin view is showing only one university after a rate edit. This rebuilds all{' '}
            <b>rate_sheets</b> Firestore buckets from the complete canonical <b>rates</b> collection
            and clears your local cache so the full list reloads correctly.
          </p>

          <div className="flex items-center justify-between pt-2">
            <div className="text-xs text-slate-500 font-mono font-bold">
              Canonical Rates Available: {rates.length}
            </div>

            <button
              type="button"
              disabled={isRebuilding}
              onClick={handleRebuildRateSheets}
              className="px-5 py-2.5 bg-rose-600 dark:bg-rose-500 text-white font-extrabold text-xs rounded-xl shadow-xs hover:bg-rose-700 dark:hover:bg-rose-600 disabled:opacity-50 transition cursor-pointer flex items-center gap-2"
            >
              <RefreshCw className={`w-4 h-4 ${isRebuilding ? 'animate-spin' : ''}`} />
              <span>{isRebuilding ? 'Rebuilding Rate Sheets...' : 'Rebuild Admin Rate Sheets'}</span>
            </button>
          </div>
        </div>
      )}

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

      {/* Embedded Audit Trail & Trust/Privacy Center */}
      <div className="p-5 rounded-3xl bg-white dark:bg-[#0E1526] border border-slate-200 dark:border-[#222F43] shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-[#222F43] pb-3">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-blue-600 dark:text-amber-400" />
            <h3 className="font-extrabold text-sm text-slate-900 dark:text-slate-100">
              System Audit Trail & Legal Trust Center
            </h3>
          </div>
          <span className="px-2 py-0.5 rounded text-[9px] font-black uppercase bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
            AUDIT & PRIVACY
          </span>
        </div>

        <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
          Track all recent administrative modifications, rate edits, visibility toggles, and user access status changes in real-time, or inspect system privacy & compliance policies.
        </p>

        <div className="flex items-center gap-3 pt-2 flex-wrap">
          <button
            type="button"
            onClick={() => onOpenAuditLogs ? onOpenAuditLogs() : setIsAuditDrawerOpen(true)}
            className="px-5 py-2.5 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-950 font-extrabold text-xs rounded-xl shadow-xs transition cursor-pointer flex items-center gap-2"
          >
            <Clock className="w-4 h-4 text-amber-500 dark:text-amber-600" />
            <span>Open System Audit Log History</span>
          </button>

          {onOpenLegalModal && (
            <button
              type="button"
              onClick={onOpenLegalModal}
              className="px-5 py-2.5 bg-blue-600 dark:bg-blue-950/80 hover:bg-blue-500 text-white font-extrabold text-xs rounded-xl border border-blue-500/30 transition cursor-pointer flex items-center gap-2"
            >
              <Shield className="w-4 h-4 text-amber-300" />
              <span>Trust, Legal & Privacy Center</span>
            </button>
          )}
        </div>
      </div>

      <AuditLogsDrawer isOpen={isAuditDrawerOpen} onClose={() => setIsAuditDrawerOpen(false)} />
    </div>
  );
};
