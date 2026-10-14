import React, { useState, useEffect } from 'react';
import {
  Box,
  CloudUpload,
  Trash2,
  XCircle,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Database,
} from 'lucide-react';
import {
  isSandboxActive,
  setSandboxActive,
  getSandboxStagedCount,
  migrateSandboxToCloud,
  type MigrationProgress,
} from '../services/sandboxService';
import { clearPendingOfflineImports, deleteLocalRateDatabase } from '../services/localRateDatabase';
import { useAuth } from '../context/AuthContext';

interface SandboxBannerProps {
  onRatesUpdated?: () => void;
}

export const SandboxBanner: React.FC<SandboxBannerProps> = ({ onRatesUpdated }) => {
  const { user, role } = useAuth();
  const [active, setActive] = useState<boolean>(isSandboxActive());
  const [stagedCount, setStagedCount] = useState<number>(0);
  const [migrating, setMigrating] = useState<boolean>(false);
  const [progress, setProgress] = useState<MigrationProgress | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const loadSandboxStatus = async () => {
    if (!user?.uid) return;
    try {
      const count = await getSandboxStagedCount(user.uid);
      setStagedCount(count);
    } catch {
      setStagedCount(0);
    }
  };

  useEffect(() => {
    setActive(isSandboxActive());
    if (isSandboxActive() && user?.uid) {
      loadSandboxStatus();
    }
  }, [user?.uid]);

  if (!active || role !== 'ADMIN') return null;

  const handleMigrateToCloud = async () => {
    if (!user?.uid) return;
    setMigrating(true);
    setMessage(null);
    setProgress(null);

    try {
      const result = await migrateSandboxToCloud(user.uid, (p) => {
        setProgress(p);
      });

      setMessage({
        type: 'success',
        text: `Successfully migrated ${result.migratedCount} sandbox records to Firestore Cloud!`,
      });

      await loadSandboxStatus();
      if (onRatesUpdated) onRatesUpdated();
    } catch (err: any) {
      setMessage({
        type: 'error',
        text: err.message || 'Failed to migrate sandbox data to Firestore.',
      });
    } finally {
      setMigrating(false);
    }
  };

  const handleClearSandbox = async () => {
    if (!user?.uid) return;
    if (!window.confirm('Are you sure you want to clear all offline sandbox data?')) return;

    try {
      await clearPendingOfflineImports(user.uid);
      await deleteLocalRateDatabase(user.uid);
      setStagedCount(0);
      setMessage({ type: 'success', text: 'Offline sandbox data cleared successfully.' });
      if (onRatesUpdated) onRatesUpdated();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to clear sandbox database.' });
    }
  };

  const handleExitSandbox = () => {
    setSandboxActive(false);
    setActive(false);
    if (onRatesUpdated) onRatesUpdated();
  };

  return (
    <div className="bg-amber-500/15 dark:bg-amber-950/40 border-b border-amber-400/30 text-amber-900 dark:text-amber-200 px-4 py-3 sm:px-6 transition-all">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        {/* Banner Left: Sandbox Icon & Title */}
        <div className="flex items-center gap-3">
          <div className="p-2 bg-amber-500/20 text-amber-600 dark:text-amber-400 rounded-xl shrink-0">
            <Box className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-black text-xs sm:text-sm tracking-wide uppercase">
                OFFLINE SANDBOX MODE ACTIVE
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-amber-500/25 text-amber-800 dark:text-amber-300 border border-amber-400/40 flex items-center gap-1">
                <Database className="w-3 h-3" />
                {stagedCount} Staged Records
              </span>
            </div>
            <p className="text-[11px] text-amber-800/80 dark:text-amber-300/80">
              Working strictly on local IndexedDB sandbox database. Imports and updates remain offline until migrated.
            </p>
          </div>
        </div>

        {/* Banner Right: Actions */}
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          <button
            onClick={handleMigrateToCloud}
            disabled={migrating || stagedCount === 0}
            className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white font-bold rounded-xl text-xs transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
            title="Migrate all offline sandbox records to Firestore Cloud"
          >
            {migrating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CloudUpload className="w-3.5 h-3.5" />}
            <span>{migrating ? `Migrating (${progress?.percentage || 0}%)...` : 'Migrate to Firestore (Online)'}</span>
          </button>

          <button
            onClick={handleClearSandbox}
            disabled={migrating || stagedCount === 0}
            className="px-2.5 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-900 dark:text-amber-200 font-bold rounded-xl text-xs transition flex items-center gap-1 cursor-pointer"
            title="Clear offline sandbox database"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Clear Sandbox</span>
          </button>

          <button
            onClick={handleExitSandbox}
            className="px-2.5 py-1.5 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold rounded-xl text-xs transition flex items-center gap-1 cursor-pointer"
            title="Exit Offline Sandbox Mode"
          >
            <XCircle className="w-3.5 h-3.5" />
            <span>Exit Sandbox</span>
          </button>
        </div>
      </div>

      {/* Migration Progress Bar / Status Message */}
      {migrating && progress && (
        <div className="mt-2 max-w-7xl mx-auto space-y-1">
          <div className="w-full bg-amber-200 dark:bg-amber-900/60 rounded-full h-1.5 overflow-hidden">
            <div
              className="bg-amber-600 h-1.5 transition-all duration-200"
              style={{ width: `${progress.percentage}%` }}
            />
          </div>
          <p className="text-[10px] text-amber-800 dark:text-amber-300 font-mono">
            Chunk {progress.currentChunk} of {progress.totalChunks} ({progress.completed} / {progress.total} rates migrated)
          </p>
        </div>
      )}

      {message && (
        <div className={`mt-2 max-w-7xl mx-auto p-2 rounded-xl text-xs font-semibold flex items-center gap-2 ${
          message.type === 'success'
            ? 'bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 border border-emerald-500/30'
            : 'bg-rose-500/20 text-rose-800 dark:text-rose-300 border border-rose-500/30'
        }`}>
          {message.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertTriangle className="w-4 h-4 shrink-0" />}
          <span>{message.text}</span>
        </div>
      )}
    </div>
  );
};
