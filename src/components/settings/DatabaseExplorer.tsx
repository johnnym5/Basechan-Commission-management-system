import React, { useState, useMemo, useEffect } from 'react';
import { collection, onSnapshot, query, orderBy, doc, deleteDoc, writeBatch } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuth } from '../../context/AuthContext';
import { logRateChange } from '../../utils/auditLogger';
import { updateRates } from '../../services/adminRateWriteService';
import { DatabaseRecordInspectorModal } from './DatabaseRecordInspectorModal';
import { BatchActionBar } from '../BatchActionBar';
import { BatchEditModal } from '../BatchEditModal';
import { AddRateModal } from '../AddRateModal';
import { EditRateModal } from '../EditRateModal';
import type { CommissionRate, UserRecord, SchoolGuidance, StudyLevel } from '../../types';
import {
  Database,
  Search,
  Plus,
  CheckCircle2,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  LayoutGrid,
  TableProperties,
  Layers,
  Users,
  Megaphone,
  Eye,
  Trash2,
  Pencil,
} from 'lucide-react';

interface DatabaseExplorerProps {
  rates: CommissionRate[];
  onRefreshRates: () => void;
}

type CollectionKind = 'rates' | 'users' | 'announcements' | 'sheets';

export const DatabaseExplorer: React.FC<DatabaseExplorerProps> = ({ rates, onRefreshRates }) => {
  const { user } = useAuth();
  const [activeCollection, setActiveCollection] = useState<CollectionKind>('rates');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGuidance, setSelectedGuidance] = useState<SchoolGuidance | 'ALL'>('ALL');
  const [selectedIntake, setSelectedIntake] = useState('ALL');
  const [selectedLevel, setSelectedLevel] = useState<StudyLevel | 'ALL'>('ALL');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const CARDS_PER_PAGE = 24;

  // Document Selection for Batch Operations
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Modals & Inspector State
  const [inspectingRecord, setInspectingRecord] = useState<any | null>(null);
  const [editingRate, setEditingRate] = useState<CommissionRate | null>(null);
  const [isAddRateOpen, setIsAddRateOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isBatchEditOpen, setIsBatchEditOpen] = useState(false);
  const [batchLoading, setBatchLoading] = useState(false);
  const [statusNotice, setStatusNotice] = useState<string | null>(null);

  // Firestore Collection States for Users, Announcements, Sheet Visibility
  const [usersList, setUsersList] = useState<UserRecord[]>([]);
  const [announcementsList, setAnnouncementsList] = useState<any[]>([]);
  const [sheetSettingsList, setSheetSettingsList] = useState<any[]>([]);

  // Subscribe to Users
  useEffect(() => {
    if (activeCollection !== 'users') return;
    const q = query(collection(db, 'users'), orderBy('lastLoginAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snap) => {
      const list: UserRecord[] = [];
      snap.forEach((d) => list.push({ uid: d.id, ...d.data() } as UserRecord));
      setUsersList(list);
    });
    return () => unsubscribe();
  }, [activeCollection]);

  // Subscribe to Announcements
  useEffect(() => {
    if (activeCollection !== 'announcements') return;
    const q = query(collection(db, 'system_announcements'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snap) => {
      const list: any[] = [];
      snap.forEach((d) => list.push({ id: d.id, ...d.data() }));
      setAnnouncementsList(list);
    });
    return () => unsubscribe();
  }, [activeCollection]);

  // Subscribe to Sheet Settings
  useEffect(() => {
    if (activeCollection !== 'sheets') return;
    const q = query(collection(db, 'sheet_visibility'), orderBy('sheetKey', 'asc'));
    const unsubscribe = onSnapshot(q, (snap) => {
      const list: any[] = [];
      snap.forEach((d) => list.push({ id: d.id, ...d.data() }));
      setSheetSettingsList(list);
    });
    return () => unsubscribe();
  }, [activeCollection]);

  // Reset pagination & selection when collection or filters change
  useEffect(() => {
    setCurrentPage(1);
    setSelectedIds([]);
  }, [activeCollection, searchQuery, selectedGuidance, selectedIntake, selectedLevel]);

  // Intake options for rates
  const intakes = useMemo(() => {
    const set = new Set(rates.map((r) => r.intake).filter(Boolean));
    return Array.from(set).sort();
  }, [rates]);

  // Active collection items filtered
  const filteredItems = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();

    if (activeCollection === 'rates') {
      return rates.filter((r) => {
        if (q) {
          const corpus = `${r.universityName} ${r.country || ''} ${r.intake} ${r.studyLevel} ${r.aggregator} ${r.guidance || 'ALLOWED'}`.toLowerCase();
          if (!corpus.includes(q)) return false;
        }
        if (selectedGuidance !== 'ALL' && (r.guidance || 'ALLOWED') !== selectedGuidance) return false;
        if (selectedIntake !== 'ALL' && r.intake !== selectedIntake) return false;
        if (selectedLevel !== 'ALL' && r.studyLevel !== selectedLevel) return false;
        return true;
      });
    }

    if (activeCollection === 'users') {
      return usersList.filter((u) => {
        if (q) {
          const corpus = `${u.displayName || ''} ${u.email || ''} ${u.role || ''}`.toLowerCase();
          if (!corpus.includes(q)) return false;
        }
        return true;
      });
    }

    if (activeCollection === 'announcements') {
      return announcementsList.filter((a) => {
        if (q) {
          const corpus = `${a.title || ''} ${a.message || ''} ${a.targetRole || ''}`.toLowerCase();
          if (!corpus.includes(q)) return false;
        }
        return true;
      });
    }

    if (activeCollection === 'sheets') {
      return sheetSettingsList.filter((s) => {
        if (q) {
          const corpus = `${s.sheetKey || ''} ${s.displayName || ''}`.toLowerCase();
          if (!corpus.includes(q)) return false;
        }
        return true;
      });
    }

    return [];
  }, [activeCollection, rates, usersList, announcementsList, sheetSettingsList, searchQuery, selectedGuidance, selectedIntake, selectedLevel]);

  // Sliced paginated items
  const totalPages = Math.ceil(filteredItems.length / CARDS_PER_PAGE) || 1;
  const paginatedItems = useMemo(() => {
    const start = (currentPage - 1) * CARDS_PER_PAGE;
    return filteredItems.slice(start, start + CARDS_PER_PAGE);
  }, [filteredItems, currentPage]);

  // Toggle selection
  const handleToggleSelect = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const handleSelectAllOnPage = () => {
    const pageIds = paginatedItems.map((item) => item.id || item.uid);
    const allSelected = pageIds.every((id) => selectedIds.includes(id));

    if (allSelected) {
      setSelectedIds((prev) => prev.filter((id) => !pageIds.includes(id)));
    } else {
      setSelectedIds((prev) => Array.from(new Set([...prev, ...pageIds])));
    }
  };

  // Selected rate objects
  const selectedRates = useMemo(() => {
    if (activeCollection !== 'rates') return [];
    return rates.filter((r) => selectedIds.includes(r.id));
  }, [rates, selectedIds, activeCollection]);

  // Single Rate Delete Trigger
  const handleDeleteRecord = async (recordId: string) => {
    try {
      if (activeCollection === 'rates') {
        const rateRef = doc(db, 'rates', recordId);
        await deleteDoc(rateRef);
        await logRateChange(user?.email || 'Admin', 'DELETE', recordId, recordId);
        setStatusNotice(`Successfully deleted rate document ${recordId}.`);
        onRefreshRates();
      } else if (activeCollection === 'users') {
        const userRef = doc(db, 'users', recordId);
        await deleteDoc(userRef);
        setStatusNotice(`Deleted user record ${recordId}.`);
      } else if (activeCollection === 'announcements') {
        const ancRef = doc(db, 'system_announcements', recordId);
        await deleteDoc(ancRef);
        setStatusNotice(`Deleted announcement ${recordId}.`);
      }
    } catch (err) {
      console.error('Delete error:', err);
    }
  };

  // Batch Delete Trigger
  const handleBatchDelete = async () => {
    if (selectedIds.length === 0) return;
    try {
      setBatchLoading(true);
      const BATCH_SIZE = 200;
      const totalBatches = Math.ceil(selectedIds.length / BATCH_SIZE);

      for (let b = 0; b < totalBatches; b++) {
        const chunk = selectedIds.slice(b * BATCH_SIZE, (b + 1) * BATCH_SIZE);
        const batch = writeBatch(db);
        chunk.forEach((id) => {
          const colName =
            activeCollection === 'rates'
              ? 'rates'
              : activeCollection === 'users'
              ? 'users'
              : 'system_announcements';
          batch.delete(doc(db, colName, id));
        });
        await batch.commit();
      }

      const count = selectedIds.length;
      setSelectedIds([]);
      setStatusNotice(`Successfully deleted ${count} selected records.`);
      if (activeCollection === 'rates') onRefreshRates();
    } catch (err) {
      console.error('Batch delete error:', err);
    } finally {
      setBatchLoading(false);
    }
  };

  // Batch Set Guidance Status
  const handleBatchSetGuidance = async (guidance: SchoolGuidance) => {
    if (selectedRates.length === 0) return;
    try {
      setBatchLoading(true);
      await updateRates(
        selectedRates,
        (r) => ({ ...r, guidance, updatedAt: new Date().toISOString() }),
        user?.email || 'Admin',
        'guidance'
      );
      const count = selectedRates.length;
      setSelectedIds([]);
      setStatusNotice(`Set guidance status to "${guidance}" for ${count} records.`);
      onRefreshRates();
    } catch (err) {
      console.error('Batch status update error:', err);
    } finally {
      setBatchLoading(false);
    }
  };

  const handleMarkSingleStatus = async (record: any, guidance: 'FOCUS' | 'ALLOWED' | 'DO_NOT_USE') => {
    if (!record || !record.id) return;
    try {
      await updateRates(
        [record],
        (r) => ({ ...r, guidance, updatedAt: new Date().toISOString() }),
        user?.email || 'Admin',
        'guidance'
      );
      setStatusNotice(`Updated status for ${record.universityName} to "${guidance}".`);
      onRefreshRates();
    } catch (err) {
      console.error('Single status update error:', err);
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

      {/* TOP COLLECTION SWITCHER TABS */}
      <div className="p-2 rounded-2xl bg-white dark:bg-[#0E1526] border border-slate-200 dark:border-[#222F43] flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1 text-xs">
          <button
            type="button"
            onClick={() => setActiveCollection('rates')}
            className={`px-3.5 py-2 rounded-xl font-extrabold transition cursor-pointer flex items-center gap-1.5 ${
              activeCollection === 'rates'
                ? 'bg-blue-600 dark:bg-amber-400 text-white dark:text-slate-950 shadow-xs'
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <Database className="w-3.5 h-3.5" />
            <span>Canonical Rates ({rates.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveCollection('users')}
            className={`px-3.5 py-2 rounded-xl font-extrabold transition cursor-pointer flex items-center gap-1.5 ${
              activeCollection === 'users'
                ? 'bg-blue-600 dark:bg-amber-400 text-white dark:text-slate-950 shadow-xs'
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>User Accounts</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveCollection('announcements')}
            className={`px-3.5 py-2 rounded-xl font-extrabold transition cursor-pointer flex items-center gap-1.5 ${
              activeCollection === 'announcements'
                ? 'bg-blue-600 dark:bg-amber-400 text-white dark:text-slate-950 shadow-xs'
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <Megaphone className="w-3.5 h-3.5" />
            <span>Announcements</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveCollection('sheets')}
            className={`px-3.5 py-2 rounded-xl font-extrabold transition cursor-pointer flex items-center gap-1.5 ${
              activeCollection === 'sheets'
                ? 'bg-blue-600 dark:bg-amber-400 text-white dark:text-slate-950 shadow-xs'
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Sheet Settings</span>
          </button>
        </div>

        {/* Create New Document Button */}
        {activeCollection === 'rates' && (
          <button
            type="button"
            onClick={() => setIsAddRateOpen(true)}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs rounded-xl shadow-xs transition cursor-pointer flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            <span>New Rate Document</span>
          </button>
        )}
      </div>

      {/* SEARCH, FILTERS, & VIEW TOGGLE TOOLBAR */}
      <div className="p-3.5 sm:p-4 rounded-2xl bg-white dark:bg-[#0E1526] border border-slate-200 dark:border-[#222F43] shadow-xs flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={`Search ${activeCollection} collection...`}
            className="w-full pl-9 pr-4 py-2 border border-slate-200 dark:border-[#222F43] rounded-xl bg-slate-50 dark:bg-[#18181B] text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {activeCollection === 'rates' && (
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={selectedGuidance}
              onChange={(e) => setSelectedGuidance(e.target.value as SchoolGuidance | 'ALL')}
              className="px-3 py-2 border border-slate-300 dark:border-[#222F43] rounded-xl bg-white dark:bg-[#18181B] font-semibold text-slate-800 dark:text-slate-200"
            >
              <option value="ALL">All Guidance</option>
              <option value="FOCUS">🟢 Focus Schools</option>
              <option value="ALLOWED">🔵 Allowed</option>
              <option value="DO_NOT_USE">🔴 Do Not Use</option>
            </select>

            <select
              value={selectedIntake}
              onChange={(e) => setSelectedIntake(e.target.value)}
              className="px-3 py-2 border border-slate-300 dark:border-[#222F43] rounded-xl bg-white dark:bg-[#18181B] text-slate-800 dark:text-slate-200"
            >
              <option value="ALL">All Intakes</option>
              {intakes.map((i) => (
                <option key={i} value={i}>
                  {i}
                </option>
              ))}
            </select>

            <select
              value={selectedLevel}
              onChange={(e) => setSelectedLevel(e.target.value as StudyLevel | 'ALL')}
              className="px-3 py-2 border border-slate-300 dark:border-[#222F43] rounded-xl bg-white dark:bg-[#18181B] text-slate-800 dark:text-slate-200"
            >
              <option value="ALL">All Levels</option>
              <option value="UG">Undergraduate (UG)</option>
              <option value="PG">Postgraduate (PG)</option>
              <option value="FD">Foundation (FD)</option>
            </select>
          </div>
        )}

        {/* View Switcher & Select All */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleSelectAllOnPage}
            className="px-3 py-2 border border-slate-300 dark:border-[#222F43] rounded-xl bg-white dark:bg-[#18181B] font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
          >
            Select Page ({paginatedItems.length})
          </button>

          <div className="flex items-center bg-slate-100 dark:bg-[#18181B] p-1 rounded-xl border border-slate-200 dark:border-[#222F43]">
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded-lg transition cursor-pointer ${
                viewMode === 'grid'
                  ? 'bg-white dark:bg-[#0E1526] text-blue-600 dark:text-amber-400 font-bold shadow-2xs'
                  : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode('table')}
              className={`p-1.5 rounded-lg transition cursor-pointer ${
                viewMode === 'table'
                  ? 'bg-white dark:bg-[#0E1526] text-blue-600 dark:text-amber-400 font-bold shadow-2xs'
                  : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'
              }`}
            >
              <TableProperties className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* CARD GRID DATABASE EXPLORER VIEW */}
      {viewMode === 'grid' ? (
        <div className="space-y-4">
          {filteredItems.length === 0 ? (
            <div className="p-12 text-center text-slate-400 bg-white dark:bg-[#0E1526] rounded-3xl border border-slate-200 dark:border-[#222F43] text-xs space-y-2">
              <Database className="w-8 h-8 mx-auto text-slate-300 dark:text-slate-600" />
              <p className="font-bold text-slate-700 dark:text-slate-300">No documents found in {activeCollection}</p>
              <p className="text-[11px]">Try clearing search or filters.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5">
              {paginatedItems.map((item) => {
                const itemId = item.id || item.uid || item.universityId;
                const isChecked = selectedIds.includes(itemId);
                const g = item.guidance || 'ALLOWED';

                return (
                  <div
                    key={itemId}
                    onClick={() => setInspectingRecord(item)}
                    className={`p-4 rounded-2xl bg-white dark:bg-[#0E1526] border transition-all duration-200 cursor-pointer flex flex-col justify-between gap-3 select-none relative group hover:-translate-y-1 hover:shadow-xl ${
                      isChecked
                        ? 'border-blue-500 dark:border-amber-400 shadow-md ring-2 ring-blue-500/30'
                        : 'border-slate-200 dark:border-[#222F43] hover:border-slate-300 dark:hover:border-slate-600'
                    }`}
                  >
                    {/* Top Row: Checkbox + Status Pill */}
                    <div className="flex items-center justify-between gap-2">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={(e) => handleToggleSelect(itemId, e as any)}
                        onClick={(e) => e.stopPropagation()}
                        className="w-4 h-4 rounded border-slate-300 dark:border-slate-700 text-blue-600 focus:ring-blue-500 cursor-pointer"
                      />

                      {activeCollection === 'rates' && (
                        g === 'FOCUS' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            <span>Focus</span>
                          </span>
                        ) : g === 'DO_NOT_USE' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-300">
                            <AlertTriangle className="w-3 h-3 text-rose-600" />
                            <span>Avoid</span>
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                            Allowed
                          </span>
                        )
                      )}

                      {activeCollection === 'users' && (
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                          item.role === 'ADMIN' ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300' : 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
                        }`}>
                          {item.role || 'USER'}
                        </span>
                      )}
                    </div>

                    {/* Content Details */}
                    <div className="space-y-1">
                      <h4 className="font-extrabold text-slate-900 dark:text-slate-100 text-xs sm:text-sm leading-snug truncate group-hover:text-blue-600 dark:group-hover:text-amber-400 transition-colors">
                        {item.universityName || item.displayName || item.email || item.title || itemId}
                      </h4>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono truncate">
                        {activeCollection === 'rates' && `${item.intake} • ${item.studyLevel} • ${item.aggregator}`}
                        {activeCollection === 'users' && `${item.email}`}
                        {activeCollection === 'announcements' && `${item.message}`}
                        {activeCollection === 'sheets' && `${item.sheetKey}`}
                      </p>
                    </div>

                    {/* Footer Actions */}
                    <div className="pt-2 border-t border-slate-100 dark:border-[#222F43] flex items-center justify-between text-[11px]">
                      <span className="text-slate-400 font-mono font-bold truncate max-w-[120px]">
                        {itemId}
                      </span>

                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setInspectingRecord(item);
                          }}
                          className="p-1 text-slate-400 hover:text-blue-600 dark:hover:text-amber-400 rounded-md transition"
                          title="Inspect Document"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>

                        {activeCollection === 'rates' && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingRate(item);
                              setIsEditModalOpen(true);
                            }}
                            className="p-1 text-slate-400 hover:text-indigo-600 rounded-md transition"
                            title="Edit Rate"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteRecord(itemId);
                          }}
                          className="p-1 text-slate-400 hover:text-rose-600 rounded-md transition"
                          title="Delete Document"
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

          {/* CARD GRID PAGINATION BAR */}
          <div className="px-5 py-3.5 bg-white dark:bg-[#0E1526] rounded-2xl border border-slate-200 dark:border-[#222F43] flex flex-wrap items-center justify-between gap-4 text-xs text-slate-500 dark:text-slate-400">
            <div>
              Showing <strong className="text-slate-800 dark:text-slate-200">{(currentPage - 1) * CARDS_PER_PAGE + 1}</strong> -{' '}
              <strong className="text-slate-800 dark:text-slate-200">{Math.min(currentPage * CARDS_PER_PAGE, filteredItems.length)}</strong> of{' '}
              <strong className="text-slate-800 dark:text-slate-200">{filteredItems.length}</strong> documents
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="p-1.5 rounded-lg border border-slate-300 dark:border-[#222F43] hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span>
                Page <strong className="text-slate-700 dark:text-slate-300">{currentPage}</strong> of{' '}
                <strong className="text-slate-700 dark:text-slate-300">{totalPages}</strong>
              </span>
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="p-1.5 rounded-lg border border-slate-300 dark:border-[#222F43] hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* TABLE LIST VIEW */
        <div className="bg-white dark:bg-[#0E1526] rounded-2xl border border-slate-200 dark:border-[#222F43] shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="bg-slate-50 dark:bg-[#18181B] border-b border-slate-200 dark:border-[#222F43] text-slate-500 font-bold uppercase tracking-wider">
                <tr>
                  <th className="p-3 w-10">Select</th>
                  <th className="p-3">Title / Name</th>
                  <th className="p-3">ID / Reference</th>
                  <th className="p-3">Status / Role</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-[#222F43]">
                {paginatedItems.map((item) => {
                  const itemId = item.id || item.uid || item.universityId;
                  const isChecked = selectedIds.includes(itemId);
                  return (
                    <tr key={itemId} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition">
                      <td className="p-3">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => handleToggleSelect(itemId, e as any)}
                          className="w-4 h-4 rounded border-slate-300 dark:border-slate-700 text-blue-600 focus:ring-blue-500 cursor-pointer"
                        />
                      </td>
                      <td className="p-3 font-bold text-slate-900 dark:text-slate-100">
                        {item.universityName || item.displayName || item.email || item.title || itemId}
                      </td>
                      <td className="p-3 font-mono text-slate-400">{itemId}</td>
                      <td className="p-3 font-semibold text-slate-600 dark:text-slate-300">
                        {item.guidance || item.role || 'ACTIVE'}
                      </td>
                      <td className="p-3 text-right">
                        <button
                          type="button"
                          onClick={() => setInspectingRecord(item)}
                          className="p-1 text-slate-400 hover:text-blue-600 font-bold cursor-pointer"
                        >
                          Inspect →
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* STICKY BATCH ACTIONS BAR */}
      <BatchActionBar
        selectedCount={selectedIds.length}
        onBatchEdit={() => setIsBatchEditOpen(true)}
        onDeselectAll={() => setSelectedIds([])}
        onDeleteSelected={handleBatchDelete}
        onBatchSetGuidance={handleBatchSetGuidance}
        loading={batchLoading}
      />

      {/* INSPECTOR MODAL */}
      <DatabaseRecordInspectorModal
        record={inspectingRecord}
        collectionName={activeCollection}
        isOpen={!!inspectingRecord}
        onClose={() => setInspectingRecord(null)}
        onEdit={(rec) => {
          if (activeCollection === 'rates') {
            setEditingRate(rec);
            setIsEditModalOpen(true);
          }
        }}
        onDelete={handleDeleteRecord}
        onMarkStatus={handleMarkSingleStatus}
      />

      {/* BATCH EDIT MODAL */}
      <BatchEditModal
        isOpen={isBatchEditOpen}
        onClose={() => setIsBatchEditOpen(false)}
        selectedRates={selectedRates}
        onBatchUpdated={() => {
          setSelectedIds([]);
          setStatusNotice('Batch fields updated successfully.');
          onRefreshRates();
        }}
      />

      {/* EDIT SINGLE RATE MODAL */}
      <EditRateModal
        rate={editingRate}
        existingRates={rates}
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false);
          setEditingRate(null);
        }}
        onSaved={() => {
          setStatusNotice('Rate updated successfully.');
          onRefreshRates();
        }}
        onDeleted={() => {
          setStatusNotice('Rate deleted successfully.');
          onRefreshRates();
        }}
      />

      {/* ADD NEW RATE MODAL */}
      <AddRateModal
        isOpen={isAddRateOpen}
        onClose={() => setIsAddRateOpen(false)}
        existingRates={rates}
        onRateAdded={() => {
          setStatusNotice('New rate created successfully.');
          onRefreshRates();
        }}
      />
    </div>
  );
};
