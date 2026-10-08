import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import type { CommissionRate, UserRole } from '../types';
import { DashboardView } from './DashboardView';
import { SheetView } from './SheetView';
import { CompareView } from './CompareView';
import { UserManagementView } from './UserManagementView';
import { StaffPortalView } from './StaffPortalView';
import { AgentPortalView } from './AgentPortalView';
import { DealCalculatorView } from './DealCalculatorView';
import { AddRateModal } from './AddRateModal';
import { Sidebar } from './Sidebar';
import { EditRateModal } from './EditRateModal';
import { ExcelUploadModal } from './ExcelUploadModal';
import { DeleteAllModal } from './DeleteAllModal';
import { MigrateIntakeModal } from './MigrateIntakeModal';
import { CommandPaletteModal } from './CommandPaletteModal';
import { PageSkeleton } from './PageSkeleton';
import {
  Copy,
  LogOut,
  Menu,
  PlusCircle,
  ArrowRightLeft,
  Upload,
  ShieldCheck,
  UserCheck,
  UserX,
  Eye,
  X,
  ChevronDown,
  Sun,
  Moon,
  Monitor,
  CheckCircle2,
} from 'lucide-react';

export const AppLayout: React.FC = () => {
  const { user, role, signOut } = useAuth();
  const { theme, setTheme } = useTheme();
  const [rates, setRates] = useState<CommissionRate[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  
  // Admin "View As" role preview state
  const [viewAsRole, setViewAsRole] = useState<UserRole>('ADMIN');
  const [isViewAsMenuOpen, setIsViewAsMenuOpen] = useState<boolean>(false);

  // Effective role used across views and sidebar
  const effectiveRole = role === 'ADMIN' ? viewAsRole : role;

  // Dynamic page state based on effective role
  const [currentPage, setCurrentPage] = useState<string>(
    effectiveRole === 'STAFF'
      ? 'Application Directory'
      : effectiveRole === 'AGENT'
      ? 'Agent Commissions'
      : 'Dashboard'
  );
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(false);
  
  const [editingRate, setEditingRate] = useState<CommissionRate | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState<boolean>(false);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState<boolean>(false);
  const [isAddRateModalOpen, setIsAddRateModalOpen] = useState<boolean>(false);
  const [isDeleteAllModalOpen, setIsDeleteAllModalOpen] = useState<boolean>(false);
  const [isMigrateModalOpen, setIsMigrateModalOpen] = useState<boolean>(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState<boolean>(false);
  const [bannerNotice, setBannerNotice] = useState<string | null>(null);

  // Keyboard shortcut listener for Ctrl + K / Cmd + K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsCommandPaletteOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Switch default page when effective role changes
  const handleViewAsChange = (newViewRole: UserRole) => {
    setViewAsRole(newViewRole);
    if (newViewRole === 'STAFF') {
      setCurrentPage('Application Directory');
    } else if (newViewRole === 'AGENT') {
      setCurrentPage('Agent Commissions');
    } else {
      setCurrentPage('Dashboard');
    }
  };

  useEffect(() => {
    setLoading(true);
    const q = query(collection(db, 'rates'), orderBy('diffMargin', 'desc'));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const items: CommissionRate[] = [];
        snapshot.forEach((doc) => {
          items.push(doc.data() as CommissionRate);
        });
        setRates(items);
        setLoading(false);
      },
      (error) => {
        console.error('Firestore subscription error:', error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  const handleEditRate = (rate: CommissionRate) => {
    if (role !== 'ADMIN') return;
    setEditingRate(rate);
    setIsEditModalOpen(true);
  };

  const handleUploadComplete = (count: number) => {
    setBannerNotice(`Successfully synced ${count} commission rates to Firestore.`);
    setTimeout(() => setBannerNotice(null), 6000);
  };

  const handleRateAdded = (newRate: CommissionRate) => {
    setBannerNotice(`Successfully added commission rate for ${newRate.universityName} (${newRate.aggregator} - ${newRate.intake}).`);
    setTimeout(() => setBannerNotice(null), 6000);
  };

  return (
    <div className="min-h-screen bg-slate-50/60 dark:bg-slate-950 flex font-sans antialiased text-slate-800 dark:text-slate-100 transition-colors w-full max-w-full overflow-x-hidden">
      <Sidebar 
        currentPage={currentPage} 
        setCurrentPage={setCurrentPage} 
        rates={rates}
        isOpen={isSidebarOpen}
        setIsOpen={setIsSidebarOpen}
        effectiveRole={effectiveRole}
      />
      
      <div className="flex-1 flex flex-col min-w-0">
        <header className="bg-white/95 dark:bg-slate-900/90 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 sticky top-0 z-30 transition-colors">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button 
                onClick={() => setIsSidebarOpen(true)}
                className="lg:hidden p-2 -ml-2 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
              >
                <Menu className="w-5 h-5" />
              </button>
              <img
                src="/logo.png"
                alt="Basechan Logo"
                className="w-9 h-9 rounded-full object-cover hidden sm:block shadow-xs border border-amber-400/30"
              />
              <div className="hidden sm:block">
                <h1 className="text-sm font-bold text-slate-900 dark:text-slate-100 leading-tight">
                  Basechan CMS
                </h1>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                  {effectiveRole === 'ADMIN'
                    ? 'Commission Rates & Profit Margins'
                    : effectiveRole === 'STAFF'
                    ? 'Staff Application Guide'
                    : 'Agent Commission Directory'}
                </p>
              </div>
              <div className="sm:hidden text-base font-bold text-slate-900 dark:text-slate-100 truncate max-w-[160px]">
                {currentPage}
              </div>
            </div>

            <div className="flex items-center gap-1.5 sm:gap-2.5">
              {/* Admin-only header actions */}
              {role === 'ADMIN' && effectiveRole === 'ADMIN' && (
                <>
                  <button
                    onClick={() => setIsMigrateModalOpen(true)}
                    title="Migrate / Clone Intake Sheet"
                    className="inline-flex items-center justify-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold px-2.5 sm:px-3 py-2 rounded-lg shadow-xs transition cursor-pointer"
                  >
                    <Copy className="w-4 h-4 shrink-0" />
                    <span className="hidden sm:inline">Migrate Sheet</span>
                  </button>

                  <button
                    onClick={() => setIsUploadModalOpen(true)}
                    title="Import Excel Workbook"
                    className="inline-flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold px-2.5 sm:px-3 py-2 rounded-lg shadow-xs transition cursor-pointer"
                  >
                    <Upload className="w-4 h-4 shrink-0" />
                    <span className="hidden sm:inline">Import Excel</span>
                  </button>

                  <button
                    onClick={() => setIsAddRateModalOpen(true)}
                    title="Add Rate / Intake"
                    className="inline-flex items-center justify-center gap-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold px-2.5 sm:px-3 py-2 rounded-lg shadow-2xs transition cursor-pointer"
                  >
                    <PlusCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <span className="hidden sm:inline">Add Rate</span>
                  </button>

                  <button
                    onClick={() => setCurrentPage(currentPage === 'Compare Rates' ? 'Dashboard' : 'Compare Rates')}
                    title="Compare Rates"
                    className={`inline-flex items-center justify-center gap-1.5 border text-xs font-semibold px-2.5 sm:px-3 py-2 rounded-lg shadow-2xs transition cursor-pointer ${
                      currentPage === 'Compare Rates'
                        ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-300'
                        : 'bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200'
                    }`}
                  >
                    <ArrowRightLeft className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <span className="hidden sm:inline">Compare</span>
                  </button>
                </>
              )}

              {/* Theme Switcher Button */}
              <div className="flex items-center bg-slate-100 dark:bg-slate-800/90 p-1 rounded-xl border border-slate-200 dark:border-slate-700/80">
                <button
                  onClick={() => setTheme('light')}
                  title="Light Theme"
                  className={`p-1.5 rounded-lg text-xs transition cursor-pointer ${
                    theme === 'light'
                      ? 'bg-white dark:bg-slate-700 text-amber-500 shadow-2xs font-bold'
                      : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'
                  }`}
                >
                  <Sun className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setTheme('dark')}
                  title="Dark Theme"
                  className={`p-1.5 rounded-lg text-xs transition cursor-pointer ${
                    theme === 'dark'
                      ? 'bg-slate-900 text-indigo-400 shadow-2xs font-bold'
                      : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'
                  }`}
                >
                  <Moon className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setTheme('system')}
                  title="System Theme"
                  className={`p-1.5 rounded-lg text-xs transition cursor-pointer ${
                    theme === 'system'
                      ? 'bg-white dark:bg-slate-700 text-emerald-500 shadow-2xs font-bold'
                      : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'
                  }`}
                >
                  <Monitor className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* User Profile & Interactive Role Badge Menu */}
              <div className="flex items-center gap-3 pl-3 border-l border-slate-200 dark:border-slate-800">
                <div className="text-right hidden sm:block">
                  <div className="flex items-center justify-end gap-1.5">
                    <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 leading-none">
                      {user?.displayName || user?.email?.split('@')[0]}
                    </p>

                    {/* Interactive Admin Badge or Standard Badge */}
                    <div className="relative">
                      {role === 'ADMIN' ? (
                        <button
                          onClick={() => setIsViewAsMenuOpen(!isViewAsMenuOpen)}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-rose-100 dark:bg-rose-950/60 hover:bg-rose-200 dark:hover:bg-rose-900/60 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-800 transition cursor-pointer shadow-2xs"
                          title="Click to change View As role mode"
                        >
                          <ShieldCheck className="w-3 h-3 text-rose-700 dark:text-rose-400" />
                          <span>
                            {viewAsRole === 'ADMIN'
                              ? 'ADMIN'
                              : `ADMIN (${viewAsRole === 'STAFF' ? 'Staff View' : 'Agent View'})`}
                          </span>
                          <ChevronDown className="w-3 h-3 text-rose-600 dark:text-rose-400 ml-0.5" />
                        </button>
                      ) : (
                        <span
                          className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                            role === 'STAFF'
                              ? 'bg-indigo-100 dark:bg-indigo-950/60 text-indigo-800 dark:text-indigo-300'
                              : 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300'
                          }`}
                        >
                          {role === 'STAFF' && <UserCheck className="w-3 h-3" />}
                          {role === 'AGENT' && <UserX className="w-3 h-3" />}
                          {role}
                        </span>
                      )}

                      {/* Dropdown Popover for "View As" */}
                      {isViewAsMenuOpen && role === 'ADMIN' && (
                        <div
                          className="absolute right-0 mt-2 w-56 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl z-50 p-2 space-y-1 animate-in fade-in zoom-in-95"
                          onMouseLeave={() => setIsViewAsMenuOpen(false)}
                        >
                          <div className="px-3 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                            View System As:
                          </div>
                          <button
                            onClick={() => {
                              handleViewAsChange('ADMIN');
                              setIsViewAsMenuOpen(false);
                            }}
                            className={`w-full flex items-center justify-between px-3 py-2 text-xs font-semibold rounded-lg transition cursor-pointer ${
                              viewAsRole === 'ADMIN'
                                ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-300 font-bold'
                                : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                            }`}
                          >
                            <span className="flex items-center gap-2">
                              <ShieldCheck className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                              Admin View
                            </span>
                            {viewAsRole === 'ADMIN' && <span className="text-rose-600 dark:text-rose-400 font-bold">✓</span>}
                          </button>

                          <button
                            onClick={() => {
                              handleViewAsChange('STAFF');
                              setIsViewAsMenuOpen(false);
                            }}
                            className={`w-full flex items-center justify-between px-3 py-2 text-xs font-semibold rounded-lg transition cursor-pointer ${
                              viewAsRole === 'STAFF'
                                ? 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-800 dark:text-indigo-300 font-bold'
                                : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                            }`}
                          >
                            <span className="flex items-center gap-2">
                              <UserCheck className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                              View as Staff
                            </span>
                            {viewAsRole === 'STAFF' && <span className="text-indigo-600 dark:text-indigo-400 font-bold">✓</span>}
                          </button>

                          <button
                            onClick={() => {
                              handleViewAsChange('AGENT');
                              setIsViewAsMenuOpen(false);
                            }}
                            className={`w-full flex items-center justify-between px-3 py-2 text-xs font-semibold rounded-lg transition cursor-pointer ${
                              viewAsRole === 'AGENT'
                                ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 font-bold'
                                : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                            }`}
                          >
                            <span className="flex items-center gap-2">
                              <UserX className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                              View as Agent
                            </span>
                            {viewAsRole === 'AGENT' && <span className="text-amber-600 dark:text-amber-400 font-bold">✓</span>}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium leading-none mt-1">
                    {user?.email}
                  </p>
                </div>

                <button
                  onClick={signOut}
                  title="Sign out"
                  className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition cursor-pointer"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
          {/* Active Preview Mode Banner for Admin */}
          {role === 'ADMIN' && viewAsRole !== 'ADMIN' && (
            <div className="bg-indigo-600 dark:bg-indigo-900 text-white text-xs px-4 py-3 rounded-xl shadow-md flex items-center justify-between animate-in fade-in">
              <div className="flex items-center gap-2">
                <Eye className="w-4 h-4 text-indigo-200" />
                <span className="font-semibold">
                  PREVIEW MODE: You are currently viewing the system as a <span className="underline font-bold uppercase">{viewAsRole}</span> user.
                </span>
              </div>
              <button
                onClick={() => handleViewAsChange('ADMIN')}
                className="bg-white/20 hover:bg-white/30 text-white px-3 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
                <span>Exit Preview</span>
              </button>
            </div>
          )}

          {bannerNotice && (
            <div className="bg-emerald-500 text-white text-xs px-4 py-3 rounded-xl shadow-md flex items-center justify-between animate-in fade-in duration-200">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-100" />
                <span className="font-medium">{bannerNotice}</span>
              </div>
              <button
                onClick={() => setBannerNotice(null)}
                className="text-white/80 hover:text-white text-sm font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>
          )}

          {/* Animated Page Views based on Effective Role */}
          <div key={`${effectiveRole}_${currentPage}`} className="animate-page-enter">
            {loading ? (
              <PageSkeleton />
            ) : effectiveRole === 'STAFF' ? (
              <StaffPortalView rates={rates} loading={loading} />
            ) : effectiveRole === 'AGENT' ? (
              <AgentPortalView rates={rates} loading={loading} />
            ) : currentPage === 'Dashboard' ? (
              <DashboardView 
                rates={rates}
                loading={loading}
                onEditRate={handleEditRate}
              />
            ) : currentPage === 'Compare Rates' ? (
              <CompareView 
                allRates={rates}
              />
            ) : currentPage === 'Deal Calculator' ? (
              <DealCalculatorView
                rates={rates}
              />
            ) : currentPage === 'Users & Activity' ? (
              <UserManagementView />
            ) : (
              <SheetView 
                sheetName={currentPage}
                rates={rates}
                loading={loading}
                onEditRate={handleEditRate}
              />
            )}
          </div>
        </main>
      </div>

      {/* Admin-only modals */}
      {role === 'ADMIN' && (
        <>
          <EditRateModal
            rate={editingRate}
            isOpen={isEditModalOpen}
            onClose={() => {
              setIsEditModalOpen(false);
              setEditingRate(null);
            }}
            onSaved={() => {
              setBannerNotice('Commission rate updated successfully.');
              setTimeout(() => setBannerNotice(null), 4000);
            }}
            onDeleted={() => {
              setBannerNotice('Commission rate deleted successfully.');
              setTimeout(() => setBannerNotice(null), 4000);
            }}
          />

          <AddRateModal
            isOpen={isAddRateModalOpen}
            onClose={() => setIsAddRateModalOpen(false)}
            existingRates={rates}
            onRateAdded={handleRateAdded}
          />

          <ExcelUploadModal
            isOpen={isUploadModalOpen}
            onClose={() => setIsUploadModalOpen(false)}
            onUploadComplete={handleUploadComplete}
          />

          <DeleteAllModal
            isOpen={isDeleteAllModalOpen}
            onClose={() => setIsDeleteAllModalOpen(false)}
            totalRatesCount={rates.length}
            onDeletedAll={(count) => {
              setBannerNotice(`Successfully purged all ${count} records from the database.`);
              setTimeout(() => setBannerNotice(null), 6000);
            }}
          />

          <MigrateIntakeModal
            isOpen={isMigrateModalOpen}
            onClose={() => setIsMigrateModalOpen(false)}
            existingRates={rates}
            onMigratedComplete={(count, targetIntake) => {
              setBannerNotice(`Successfully cloned ${count} rates to new intake "${targetIntake}".`);
              setTimeout(() => setBannerNotice(null), 6000);
            }}
          />
        </>
      )}

      {/* Universal Command Palette (Ctrl + K) for All Roles */}
      <CommandPaletteModal
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        rates={rates}
        setCurrentPage={setCurrentPage}
        onOpenAddRate={role === 'ADMIN' ? () => setIsAddRateModalOpen(true) : undefined}
        onOpenUpload={role === 'ADMIN' ? () => setIsUploadModalOpen(true) : undefined}
      />
    </div>
  );
};
