import React, { useState, useMemo } from 'react';
import type { CommissionRate } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { useSystemConfig } from '../../hooks/useSystemConfig';
import {
  deleteSheets,
  renameSheet,
  toggleSheetVisibility,
  setSheetAsDefault,
} from '../../services/sheetManagementService';
import { getIntakeDeadlineInfo } from '../../utils/intakeDeadlineUtils';
import {
  Search,
  Trash2,
  Pencil,
  Eye,
  EyeOff,
  Star,
  PlusCircle,
  Copy,
  X,
  Layers,
  AlertTriangle,
  Loader2,
  UploadCloud,
} from 'lucide-react';

export interface SheetManagerProps {
  rates: CommissionRate[];
  sheetSettings: Record<string, { STAFF: boolean; AGENT: boolean }>;
  defaultIntake?: string;
  onRefreshRates?: () => void;
  onOpenUpload?: () => void;
  onOpenAddRate?: () => void;
  onOpenMigrateIntake?: () => void;
}

export const SheetManager: React.FC<SheetManagerProps> = ({
  rates,
  sheetSettings,
  defaultIntake,
  onRefreshRates,
  onOpenUpload,
  onOpenAddRate,
  onOpenMigrateIntake,
}) => {
  const { user } = useAuth();
  const adminEmail = user?.email || 'admin@basechan.com';
  const { intakeLifecycles } = useSystemConfig();

  // Toolbar & Filtering state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSheets, setSelectedSheets] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Safety Confirmation Modals state
  const [deleteModal, setDeleteModal] = useState<{
    open: boolean;
    sheets: string[];
  } | null>(null);

  const [purgeModalOpen, setPurgeModalOpen] = useState(false);
  const [purgeInput, setPurgeInput] = useState('');

  const [editModal, setEditModal] = useState<{
    open: boolean;
    oldName: string;
    newName: string;
  } | null>(null);

  // Derive unique list of sheets and total rate counts
  const allSheetCards = useMemo(() => {
    const rateCounts = new Map<string, number>();

    rates.forEach((r) => {
      const sheetName = r.sourceSheet || r.intake;
      if (sheetName && sheetName.trim()) {
        const cleanName = sheetName.trim();
        rateCounts.set(cleanName, (rateCounts.get(cleanName) || 0) + 1);
      }
    });

    const nameSet = new Set<string>([
      ...Array.from(rateCounts.keys()),
      ...Object.keys(sheetSettings),
      ...(defaultIntake ? [defaultIntake] : []),
    ]);

    return Array.from(nameSet)
      .filter((name) => Boolean(name && name.trim()))
      .map((name) => ({
        name,
        count: rateCounts.get(name) || 0,
        staffVisible: sheetSettings[name]?.STAFF ?? true,
        agentVisible: sheetSettings[name]?.AGENT ?? true,
        isDefault: name === defaultIntake,
      }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  }, [rates, sheetSettings, defaultIntake]);

  // Filter sheets by search query
  const filteredSheetCards = useMemo(() => {
    if (!searchQuery.trim()) return allSheetCards;
    const query = searchQuery.toLowerCase().trim();
    return allSheetCards.filter((card) =>
      card.name.toLowerCase().includes(query)
    );
  }, [allSheetCards, searchQuery]);

  // Selection handlers
  const allFilteredSelected =
    filteredSheetCards.length > 0 &&
    filteredSheetCards.every((c) => selectedSheets.includes(c.name));

  const handleToggleSelectAll = () => {
    if (allFilteredSelected) {
      setSelectedSheets([]);
    } else {
      setSelectedSheets(filteredSheetCards.map((c) => c.name));
    }
  };

  const handleToggleSelectSheet = (name: string) => {
    setSelectedSheets((prev) =>
      prev.includes(name) ? prev.filter((s) => s !== name) : [...prev, name]
    );
  };

  // Helper for status badge
  const getSheetStatus = (
    sheetName: string
  ): 'Active' | 'Closing Soon' | 'Archived' => {
    const lifecycle = intakeLifecycles[sheetName];
    if (lifecycle?.status === 'archived') return 'Archived';
    if (lifecycle?.status === 'closing') return 'Closing Soon';
    if (lifecycle?.status === 'active') return 'Active';

    const deadline = getIntakeDeadlineInfo(sheetName);
    if (deadline.status === 'URGENT' || deadline.status === 'PASSED') {
      return 'Closing Soon';
    }
    return 'Active';
  };

  // Visibility toggle
  const handleToggleVisibility = async (
    sheetName: string,
    role: 'STAFF' | 'AGENT',
    currentlyVisible: boolean
  ) => {
    try {
      setIsSubmitting(true);
      await toggleSheetVisibility(
        sheetName,
        role,
        currentlyVisible, // disabled = currentlyVisible (if visible, set disabled=true)
        adminEmail
      );
      onRefreshRates?.();
    } catch (err) {
      console.error(`Error toggling ${role} visibility for ${sheetName}:`, err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Bulk visibility toggles
  const handleBulkToggleVisibility = async (
    role: 'STAFF' | 'AGENT',
    disabled: boolean
  ) => {
    if (selectedSheets.length === 0) return;
    try {
      setIsSubmitting(true);
      await Promise.all(
        selectedSheets.map((sheetName) =>
          toggleSheetVisibility(sheetName, role, disabled, adminEmail)
        )
      );
      onRefreshRates?.();
    } catch (err) {
      console.error(`Error applying bulk ${role} visibility:`, err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Default sheet setter
  const handleSetDefault = async (sheetName: string) => {
    try {
      setIsSubmitting(true);
      await setSheetAsDefault(sheetName, adminEmail);
      onRefreshRates?.();
    } catch (err) {
      console.error(`Error setting default sheet ${sheetName}:`, err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Delete handlers
  const handleConfirmDelete = async () => {
    if (!deleteModal || deleteModal.sheets.length === 0) return;
    try {
      setIsSubmitting(true);
      await deleteSheets(deleteModal.sheets, adminEmail);
      setSelectedSheets((prev) =>
        prev.filter((s) => !deleteModal.sheets.includes(s))
      );
      setDeleteModal(null);
      onRefreshRates?.();
    } catch (err) {
      console.error('Error deleting sheets:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmPurgeAll = async () => {
    if (purgeInput !== 'DELETE ALL SHEETS') return;
    try {
      setIsSubmitting(true);
      const allNames = allSheetCards.map((c) => c.name);
      await deleteSheets(allNames, adminEmail);
      setSelectedSheets([]);
      setPurgeModalOpen(false);
      setPurgeInput('');
      onRefreshRates?.();
    } catch (err) {
      console.error('Error purging all sheets:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Edit / Rename handler
  const handleConfirmRename = async () => {
    if (!editModal || !editModal.newName.trim()) return;
    const { oldName, newName } = editModal;
    if (oldName === newName.trim()) {
      setEditModal(null);
      return;
    }
    try {
      setIsSubmitting(true);
      await renameSheet(oldName, newName.trim(), adminEmail);
      setSelectedSheets((prev) =>
        prev.map((s) => (s === oldName ? newName.trim() : s))
      );
      setEditModal(null);
      onRefreshRates?.();
    } catch (err) {
      console.error(`Error renaming sheet from ${oldName} to ${newName}:`, err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Quick Actions */}
      <div className="p-4 sm:p-5 rounded-3xl bg-slate-900 text-white border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-md">
        <div className="flex items-start gap-3">
          <Layers className="w-6 h-6 text-amber-400 shrink-0 mt-0.5" />
          <div>
            <h2 className="text-lg font-extrabold tracking-tight">
              Sheet & Intake Manager
            </h2>
            <p className="text-xs text-slate-300 mt-0.5">
              Manage sheet lifecycles, configure default intake, toggle role access, and perform batch operations across all intake sheets.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap shrink-0">
          {onOpenUpload && (
            <button
              type="button"
              onClick={onOpenUpload}
              className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs transition cursor-pointer flex items-center gap-1.5 shadow-sm active:scale-95"
            >
              <UploadCloud className="w-4 h-4" />
              <span>Import Master Sheets</span>
            </button>
          )}

          {onOpenAddRate && (
            <button
              type="button"
              onClick={onOpenAddRate}
              className="px-3.5 py-2 rounded-xl bg-amber-400 text-slate-950 hover:bg-amber-300 font-extrabold text-xs transition cursor-pointer flex items-center gap-1.5 shadow-sm active:scale-95"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Add Rate / Intake</span>
            </button>
          )}

          {onOpenMigrateIntake && (
            <button
              type="button"
              onClick={onOpenMigrateIntake}
              className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-extrabold text-xs transition cursor-pointer flex items-center gap-1.5 shadow-sm active:scale-95"
            >
              <Copy className="w-4 h-4 text-amber-400" />
              <span>Clone Intake Sheet</span>
            </button>
          )}
        </div>
      </div>

      {/* Top Toolbar */}
      <div className="p-4 rounded-3xl bg-white dark:bg-[#0E1526] border border-slate-200 dark:border-[#222F43] shadow-sm space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Select All & Search */}
          <div className="flex items-center gap-3 flex-1 flex-wrap">
            <label className="flex items-center gap-2 text-xs font-extrabold text-slate-700 dark:text-slate-300 cursor-pointer select-none">
              <input
                type="checkbox"
                aria-label="Select all sheets"
                checked={allFilteredSelected}
                onChange={handleToggleSelectAll}
                className="w-4 h-4 rounded border-slate-300 text-amber-500 focus:ring-amber-400 cursor-pointer"
              />
              <span>Select All / Deselect All</span>
            </label>

            <div className="relative flex-1 max-w-md min-w-[200px]">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filter sheet names..."
                className="w-full pl-9 pr-8 py-2 rounded-xl border border-slate-300 dark:border-[#222F43] bg-slate-50 dark:bg-[#18181B] text-slate-900 dark:text-slate-100 text-xs focus:ring-2 focus:ring-amber-400 outline-none"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Purge All Button */}
          <div>
            <button
              type="button"
              onClick={() => {
                setPurgeInput('');
                setPurgeModalOpen(true);
              }}
              className="px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-extrabold text-xs transition cursor-pointer flex items-center gap-1.5 shadow-sm active:scale-95"
            >
              <Trash2 className="w-4 h-4" />
              <span>Purge All Sheets</span>
            </button>
          </div>
        </div>

        {/* Bulk Actions Bar */}
        {selectedSheets.length > 0 && (
          <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-400/30 flex flex-wrap items-center justify-between gap-2 text-xs animate-in fade-in duration-150">
            <span className="font-extrabold text-amber-900 dark:text-amber-300">
              {selectedSheets.length} sheet{selectedSheets.length > 1 ? 's' : ''} selected
            </span>

            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => handleBulkToggleVisibility('STAFF', false)}
                disabled={isSubmitting}
                className="px-3 py-1.5 rounded-xl bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 font-bold hover:bg-emerald-500/25 transition cursor-pointer flex items-center gap-1"
              >
                <Eye className="w-3.5 h-3.5" />
                <span>Enable Staff</span>
              </button>

              <button
                type="button"
                onClick={() => handleBulkToggleVisibility('STAFF', true)}
                disabled={isSubmitting}
                className="px-3 py-1.5 rounded-xl bg-slate-500/15 text-slate-700 dark:text-slate-300 border border-slate-500/30 font-bold hover:bg-slate-500/25 transition cursor-pointer flex items-center gap-1"
              >
                <EyeOff className="w-3.5 h-3.5" />
                <span>Disable Staff</span>
              </button>

              <button
                type="button"
                onClick={() => handleBulkToggleVisibility('AGENT', false)}
                disabled={isSubmitting}
                className="px-3 py-1.5 rounded-xl bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 font-bold hover:bg-emerald-500/25 transition cursor-pointer flex items-center gap-1"
              >
                <Eye className="w-3.5 h-3.5" />
                <span>Enable Agent</span>
              </button>

              <button
                type="button"
                onClick={() => handleBulkToggleVisibility('AGENT', true)}
                disabled={isSubmitting}
                className="px-3 py-1.5 rounded-xl bg-slate-500/15 text-slate-700 dark:text-slate-300 border border-slate-500/30 font-bold hover:bg-slate-500/25 transition cursor-pointer flex items-center gap-1"
              >
                <EyeOff className="w-3.5 h-3.5" />
                <span>Disable Agent</span>
              </button>

              <button
                type="button"
                onClick={() =>
                  setDeleteModal({
                    open: true,
                    sheets: [...selectedSheets],
                  })
                }
                disabled={isSubmitting}
                className="px-3 py-1.5 rounded-xl bg-rose-600 text-white font-extrabold hover:bg-rose-500 transition cursor-pointer flex items-center gap-1 shadow-xs"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete Selected ({selectedSheets.length})</span>
              </button>

              <button
                type="button"
                onClick={() => setSelectedSheets([])}
                className="text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 underline font-bold ml-1"
              >
                Deselect
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Sheet Card Grid */}
      {filteredSheetCards.length === 0 ? (
        <div className="p-8 text-center rounded-3xl bg-white dark:bg-[#0E1526] border border-slate-200 dark:border-[#222F43] text-slate-500 text-xs">
          {searchQuery
            ? `No sheet cards matched "${searchQuery}".`
            : 'No intake sheets found in system.'}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredSheetCards.map((card) => {
            const isSelected = selectedSheets.includes(card.name);
            const status = getSheetStatus(card.name);

            return (
              <div
                key={card.name}
                className={`p-4 rounded-3xl border transition shadow-xs flex flex-col justify-between gap-4 ${
                  isSelected
                    ? 'bg-amber-500/10 border-amber-400 dark:border-amber-400/80 ring-2 ring-amber-400/20'
                    : 'bg-white dark:bg-[#0E1526] border-slate-200 dark:border-[#222F43] hover:border-slate-300 dark:hover:border-slate-700'
                }`}
              >
                {/* Card Top Row: Checkbox, Star Default, Status Badge */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      aria-label={`Select sheet ${card.name}`}
                      checked={isSelected}
                      onChange={() => handleToggleSelectSheet(card.name)}
                      className="w-4 h-4 rounded border-slate-300 text-amber-500 focus:ring-amber-400 cursor-pointer"
                    />

                    <button
                      type="button"
                      aria-label={`Set ${card.name} as default`}
                      title={
                        card.isDefault
                          ? 'Current Default Intake Sheet'
                          : 'Set as Default Intake Sheet'
                      }
                      onClick={() => handleSetDefault(card.name)}
                      disabled={isSubmitting}
                      className={`p-1.5 rounded-xl transition cursor-pointer ${
                        card.isDefault
                          ? 'bg-amber-400/20 text-amber-500 border border-amber-400/40'
                          : 'text-slate-400 hover:text-amber-500 hover:bg-slate-100 dark:hover:bg-slate-800'
                      }`}
                    >
                      <Star
                        className={`w-4 h-4 ${
                          card.isDefault ? 'fill-amber-400 text-amber-500' : ''
                        }`}
                      />
                    </button>
                  </div>

                  {/* Status Badge */}
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider ${
                      status === 'Active'
                        ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                        : status === 'Closing Soon'
                        ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30'
                        : 'bg-slate-500/15 text-slate-600 dark:text-slate-400 border border-slate-500/30'
                    }`}
                  >
                    {status}
                  </span>
                </div>

                {/* Card Body: Sheet Title & Rate Count */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="font-extrabold text-sm text-slate-900 dark:text-slate-100 truncate">
                      {card.name}
                    </h3>
                    <span className="px-2 py-0.5 rounded-lg text-[11px] font-mono font-bold bg-slate-100 dark:bg-[#18181B] text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-[#222F43] shrink-0">
                      {card.count} {card.count === 1 ? 'rate' : 'rates'}
                    </span>
                  </div>

                  {card.isDefault && (
                    <span className="inline-block px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-amber-400 text-slate-950">
                      Main Default
                    </span>
                  )}
                </div>

                {/* Card Controls Footer */}
                <div className="pt-3 border-t border-slate-100 dark:border-[#222F43] flex items-center justify-between gap-2 text-xs">
                  {/* Visibility Toggles */}
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      aria-label={`Toggle staff visibility for ${card.name}`}
                      onClick={() =>
                        handleToggleVisibility(
                          card.name,
                          'STAFF',
                          card.staffVisible
                        )
                      }
                      disabled={isSubmitting}
                      className={`px-2.5 py-1 rounded-xl text-[11px] font-bold flex items-center gap-1 transition cursor-pointer ${
                        card.staffVisible
                          ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                          : 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30'
                      }`}
                    >
                      {card.staffVisible ? (
                        <Eye className="w-3.5 h-3.5" />
                      ) : (
                        <EyeOff className="w-3.5 h-3.5" />
                      )}
                      <span>Staff</span>
                    </button>

                    <button
                      type="button"
                      aria-label={`Toggle agent visibility for ${card.name}`}
                      onClick={() =>
                        handleToggleVisibility(
                          card.name,
                          'AGENT',
                          card.agentVisible
                        )
                      }
                      disabled={isSubmitting}
                      className={`px-2.5 py-1 rounded-xl text-[11px] font-bold flex items-center gap-1 transition cursor-pointer ${
                        card.agentVisible
                          ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                          : 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30'
                      }`}
                    >
                      {card.agentVisible ? (
                        <Eye className="w-3.5 h-3.5" />
                      ) : (
                        <EyeOff className="w-3.5 h-3.5" />
                      )}
                      <span>Agent</span>
                    </button>
                  </div>

                  {/* Actions: Edit / Rename & Delete */}
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      aria-label={`Rename sheet ${card.name}`}
                      title="Rename Sheet"
                      onClick={() =>
                        setEditModal({
                          open: true,
                          oldName: card.name,
                          newName: card.name,
                        })
                      }
                      className="p-1.5 rounded-xl text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>

                    <button
                      type="button"
                      aria-label={`Delete sheet ${card.name}`}
                      title="Delete Sheet"
                      onClick={() =>
                        setDeleteModal({
                          open: true,
                          sheets: [card.name],
                        })
                      }
                      className="p-1.5 rounded-xl text-rose-500 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL 1: Single & Batch Delete Confirmation Modal */}
      {deleteModal?.open && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white dark:bg-[#0E1526] border border-slate-200 dark:border-[#222F43] rounded-3xl p-6 max-w-md w-full space-y-4 shadow-2xl">
            <div className="flex items-center gap-3 text-rose-600 dark:text-rose-400">
              <div className="p-2.5 rounded-2xl bg-rose-500/15 border border-rose-500/30">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-extrabold text-slate-900 dark:text-slate-100">
                Confirm Sheet Deletion
              </h3>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              {deleteModal.sheets.length === 1 ? (
                <>
                  Are you sure you want to delete the intake sheet{' '}
                  <strong className="text-slate-900 dark:text-slate-100 font-black">
                    "{deleteModal.sheets[0]}"
                  </strong>
                  ?
                </>
              ) : (
                <>
                  Are you sure you want to delete{' '}
                  <strong className="text-slate-900 dark:text-slate-100 font-black">
                    {deleteModal.sheets.length} selected sheets
                  </strong>
                  ?
                </>
              )}
            </p>

            <div className="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-700 dark:text-rose-300 text-[11px] space-y-1">
              <p className="font-bold">Warning: Permanent Data Loss</p>
              <p className="opacity-90 leading-relaxed">
                Deleting sheet(s) will purge all matching commission rates, role access visibility rules, and lifecycle settings across Firestore.
              </p>
            </div>

            {deleteModal.sheets.length > 1 && (
              <div className="max-h-32 overflow-y-auto p-2.5 rounded-xl bg-slate-50 dark:bg-[#18181B] border border-slate-200 dark:border-[#222F43] text-[11px] font-mono space-y-1 text-slate-700 dark:text-slate-300">
                {deleteModal.sheets.map((s) => (
                  <div key={s} className="truncate">
                    • {s}
                  </div>
                ))}
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeleteModal(null)}
                disabled={isSubmitting}
                className="px-4 py-2 rounded-xl border border-slate-300 dark:border-[#222F43] bg-slate-100 dark:bg-[#18181B] text-slate-700 dark:text-slate-300 text-xs font-bold hover:bg-slate-200 dark:hover:bg-slate-800 transition cursor-pointer"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={isSubmitting}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-extrabold transition cursor-pointer flex items-center gap-1.5 shadow-sm active:scale-95"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Deleting...</span>
                  </>
                ) : (
                  <span>
                    Delete Sheet
                    {deleteModal.sheets.length > 1
                      ? `s (${deleteModal.sheets.length})`
                      : ''}
                  </span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: Purge All Sheets Modal */}
      {purgeModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white dark:bg-[#0E1526] border border-rose-500/40 rounded-3xl p-6 max-w-md w-full space-y-4 shadow-2xl">
            <div className="flex items-center gap-3 text-rose-600 dark:text-rose-400">
              <div className="p-2.5 rounded-2xl bg-rose-600 text-white">
                <Trash2 className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-extrabold text-slate-900 dark:text-slate-100">
                Purge All Sheets
              </h3>
            </div>

            <div className="p-3.5 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-700 dark:text-rose-300 text-xs space-y-1">
              <p className="font-black uppercase tracking-wider text-[10px]">
                Critical Security Safety Check
              </p>
              <p className="leading-relaxed">
                This action will permanently delete <strong>ALL {allSheetCards.length} intake sheets</strong> and all associated commission rates in the system.
              </p>
            </div>

            <div className="space-y-1.5 text-xs">
              <label className="block font-extrabold text-slate-700 dark:text-slate-300">
                To confirm purge, type <span className="font-mono text-rose-500 select-all font-black">DELETE ALL SHEETS</span> below:
              </label>
              <input
                type="text"
                value={purgeInput}
                onChange={(e) => setPurgeInput(e.target.value)}
                placeholder="DELETE ALL SHEETS"
                className="w-full p-2.5 rounded-xl border border-rose-300 dark:border-rose-900/60 bg-rose-50/50 dark:bg-rose-950/20 text-slate-900 dark:text-slate-100 font-mono text-xs focus:ring-2 focus:ring-rose-500 outline-none"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setPurgeModalOpen(false);
                  setPurgeInput('');
                }}
                disabled={isSubmitting}
                className="px-4 py-2 rounded-xl border border-slate-300 dark:border-[#222F43] bg-slate-100 dark:bg-[#18181B] text-slate-700 dark:text-slate-300 text-xs font-bold hover:bg-slate-200 dark:hover:bg-slate-800 transition cursor-pointer"
              >
                Cancel
              </button>

              <button
                type="button"
                aria-label="Confirm purge all sheets"
                onClick={handleConfirmPurgeAll}
                disabled={purgeInput !== 'DELETE ALL SHEETS' || isSubmitting}
                className={`px-4 py-2 rounded-xl text-xs font-black transition cursor-pointer flex items-center gap-1.5 shadow-sm ${
                  purgeInput === 'DELETE ALL SHEETS' && !isSubmitting
                    ? 'bg-rose-600 hover:bg-rose-500 text-white active:scale-95'
                    : 'bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-500 cursor-not-allowed'
                }`}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Purging All...</span>
                  </>
                ) : (
                  <span>Purge All Sheets</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: Edit / Rename Sheet Modal */}
      {editModal?.open && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white dark:bg-[#0E1526] border border-slate-200 dark:border-[#222F43] rounded-3xl p-6 max-w-md w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-[#222F43] pb-3">
              <div className="flex items-center gap-2">
                <Pencil className="w-5 h-5 text-amber-500" />
                <h3 className="text-base font-extrabold text-slate-900 dark:text-slate-100">
                  Rename Intake Sheet
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setEditModal(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-1.5 text-xs">
              <label className="block font-bold text-slate-700 dark:text-slate-300">
                Current Name: <span className="font-mono text-amber-500 font-extrabold">{editModal.oldName}</span>
              </label>
              <input
                type="text"
                value={editModal.newName}
                onChange={(e) =>
                  setEditModal({ ...editModal, newName: e.target.value })
                }
                placeholder="Enter new sheet name..."
                className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-[#222F43] bg-slate-50 dark:bg-[#18181B] text-slate-900 dark:text-slate-100 font-extrabold text-xs focus:ring-2 focus:ring-amber-400 outline-none"
              />
            </div>

            <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
              Renaming this sheet will update matching source sheet metadata, intake filters, and role visibility configurations across all associated rate documents in Firestore.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-[#222F43]">
              <button
                type="button"
                onClick={() => setEditModal(null)}
                disabled={isSubmitting}
                className="px-4 py-2 rounded-xl border border-slate-300 dark:border-[#222F43] bg-slate-100 dark:bg-[#18181B] text-slate-700 dark:text-slate-300 text-xs font-bold hover:bg-slate-200 dark:hover:bg-slate-800 transition cursor-pointer"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleConfirmRename}
                disabled={
                  !editModal.newName.trim() ||
                  editModal.newName.trim() === editModal.oldName ||
                  isSubmitting
                }
                className={`px-4 py-2 rounded-xl text-xs font-black transition cursor-pointer flex items-center gap-1.5 shadow-sm ${
                  editModal.newName.trim() &&
                  editModal.newName.trim() !== editModal.oldName &&
                  !isSubmitting
                    ? 'bg-amber-400 hover:bg-amber-300 text-slate-950 active:scale-95'
                    : 'bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-500 cursor-not-allowed'
                }`}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Renaming...</span>
                  </>
                ) : (
                  <span>Rename Sheet</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
