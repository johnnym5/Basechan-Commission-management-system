import React, { useEffect, useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import type { AgentAccessRequest, Organization, UserRecord, UserRole } from '../types';
import { resolveUserAccess } from '../services/accessPolicy';
import {
  createOrganization,
  setAgentAccessStatus,
  setAgentOrganization,
  subscribeToAgentAccessRequests,
  subscribeToOrganizations,
} from '../services/accessRequestService';
import { applyRatesToAgentTargets, clearAgentRateOverrides, ensureRoleRateModelMigration, resolveAgentTargets } from '../services/rateReadModels';
import { discardUnstartedRateOperation, resumeRateOperation, subscribeToPendingRateOperations, type PendingRateOperation } from '../services/adminRateWriteService';
import { useCommissionRates } from '../hooks/useCommissionRates';
import {
  Users,
  Wifi,
  ShieldCheck,
  UserCheck,
  UserX,
  Search,
  Clock,
  Mail,
  RefreshCcw,
  CheckCircle2,
  Ban,
  Trash2,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  X,
} from 'lucide-react';

// Dead-Centered, Fixed, Non-Scrolling User Detail Pop-Up Modal
const UserDetailModal: React.FC<{
  user: UserRecord | null;
  currentIndex: number | null;
  totalCount: number;
  currentUserId?: string;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
  onToggleDisabled: (user: UserRecord) => void;
  onDeleteRequest: (user: UserRecord) => void;
  updatingUid: string | null;
}> = ({
  user,
  currentIndex,
  totalCount,
  currentUserId,
  onClose,
  onPrev,
  onNext,
  onToggleDisabled,
  onDeleteRequest,
  updatingUid,
}) => {
  // Lock body scroll ONLY when a valid user is selected
  useEffect(() => {
    if (!user || currentIndex === null) return;

    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, [user, currentIndex]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') onPrev();
      if (e.key === 'ArrowRight') onNext();
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onPrev, onNext, onClose]);

  if (!user || currentIndex === null) return null;

  const formatDate = (isoString?: string) => {
    if (!isoString) return 'Never';
    try {
      return new Date(isoString).toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return isoString;
    }
  };

  const isSelf = currentUserId === user.uid;

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-hidden animate-backdrop-fade"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative my-auto max-w-md sm:max-w-lg w-full max-h-[85vh] bg-white dark:bg-[#0E1526] text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-[#222F43] rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-modal-pop z-[10000]"
      >
        {/* Header */}
        <div className="p-3.5 sm:p-4 border-b border-slate-100 dark:border-[#222F43] flex items-center justify-between bg-slate-50/80 dark:bg-[#18181B]/80 shrink-0">
          <div className="flex items-center gap-3 min-w-0 pr-2">
            {user.photoURL ? (
              <img
                src={user.photoURL}
                alt={user.displayName}
                className="w-10 h-10 rounded-full object-cover border border-slate-200 dark:border-slate-700 shrink-0"
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-blue-600 dark:bg-amber-400 text-white dark:text-slate-950 font-bold text-sm flex items-center justify-center shrink-0">
                {user.displayName ? user.displayName.charAt(0).toUpperCase() : 'U'}
              </div>
            )}
            <div className="min-w-0 space-y-0.5">
              <h3 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-slate-100 truncate flex items-center gap-1.5">
                <span>{user.displayName || 'Anonymous User'}</span>
                {isSelf && (
                  <span className="text-[10px] bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 font-bold px-1.5 py-0.5 rounded-md shrink-0">
                    You
                  </span>
                )}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1 truncate">
                <Mail className="w-3 h-3 text-slate-400 shrink-0" />
                <span className="truncate">{user.email}</span>
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            aria-label="Close user details"
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Compact Details Body */}
        <div className="p-3.5 sm:p-4 space-y-2.5 text-xs overflow-y-auto flex-1">
          {/* Status Row */}
          <div className="p-2 bg-slate-50 dark:bg-[#18181B]/60 rounded-xl border border-slate-200 dark:border-[#222F43] flex items-center justify-between">
            <span className="font-semibold text-slate-500 dark:text-slate-400 text-[10px]">Account Status:</span>
            {user.isDisabled ? (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-100 dark:bg-rose-950/80 text-rose-800 dark:text-rose-300 border border-rose-300 dark:border-rose-800 shadow-2xs">
                <Ban className="w-3 h-3 text-rose-600 dark:text-rose-400 shrink-0" />
                <span>Blocked</span>
              </span>
            ) : user.isOnline ? (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                <span>Online</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
                <span className="w-2 h-2 rounded-full bg-slate-400"></span>
                <span>Offline</span>
              </span>
            )}
          </div>

          {/* Key Timestamps Grid */}
          <div className="grid grid-cols-2 gap-2">
            <div className="p-2 bg-slate-50 dark:bg-[#18181B]/60 rounded-xl border border-slate-200 dark:border-[#222F43]">
              <span className="text-slate-400 block font-medium text-[9px] uppercase">Last Logged In</span>
              <span className="font-mono font-bold text-slate-800 dark:text-slate-200 text-xs block truncate mt-0.5">
                {formatDate(user.lastLoginAt)}
              </span>
            </div>

            <div className="p-2 bg-slate-50 dark:bg-[#18181B]/60 rounded-xl border border-slate-200 dark:border-[#222F43]">
              <span className="text-slate-400 block font-medium text-[9px] uppercase">Joined System</span>
              <span className="font-mono font-bold text-slate-800 dark:text-slate-200 text-xs block truncate mt-0.5">
                {formatDate(user.createdAt)}
              </span>
            </div>
          </div>

          {/* UID Field */}
          <div className="p-2 bg-slate-100 dark:bg-[#18181B] rounded-xl border border-slate-200 dark:border-[#222F43] text-[10px] font-mono text-slate-500 dark:text-slate-400 truncate">
            UID: {user.uid}
          </div>

          {/* Action Buttons */}
          {!isSelf && (
            <div className="grid grid-cols-2 gap-2 pt-0.5">
              <button
                type="button"
                onClick={() => onToggleDisabled(user)}
                disabled={updatingUid === user.uid}
                className={`py-2 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer active:scale-95 ${
                  user.isDisabled
                    ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                    : 'bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 hover:bg-rose-100'
                }`}
              >
                <Ban className="w-3.5 h-3.5" />
                <span>{user.isDisabled ? 'Restore Access' : 'Block Access'}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  onClose();
                  onDeleteRequest(user);
                }}
                disabled={updatingUid === user.uid}
                className="py-2 px-3 rounded-xl font-bold text-xs bg-slate-200 dark:bg-slate-800 hover:bg-rose-600 hover:text-white dark:hover:bg-rose-600 text-slate-700 dark:text-slate-300 transition flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete Account</span>
              </button>
            </div>
          )}
        </div>

        {/* Footer Navigation Bar with Previous & Next Buttons */}
        <div className="p-3 sm:p-3.5 bg-slate-50/80 dark:bg-[#18181B]/80 border-t border-slate-100 dark:border-[#222F43] flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 shrink-0">
          <button
            onClick={onPrev}
            disabled={currentIndex === 0}
            className="px-3 py-1.5 bg-white dark:bg-[#0E1526] border border-slate-200 dark:border-[#222F43] rounded-xl font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 transition disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer flex items-center gap-1 active:scale-95 text-xs"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>Previous</span>
          </button>

          <span className="font-mono font-bold text-slate-700 dark:text-slate-300 text-[10px] sm:text-xs">
            {currentIndex + 1} of {totalCount}
          </span>

          <button
            onClick={onNext}
            disabled={currentIndex === totalCount - 1}
            className="px-3 py-1.5 bg-white dark:bg-[#0E1526] border border-slate-200 dark:border-[#222F43] rounded-xl font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 transition disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer flex items-center gap-1 active:scale-95 text-xs"
          >
            <span>Next</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export const UserManagementView: React.FC = () => {
  const { setUserDisabledStatus, deleteUserRecord, user: currentUser } = useAuth();
  const { rates: masterRates, loading: masterRatesLoading } = useCommissionRates();
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [usersError, setUsersError] = useState<string | null>(null);
  const [usersLoadAttempt, setUsersLoadAttempt] = useState(0);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [roleFilter, setRoleFilter] = useState<UserRole | 'ALL'>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ONLINE' | 'OFFLINE' | 'DISABLED'>('ALL');

  // Active detail modal index for user cards view
  const [activeUserIndex, setActiveUserIndex] = useState<number | null>(null);

  // Action Loading states
  const [updatingUid, setUpdatingUid] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [accessRequests, setAccessRequests] = useState<AgentAccessRequest[]>([]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [newOrganizationName, setNewOrganizationName] = useState('');
  const [selectedOrganizations, setSelectedOrganizations] = useState<Record<string, string>>({});
  const [rateScope, setRateScope] = useState<'organization' | 'agents' | 'all'>('organization');
  const [selectedRateId, setSelectedRateId] = useState('');
  const [selectedRateIds, setSelectedRateIds] = useState<string[]>([]);
  const [customPayoutAmount, setCustomPayoutAmount] = useState('');
  const [customPayoutType, setCustomPayoutType] = useState<'percentage' | 'flat'>('percentage');
  const [customPayoutBasis, setCustomPayoutBasis] = useState<'NET' | 'GROSS'>('GROSS');
  const [selectedOrganizationIds, setSelectedOrganizationIds] = useState<string[]>([]);
  const [selectedAgentIds, setSelectedAgentIds] = useState<string[]>([]);
  const [replaceSpecificOverrides, setReplaceSpecificOverrides] = useState(false);
  const [pendingRateOperations, setPendingRateOperations] = useState<PendingRateOperation[]>([]);
  const [resumingOperationId, setResumingOperationId] = useState<string | null>(null);
  const [rebuildingReadModels, setRebuildingReadModels] = useState(false);

  // Delete Modal State
  const [deletingUser, setDeletingUser] = useState<UserRecord | null>(null);

  // Pagination State
  const [page, setPage] = useState<number>(1);
  const PAGE_SIZE = 12;

  // Subscribe to real-time users collection
  useEffect(() => {
    setLoading(true);
    setUsersError(null);
    const q = query(collection(db, 'users'), orderBy('lastLoginAt', 'desc'));
    const loadingTimer = window.setTimeout(() => {
      setUsersError('The user list is taking longer than expected to connect. Check your connection or retry.');
      setLoading(false);
    }, 12000);

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        window.clearTimeout(loadingTimer);
        const records: UserRecord[] = [];
        snapshot.forEach((docSnap) => {
          records.push(docSnap.data() as UserRecord);
        });
        setUsers(records.map((record) => ({ ...record, role: resolveUserAccess({ email: record.email }).role })));
        setUsersError(null);
        setLoading(false);
      },
      (err) => {
        window.clearTimeout(loadingTimer);
        console.error('Error listening to users collection:', err);
        setUsersError(`Could not load user accounts: ${err.message}`);
        setLoading(false);
      }
    );

    return () => { window.clearTimeout(loadingTimer); unsubscribe(); };
  }, [usersLoadAttempt]);

  useEffect(() => {
    const stopRequests = subscribeToAgentAccessRequests(setAccessRequests, (err) => setNotice(err.message));
    const stopOrganizations = subscribeToOrganizations(setOrganizations, (err) => setNotice(err.message));
    return () => { stopRequests(); stopOrganizations(); };
  }, []);

  useEffect(() => {
    return subscribeToPendingRateOperations(setPendingRateOperations, (err) => {
      setNotice(`Could not load pending rate operations: ${err.message}`);
    });
  }, []);


  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [searchQuery, roleFilter, statusFilter]);

  const handleAccessDecision = async (request: AgentAccessRequest, status: 'approved' | 'rejected' | 'revoked') => {
    try {
      setUpdatingUid(request.uid);
      let organizationId = selectedOrganizations[request.uid] || request.organizationId;
      if (status === 'approved' && !organizationId && request.requestedOrganizationName) {
        const created = await createOrganization({ name: request.requestedOrganizationName, adminUid: currentUser?.uid || '' });
        organizationId = created.id;
      }
      await setAgentAccessStatus({
        uid: request.uid,
        status,
        adminUid: currentUser?.uid || '',
        ...(status === 'approved' ? { organizationId } : {}),
      });
      setNotice(`Agent access ${status} for ${request.email}.`);
      setTimeout(() => setNotice(null), 4000);
    } catch (err) {
      setNotice(err instanceof Error ? err.message : 'Could not update Agent access.');
    } finally {
      setUpdatingUid(null);
    }
  };

  const handleOrganizationChange = async (request: AgentAccessRequest, organizationId: string) => {
    try {
      setUpdatingUid(request.uid);
      await setAgentOrganization(request.uid, organizationId, currentUser?.uid || '');
      setNotice(`Organization updated for ${request.email}.`);
    } catch (err) {
      setNotice(err instanceof Error ? err.message : 'Could not update Agent organization.');
    } finally {
      setUpdatingUid(null);
    }
  };

  const handleCreateOrganization = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      await createOrganization({ name: newOrganizationName, adminUid: currentUser?.uid || '' });
      setNotice(`Organization added: ${newOrganizationName.trim()}`);
      setNewOrganizationName('');
    } catch (err) {
      setNotice(err instanceof Error ? err.message : 'Could not create organization.');
    }
  };

  const handleResumeRateOperation = async (operation: PendingRateOperation) => {
    try {
      setResumingOperationId(operation.operationId);
      const result = await resumeRateOperation(operation.operationId, currentUser?.email || 'Admin');
      setNotice(`Rate operation ${result.operationId} completed for ${result.completed} rate records.`);
    } catch (err) {
      setNotice(err instanceof Error ? err.message : `Could not resume rate operation ${operation.operationId}.`);
    } finally {
      setResumingOperationId(null);
    }
  };

  const handleDiscardRateOperation = async (operation: PendingRateOperation) => {
    try {
      setResumingOperationId(operation.operationId);
      await discardUnstartedRateOperation(operation.operationId);
      setNotice('The interrupted operation was discarded before it changed canonical rates. Re-run the Admin change if it is still needed.');
    } catch (err) {
      setNotice(err instanceof Error ? err.message : 'Could not discard the incomplete operation.');
    } finally {
      setResumingOperationId(null);
    }
  };

  const handleRebuildRateReadModels = async () => {
    if (!masterRates.length) return setNotice('No canonical rates are loaded. Confirm the Admin rate table is available, then retry.');
    try {
      setRebuildingReadModels(true);
      const result = await ensureRoleRateModelMigration(masterRates, currentUser?.email || 'Admin', true);
      setNotice(`Secure Staff and Agent rate views were rebuilt from ${masterRates.length} canonical rates. Removed ${result.prunedOrganizationDefaults} legacy organization copies of default rates.`);
    } catch (err) {
      setNotice(err instanceof Error ? err.message : 'Could not rebuild the secure rate views. Retry from this page.');
    } finally {
      setRebuildingReadModels(false);
    }
  };

  const handleRateAssignment = async () => {
    const selectedRates = masterRates.filter((item) => selectedRateIds.length ? selectedRateIds.includes(item.id) : item.id === selectedRateId).map((rate) => customPayoutAmount.trim()
      ? { ...rate, agentRate: Number(customPayoutAmount), isFlatFee: customPayoutType === 'flat', netOrGross: customPayoutBasis }
      : rate);
    if (!selectedRates.length) return setNotice('Select at least one rate first.');
    if (customPayoutAmount.trim() && (!Number.isFinite(Number(customPayoutAmount)) || Number(customPayoutAmount) < 0)) return setNotice('Enter a valid payout amount of zero or more.');
    try {
      setUpdatingUid('rate-assignment');
      const agentTargets = await resolveAgentTargets();
      const organizationIds = rateScope === 'organization' ? selectedOrganizationIds : rateScope === 'all' ? organizations.map((organization) => organization.id) : [];
      const targets = rateScope === 'agents'
        ? agentTargets.filter((item) => selectedAgentIds.includes(item.uid))
        : [];
      if (rateScope === 'organization' && !selectedOrganizationIds.length) throw new Error('Select at least one organization.');
      if (rateScope === 'agents' && !selectedAgentIds.length) throw new Error('Select at least one Agent.');
      if ((rateScope === 'all' && !organizationIds.length) || (rateScope === 'agents' && !targets.length)) throw new Error('There are no approved Agents or organizations in the selected scope.');
      const assignmentTargets = rateScope === 'agents' ? targets : agentTargets.filter((item) => organizationIds.includes(item.organizationId));
      await applyRatesToAgentTargets(selectedRates, assignmentTargets, {
        applyOrganization: rateScope !== 'agents',
        applyIndividual: rateScope === 'agents',
        replaceOverrides: replaceSpecificOverrides,
        notify: true,
        organizationIds,
      });
      setNotice(`Rate assignment applied to ${rateScope === 'organization' || rateScope === 'all' ? organizationIds.length + ' organizations' : assignmentTargets.length + ' Agent accounts'}.`);
    } catch (err) {
      setNotice(err instanceof Error ? err.message : 'Rate assignment failed.');
    } finally {
      setUpdatingUid(null);
    }
  };

  const handleClearAgentOverrides = async () => {
    if (rateScope !== 'agents') return setNotice('Choose Selected Agents before clearing individual overrides.');
    const selectedRates = masterRates.filter((item) => selectedRateIds.length ? selectedRateIds.includes(item.id) : item.id === selectedRateId);
    if (!selectedRates.length || !selectedAgentIds.length) return setNotice('Select at least one Agent and one rate.');
    try {
      setUpdatingUid('rate-assignment');
      const targets = (await resolveAgentTargets()).filter((item) => selectedAgentIds.includes(item.uid));
      const cleared = await clearAgentRateOverrides(targets, selectedRates, currentUser?.email || 'Admin');
      setNotice(cleared ? `Cleared ${cleared} individual overrides. Each selected rate now falls back to its organization rate or shared default.` : 'No individual overrides were found for the selected Agents and rates.');
    } catch (err) {
      setNotice(err instanceof Error ? err.message : 'Could not clear the selected individual overrides.');
    } finally {
      setUpdatingUid(null);
    }
  };

  // Revoke / Restore Access Handler
  const handleToggleDisabled = async (targetUser: UserRecord) => {
    const nextStatus = !targetUser.isDisabled;
    try {
      setUpdatingUid(targetUser.uid);
      await setUserDisabledStatus(targetUser.uid, nextStatus);
      setNotice(
        nextStatus
          ? `Access revoked for ${targetUser.email}`
          : `Access restored for ${targetUser.email}`
      );
      setTimeout(() => setNotice(null), 4000);
    } catch (err) {
      console.error('Failed to update user status:', err);
    } finally {
      setUpdatingUid(null);
    }
  };

  // Delete User Record Handler
  const handleConfirmDelete = async () => {
    if (!deletingUser) return;
    try {
      setUpdatingUid(deletingUser.uid);
      await deleteUserRecord(deletingUser.uid);
      setNotice(`Permanently deleted user record for ${deletingUser.email}`);
      setTimeout(() => setNotice(null), 4000);
      setDeletingUser(null);
    } catch (err) {
      console.error('Failed to delete user:', err);
    } finally {
      setUpdatingUid(null);
    }
  };

  // Metrics
  const onlineCount = useMemo(() => users.filter((u) => u.isOnline && !u.isDisabled).length, [users]);
  const usersWithRoles = useMemo(() => users.map((u) => ({ ...u, role: resolveUserAccess({ email: u.email }).role })), [users]);
  const adminCount = useMemo(() => usersWithRoles.filter((u) => u.role === 'ADMIN').length, [usersWithRoles]);
  const staffCount = useMemo(() => usersWithRoles.filter((u) => u.role === 'STAFF').length, [usersWithRoles]);
  const agentCount = useMemo(() => usersWithRoles.filter((u) => u.role === 'AGENT').length, [usersWithRoles]);
  const disabledCount = useMemo(() => users.filter((u) => u.isDisabled).length, [users]);

  // Filtering
  const filteredUsers = useMemo(() => {
    return usersWithRoles.filter((u) => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase().trim();
        const corpus = `${u.displayName} ${u.email} ${u.role}`.toLowerCase();
        if (!corpus.includes(q)) return false;
      }

      if (roleFilter !== 'ALL' && u.role !== roleFilter) {
        return false;
      }

      if (statusFilter === 'DISABLED' && !u.isDisabled) return false;
      if (statusFilter === 'ONLINE' && (!u.isOnline || u.isDisabled)) return false;
      if (statusFilter === 'OFFLINE' && (u.isOnline || u.isDisabled)) return false;

      return true;
    });
  }, [usersWithRoles, searchQuery, roleFilter, statusFilter]);

  // Detail Pop-up Navigation Helpers
  const activeUser = activeUserIndex !== null && filteredUsers[activeUserIndex]
    ? filteredUsers[activeUserIndex]
    : null;

  const handlePrevUser = () => {
    setActiveUserIndex((prev) => (prev !== null ? Math.max(0, prev - 1) : null));
  };

  const handleNextUser = () => {
    setActiveUserIndex((prev) => (prev !== null ? Math.min(filteredUsers.length - 1, prev + 1) : null));
  };

  // Paginated Slice
  const totalPages = Math.ceil(filteredUsers.length / PAGE_SIZE) || 1;
  const paginatedUsers = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filteredUsers.slice(start, start + PAGE_SIZE);
  }, [filteredUsers, page]);

  return (
    <div className="space-y-6">
      {/* Banner Notice */}
      {notice && (
        <div className="bg-emerald-600 text-white text-xs px-4 py-3 rounded-xl shadow-md flex items-center justify-between animate-in fade-in font-medium">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-100 shrink-0" />
            <span>{notice}</span>
          </div>
          <button onClick={() => setNotice(null)} className="text-white/80 hover:text-white font-bold cursor-pointer">
            ✕
          </button>
        </div>
      )}

      {usersError && <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-200"><span>{usersError}</span><button onClick={() => setUsersLoadAttempt((attempt) => attempt + 1)} className="rounded-lg border border-rose-300 px-3 py-1.5 text-xs font-bold hover:bg-rose-100 dark:border-rose-800 dark:hover:bg-rose-900/40">Retry</button></div>}

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2.5">
            <Users className="w-6 h-6 sm:w-7 sm:h-7 text-blue-600 dark:text-amber-400" />
            User Management & Activity
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            View all users, check who is currently online, assign roles, and manage account access.
          </p>
        </div>
        <button disabled={masterRatesLoading || rebuildingReadModels || masterRates.length === 0} onClick={() => void handleRebuildRateReadModels()} className="rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-2.5 text-xs font-bold text-indigo-800 disabled:opacity-50 dark:border-indigo-900 dark:bg-indigo-950/30 dark:text-indigo-200">{rebuildingReadModels ? 'Rebuilding secure rate views…' : 'Rebuild secure rate views'}</button>
      </div>

      {pendingRateOperations.length > 0 && <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950/20">
        <h2 className="text-sm font-extrabold text-amber-950 dark:text-amber-100">Rate updates needing attention</h2>
        <p className="mt-1 text-xs text-amber-900/80 dark:text-amber-200/80">Resume operations that reached rate writes. An operation still preparing has not changed canonical rates and can be discarded if its saved details are incomplete.</p>
        <div className="mt-3 space-y-2">{pendingRateOperations.map((operation) => <div key={operation.operationId} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-white p-3 dark:border-amber-900 dark:bg-[#0E1526]">
          <div><p className="text-xs font-bold">{operation.count} rate records · {operation.stage}</p><p className="mt-1 font-mono text-[10px] text-slate-500">{operation.operationId}</p><p className="text-[10px] text-slate-500">Started by {operation.adminEmail || 'Admin'} · {operation.updatedAt ? new Date(operation.updatedAt).toLocaleString() : 'time unavailable'}</p></div>
          <div className="flex gap-2">{operation.stage === 'preparing' && <button disabled={resumingOperationId !== null} onClick={() => void handleDiscardRateOperation(operation)} className="rounded-lg border border-amber-300 px-3 py-2 text-xs font-bold text-amber-900 disabled:opacity-50">Discard before writes</button>}<button disabled={resumingOperationId !== null} onClick={() => void handleResumeRateOperation(operation)} className="inline-flex items-center gap-2 rounded-lg bg-amber-700 px-3 py-2 text-xs font-bold text-white disabled:opacity-50"><RefreshCcw className={`h-3.5 w-3.5 ${resumingOperationId === operation.operationId ? 'animate-spin' : ''}`} />{resumingOperationId === operation.operationId ? 'Resuming…' : 'Resume operation'}</button></div>
        </div>)}</div>
      </section>}

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs dark:border-[#222F43] dark:bg-[#0E1526]">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-base font-extrabold text-slate-900 dark:text-slate-100">Organization access requests</h2>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Approve Agents into an organization to grant access to their rate view.</p>
          </div>
          <form onSubmit={handleCreateOrganization} className="flex flex-wrap gap-2">
            <input aria-label="New organization name" required minLength={2} maxLength={100} value={newOrganizationName} onChange={(event) => setNewOrganizationName(event.target.value)} placeholder="New organization name" className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs dark:border-[#222F43] dark:bg-[#18181B]" />
            <button className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-bold text-white hover:bg-blue-700">Add organization</button>
          </form>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {organizations.map((organization) => <span key={organization.id} className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-200">{organization.name}</span>)}
          {organizations.length === 0 && <span className="text-xs text-slate-400">No organizations created yet.</span>}
        </div>
        <div className="mt-4 space-y-2">
          {accessRequests.map((request) => {
            const agentRole = resolveUserAccess({ email: request.email }).role === 'AGENT';
            const selectedOrg = selectedOrganizations[request.uid] || request.organizationId || '';
            return <div key={request.uid} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 p-3 dark:border-[#222F43]">
              <div className="min-w-[200px]">
                <p className="text-sm font-bold text-slate-900 dark:text-slate-100">{request.displayName} <span className="font-normal text-slate-500">· {request.email}</span></p>
                <p className="mt-0.5 text-xs text-slate-500">{request.requestedOrganizationName ? `Requested: ${request.requestedOrganizationName}` : `Organization: ${organizations.find((org) => org.id === request.organizationId)?.name || request.organizationId || 'Not selected'}`} · <span className="font-semibold uppercase">{request.status}</span></p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <select aria-label={`Organization for ${request.email}`} value={selectedOrg} onChange={(event) => setSelectedOrganizations((current) => ({ ...current, [request.uid]: event.target.value }))} className="rounded-lg border border-slate-300 bg-white px-2 py-2 text-xs dark:border-[#222F43] dark:bg-[#18181B]">
                  <option value="">Choose organization</option>
                  {organizations.map((organization) => <option key={organization.id} value={organization.id}>{organization.name}</option>)}
                </select>
                {request.status === 'approved' && selectedOrg !== request.organizationId && selectedOrg && <button disabled={updatingUid === request.uid} onClick={() => void handleOrganizationChange(request, selectedOrg)} className="rounded-lg bg-indigo-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-40">Move Agent</button>}
                {request.status === 'pending' ? <>
                  <button disabled={(!selectedOrg && !request.requestedOrganizationName) || !agentRole || updatingUid === request.uid} onClick={() => void handleAccessDecision(request, 'approved')} className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-40">Approve</button>
                  <button disabled={updatingUid === request.uid} onClick={() => void handleAccessDecision(request, 'rejected')} className="rounded-lg bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700 dark:bg-rose-950/50 dark:text-rose-300">Reject</button>
                </> : request.status === 'approved' ? <button disabled={updatingUid === request.uid} onClick={() => void handleAccessDecision(request, 'revoked')} className="rounded-lg bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700 dark:bg-rose-950/50 dark:text-rose-300">Revoke access</button> : <button disabled={(!selectedOrg && !request.requestedOrganizationName) || updatingUid === request.uid} onClick={() => void handleAccessDecision(request, 'approved')} className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-40">Approve access</button>}
              </div>
            </div>;
          })}
          {accessRequests.length === 0 && <p className="rounded-xl bg-slate-50 p-4 text-center text-xs text-slate-500 dark:bg-[#18181B]">No Agent access requests yet.</p>}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs dark:border-[#222F43] dark:bg-[#0E1526]">
        <h2 className="text-base font-extrabold">Agent rate assignments</h2>
        <p className="mt-1 text-xs text-slate-500">Assign selected rates to one or more organizations, selected Agents, or every approved Agent.</p>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <label className="space-y-1 text-xs font-semibold"><span>Rate</span><select aria-label="Rate to assign" value={selectedRateId} onChange={(event) => { setSelectedRateId(event.target.value); setSelectedRateIds(event.target.value ? [event.target.value] : []); }} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 dark:border-[#222F43] dark:bg-[#18181B]"><option value="">Select a school rate</option>{masterRates.map((rate) => <option key={rate.id} value={rate.id}>{rate.universityName} · {rate.intake} · {rate.studyLevel}</option>)}</select></label>
          <label className="space-y-1 text-xs font-semibold"><span>Apply to</span><select value={rateScope} onChange={(event) => setRateScope(event.target.value as typeof rateScope)} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 dark:border-[#222F43] dark:bg-[#18181B]"><option value="organization">Selected organizations</option><option value="agents">Selected Agents</option><option value="all">All approved Agents</option></select></label>
        </div>
        <div className="mt-3 rounded-xl border border-slate-200 p-3 dark:border-[#222F43]"><p className="text-xs font-bold">Optional custom payout</p><p className="mt-1 text-[11px] text-slate-500">Leave blank to use each selected school rate’s current payout. An entered amount applies to every selected rate.</p><div className="mt-2 grid gap-2 sm:grid-cols-3"><label className="text-xs font-semibold">Amount<input aria-label="Custom payout amount" inputMode="decimal" type="number" min="0" step="0.01" value={customPayoutAmount} onChange={(event) => setCustomPayoutAmount(event.target.value)} placeholder="Use selected rate" className="mt-1 w-full rounded-lg border bg-white px-3 py-2 dark:bg-[#18181B]" /></label><label className="text-xs font-semibold">Fee type<select aria-label="Custom payout fee type" value={customPayoutType} onChange={(event) => setCustomPayoutType(event.target.value as typeof customPayoutType)} className="mt-1 w-full rounded-lg border bg-white px-3 py-2 dark:bg-[#18181B]"><option value="percentage">Percentage</option><option value="flat">Flat fee</option></select></label><label className="text-xs font-semibold">Basis<select aria-label="Custom payout basis" value={customPayoutBasis} onChange={(event) => setCustomPayoutBasis(event.target.value as typeof customPayoutBasis)} className="mt-1 w-full rounded-lg border bg-white px-3 py-2 dark:bg-[#18181B]"><option value="GROSS">Gross</option><option value="NET">Net</option></select></label></div></div>
        <details className="mt-3 rounded-xl border border-slate-200 p-3 text-xs dark:border-[#222F43]"><summary className="cursor-pointer font-bold">Select multiple school rates ({selectedRateIds.length})</summary><div className="mt-3 max-h-48 space-y-1 overflow-y-auto">{masterRates.map((rate) => <label key={rate.id} className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-800"><input type="checkbox" checked={selectedRateIds.includes(rate.id)} onChange={(event) => setSelectedRateIds((current) => event.target.checked ? [...current, rate.id] : current.filter((id) => id !== rate.id))} />{rate.universityName} · {rate.intake} · {rate.studyLevel}</label>)}</div></details>
        {rateScope === 'organization' && <div className="mt-3 flex flex-wrap gap-2">{organizations.map((org) => <label key={org.id} className="inline-flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-xs dark:bg-slate-900"><input type="checkbox" checked={selectedOrganizationIds.includes(org.id)} onChange={(event) => setSelectedOrganizationIds((current) => event.target.checked ? [...current, org.id] : current.filter((id) => id !== org.id))} />{org.name}</label>)}</div>}
        {rateScope === 'agents' && <div className="mt-3 flex max-h-40 flex-wrap gap-2 overflow-y-auto">{accessRequests.filter((item) => item.status === 'approved').map((agent) => <label key={agent.uid} className="inline-flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-xs dark:bg-slate-900"><input type="checkbox" checked={selectedAgentIds.includes(agent.uid)} onChange={(event) => setSelectedAgentIds((current) => event.target.checked ? [...current, agent.uid] : current.filter((id) => id !== agent.uid))} />{agent.displayName} · {agent.email}</label>)}</div>}
        {rateScope !== 'agents' && <label className="mt-3 flex items-start gap-2 rounded-xl bg-amber-50 p-3 text-xs dark:bg-amber-950/20"><input type="checkbox" checked={replaceSpecificOverrides} onChange={(event) => setReplaceSpecificOverrides(event.target.checked)} /><span><strong>Replace matching Agent-specific overrides.</strong> Leave unchecked to preserve those individual rates. Cleared Agents will inherit the new organization rate.</span></label>}
        <div className="mt-3 flex flex-wrap gap-2"><button onClick={() => void handleRateAssignment()} disabled={(!selectedRateId && selectedRateIds.length === 0) || updatingUid === 'rate-assignment'} className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-bold text-white disabled:opacity-40">{updatingUid === 'rate-assignment' ? 'Applying…' : 'Apply rate assignment'}</button>{rateScope === 'agents' && <button onClick={() => void handleClearAgentOverrides()} disabled={(!selectedRateId && selectedRateIds.length === 0) || selectedAgentIds.length === 0 || updatingUid === 'rate-assignment'} className="rounded-lg border border-amber-300 px-4 py-2 text-xs font-bold text-amber-900 disabled:opacity-40 dark:text-amber-200">Clear selected Agents’ individual override</button>}</div>
      </section>

      {/* CLICKABLE METRIC CARDS ROW - Click card to filter table/grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
        {/* Card 1: Registered Accounts */}
        <div
          onClick={() => {
            setRoleFilter('ALL');
            setStatusFilter('ALL');
          }}
          title="Click to view all registered users"
          className={`p-3.5 sm:p-5 rounded-2xl border transition-all duration-200 cursor-pointer flex flex-col justify-between space-y-2 sm:space-y-3 group select-none ${
            roleFilter === 'ALL' && statusFilter === 'ALL'
              ? 'bg-blue-50 dark:bg-[#0E1526] border-blue-500 dark:border-amber-400 shadow-md ring-2 ring-blue-500/30'
              : 'bg-white dark:bg-[#0E1526] border-slate-200/80 dark:border-[#222F43] hover:bg-slate-50 dark:hover:bg-slate-800'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Registered Accounts
            </span>
            <div className="p-1.5 sm:p-2.5 bg-blue-50 dark:bg-amber-950/60 text-blue-600 dark:text-amber-400 rounded-lg sm:rounded-xl">
              <Users className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
          </div>
          <div>
            <p className="text-xl sm:text-3xl font-extrabold text-slate-900 dark:text-slate-100 font-mono tracking-tight">
              {users.length}
            </p>
            <p className="text-[10px] sm:text-[11px] text-slate-400 dark:text-slate-400 mt-0.5 sm:mt-1 font-medium">
              Click to view all accounts
            </p>
          </div>
        </div>

        {/* Card 2: Currently Online */}
        <div
          onClick={() => {
            setStatusFilter(statusFilter === 'ONLINE' ? 'ALL' : 'ONLINE');
          }}
          title="Click to filter for Online users"
          className={`p-3.5 sm:p-5 rounded-2xl border transition-all duration-200 cursor-pointer flex flex-col justify-between space-y-2 sm:space-y-3 group select-none ${
            statusFilter === 'ONLINE'
              ? 'bg-emerald-50 dark:bg-emerald-950/80 border-emerald-500 dark:border-emerald-500 shadow-md ring-2 ring-emerald-500/30'
              : 'bg-white dark:bg-[#0E1526] border-slate-200/80 dark:border-[#222F43] hover:bg-slate-50 dark:hover:bg-slate-800'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Currently Online
            </span>
            <div className="p-1.5 sm:p-2.5 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 rounded-lg sm:rounded-xl">
              <Wifi className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <p className="text-xl sm:text-3xl font-extrabold text-emerald-600 dark:text-emerald-400 font-mono tracking-tight">
                {onlineCount}
              </p>
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
              </span>
            </div>
            <p className="text-[10px] sm:text-[11px] text-slate-400 dark:text-slate-400 mt-0.5 sm:mt-1 font-medium">
              Click to filter online users
            </p>
          </div>
        </div>

        {/* Card 3: Staff & Agents (Interactive Role Filter Buttons) */}
        <div
          title="Filter by Staff or Agent roles"
          className={`p-3.5 sm:p-5 rounded-2xl border transition-all duration-200 flex flex-col justify-between space-y-2 sm:space-y-3 group select-none ${
            roleFilter === 'STAFF' || roleFilter === 'AGENT'
              ? 'bg-indigo-50 dark:bg-indigo-950/80 border-indigo-500 dark:border-indigo-500 shadow-md ring-2 ring-indigo-500/30'
              : 'bg-white dark:bg-[#0E1526] border-slate-200/80 dark:border-[#222F43]'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Staff & Agents
            </span>
            <div className="p-1.5 sm:p-2.5 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 rounded-lg sm:rounded-xl">
              <UserCheck className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setRoleFilter(roleFilter === 'STAFF' ? 'ALL' : 'STAFF')}
                className={`text-sm sm:text-xl font-extrabold font-mono px-2 py-0.5 rounded-lg transition cursor-pointer ${
                  roleFilter === 'STAFF' ? 'bg-indigo-600 text-white font-bold' : 'text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100'
                }`}
              >
                {staffCount} Staff
              </button>
              <span className="text-slate-400">/</span>
              <button
                type="button"
                onClick={() => setRoleFilter(roleFilter === 'AGENT' ? 'ALL' : 'AGENT')}
                className={`text-sm sm:text-xl font-extrabold font-mono px-2 py-0.5 rounded-lg transition cursor-pointer ${
                  roleFilter === 'AGENT' ? 'bg-amber-400 text-slate-950 font-bold' : 'text-amber-600 dark:text-amber-400 hover:bg-amber-100'
                }`}
              >
                {agentCount} Agents
              </button>
            </div>
            <p className="text-[10px] sm:text-[11px] text-slate-400 dark:text-slate-400 mt-0.5 sm:mt-1 font-medium">
              Click Staff or Agents to filter
            </p>
          </div>
        </div>

        {/* Card 4: Blocked / Disabled */}
        <div
          onClick={() => {
            setStatusFilter(statusFilter === 'DISABLED' ? 'ALL' : 'DISABLED');
          }}
          title="Click to filter for Blocked / Disabled accounts"
          className={`p-3.5 sm:p-5 rounded-2xl border transition-all duration-200 cursor-pointer flex flex-col justify-between space-y-2 sm:space-y-3 group select-none ${
            statusFilter === 'DISABLED'
              ? 'bg-rose-50 dark:bg-rose-950/80 border-rose-500 dark:border-rose-500 shadow-md ring-2 ring-rose-500/30'
              : 'bg-white dark:bg-[#0E1526] border-slate-200/80 dark:border-[#222F43] hover:bg-slate-50 dark:hover:bg-slate-800'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Blocked / Disabled
            </span>
            <div className="p-1.5 sm:p-2.5 bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 rounded-lg sm:rounded-xl">
              <Ban className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
          </div>
          <div>
            <p className={`text-xl sm:text-3xl font-extrabold font-mono tracking-tight ${disabledCount > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-900 dark:text-slate-100'}`}>
              {disabledCount}
            </p>
            <p className="text-[10px] sm:text-[11px] text-slate-400 dark:text-slate-400 mt-0.5 sm:mt-1 font-medium">
              Click to filter blocked users
            </p>
          </div>
        </div>
      </div>

      {/* Controls Bar */}
      <div className="bg-white dark:bg-[#0E1526] p-3 sm:p-4 rounded-2xl border border-slate-200 dark:border-[#222F43] shadow-xs flex flex-wrap items-center justify-between gap-3 transition-colors">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
          <input
            type="text"
            placeholder="Search users by name or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-xs sm:text-sm border border-slate-200 dark:border-[#222F43] rounded-xl bg-slate-50 dark:bg-[#18181B] text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-blue-500 dark:focus:ring-amber-400"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-xs">
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value as UserRole | 'ALL')}
            className="px-3 py-2 border border-slate-300 dark:border-[#222F43] rounded-xl bg-white dark:bg-[#18181B] text-slate-800 dark:text-slate-200 font-semibold focus:ring-2 focus:ring-blue-500"
          >
            <option value="ALL">All Roles ({users.length})</option>
            <option value="ADMIN">Admins ({adminCount})</option>
            <option value="STAFF">Staff ({staffCount})</option>
            <option value="AGENT">Agents ({agentCount})</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as 'ALL' | 'ONLINE' | 'OFFLINE' | 'DISABLED')}
            className="px-3 py-2 border border-slate-300 dark:border-[#222F43] rounded-xl bg-white dark:bg-[#18181B] text-slate-800 dark:text-slate-200 font-semibold focus:ring-2 focus:ring-blue-500"
          >
            <option value="ALL">All Statuses</option>
            <option value="ONLINE">Online Only ({onlineCount})</option>
            <option value="OFFLINE">Offline Only</option>
            <option value="DISABLED">Blocked ({disabledCount})</option>
          </select>

          {(roleFilter !== 'ALL' || statusFilter !== 'ALL' || searchQuery) && (
            <button
              onClick={() => {
                setRoleFilter('ALL');
                setStatusFilter('ALL');
                setSearchQuery('');
              }}
              className="px-2.5 py-2 text-[11px] font-bold text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 border border-slate-200 dark:border-[#222F43] rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
            >
              Reset Filters
            </button>
          )}
        </div>
      </div>

      {/* MOBILE GRID CARDS VIEW FOR USERS (3 Cards per row on ALL screens including mobile) */}
      <div className="block md:hidden space-y-3">
        {loading ? (
          <div className="p-8 text-center text-slate-500 dark:text-slate-400 bg-white dark:bg-[#0E1526] rounded-2xl border border-slate-200 dark:border-[#222F43] text-xs">
            <div className="w-6 h-6 border-2 border-blue-600 dark:border-amber-400 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
            <span>Fetching registered users...</span>
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="p-8 text-center text-slate-500 dark:text-slate-400 bg-white dark:bg-[#0E1526] rounded-2xl border border-slate-200 dark:border-[#222F43] text-xs">
            No matching users found.
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-1.5 sm:gap-2.5">
            {filteredUsers.map((u, idx) => (
              <div
                key={u.uid}
                onClick={() => setActiveUserIndex(idx)}
                className={`p-2 sm:p-3 rounded-2xl border transition-all duration-150 cursor-pointer flex flex-col justify-between gap-1.5 select-none ${
                  u.isDisabled
                    ? 'bg-rose-50/40 dark:bg-rose-950/30 border-rose-300 dark:border-rose-900/60'
                    : 'bg-white dark:bg-[#0E1526] border-slate-200 dark:border-[#222F43] hover:border-slate-300 dark:hover:border-slate-600 shadow-2xs'
                }`}
              >
                {/* Top Avatar & Online Indicator */}
                <div className="flex items-center justify-between gap-1">
                  {u.photoURL ? (
                    <img
                      src={u.photoURL}
                      alt={u.displayName}
                      className="w-7 h-7 sm:w-8 sm:h-8 rounded-full object-cover border border-slate-200 dark:border-slate-700 shrink-0"
                    />
                  ) : (
                    <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-blue-600 dark:bg-amber-400 text-white dark:text-slate-950 font-bold text-[10px] sm:text-xs flex items-center justify-center shrink-0">
                      {u.displayName ? u.displayName.charAt(0).toUpperCase() : 'U'}
                    </div>
                  )}

                  {u.isDisabled ? (
                    <Ban className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                  ) : u.isOnline ? (
                    <span className="relative flex h-2 w-2 shrink-0">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                    </span>
                  ) : (
                    <span className="w-2 h-2 rounded-full bg-slate-400 shrink-0"></span>
                  )}
                </div>

                {/* User Content */}
                <div className="space-y-0.5">
                  <h3 className="font-extrabold text-slate-900 dark:text-slate-100 text-[10px] sm:text-xs leading-snug truncate">
                    {u.displayName || 'User'}
                  </h3>
                  <p className="text-[9px] text-slate-500 dark:text-slate-400 truncate">
                    {u.email}
                  </p>
                </div>

                {/* Role Badge */}
                <div className="pt-1 border-t border-slate-100 dark:border-[#222F43] flex items-center justify-between">
                  <span
                    className={`px-1.5 py-0.5 rounded text-[8px] sm:text-[9px] font-extrabold uppercase tracking-wider ${
                      u.role === 'ADMIN'
                        ? 'bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300'
                        : u.role === 'STAFF'
                        ? 'bg-blue-100 dark:bg-blue-950/80 text-blue-800 dark:text-blue-300'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-300'
                    }`}
                  >
                    {u.role}
                  </span>
                  <span className="text-[9px] text-slate-400">View →</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* DESKTOP TABLE VIEW FOR USERS */}
      <div className="hidden md:block bg-white dark:bg-[#0E1526] rounded-2xl border border-slate-200 dark:border-[#222F43] shadow-xs overflow-hidden transition-colors">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead className="bg-[#F7F4EF] dark:bg-[#18181B] border-b border-slate-200 dark:border-[#222F43] text-xs text-slate-600 dark:text-slate-300 uppercase tracking-wider">
              <tr>
                <th className="px-5 py-3.5">User</th>
                <th className="px-5 py-3.5">Status</th>
                <th className="px-5 py-3.5">Assigned Role</th>
                <th className="px-5 py-3.5">Last Logged In</th>
                <th className="px-5 py-3.5 text-right">Actions & Role Control</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-[#222F43]">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-5 py-12 text-center text-slate-500 dark:text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <div className="w-6 h-6 border-2 border-blue-600 dark:border-amber-400 border-t-transparent rounded-full animate-spin" />
                      <span className="text-xs">Fetching registered users from Firestore...</span>
                    </div>
                  </td>
                </tr>
              ) : paginatedUsers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-12 text-center text-slate-500 dark:text-slate-400">
                    <p className="font-medium text-slate-600 dark:text-slate-300">No users match your criteria</p>
                    <p className="text-xs text-slate-400 mt-1">Try clearing search or filters.</p>
                  </td>
                </tr>
              ) : (
                paginatedUsers.map((u) => (
                  <tr key={u.uid} className={`hover:bg-slate-50/70 dark:hover:bg-slate-800/50 transition duration-100 ${u.isDisabled ? 'bg-rose-50/20 dark:bg-rose-950/20' : ''}`}>
                    {/* User Profile */}
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        {u.photoURL ? (
                          <img
                            src={u.photoURL}
                            alt={u.displayName}
                            className="w-9 h-9 rounded-full object-cover border border-slate-200 dark:border-slate-700 shadow-2xs"
                          />
                        ) : (
                          <div className="w-9 h-9 rounded-full bg-blue-600 dark:bg-amber-400 text-white dark:text-slate-950 font-bold text-xs flex items-center justify-center">
                            {u.displayName ? u.displayName.charAt(0).toUpperCase() : 'U'}
                          </div>
                        )}
                        <div>
                          <div className="font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                            <span>{u.displayName || 'Anonymous User'}</span>
                            {currentUser?.uid === u.uid && (
                              <span className="text-[10px] bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 font-bold px-1.5 py-0.5 rounded-md">
                                You
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1">
                            <Mail className="w-3 h-3 text-slate-400" />
                            <span>{u.email}</span>
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Online / Disabled Status */}
                    <td className="px-5 py-3.5">
                      {u.isDisabled ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-100 dark:bg-rose-950/80 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
                          <Ban className="w-3 h-3 text-rose-600 dark:text-rose-400" />
                          <span>Blocked</span>
                        </span>
                      ) : u.isOnline ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                          <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                          </span>
                          <span>Online</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
                          <span className="w-2 h-2 rounded-full bg-slate-400"></span>
                          <span>Offline</span>
                        </span>
                      )}
                    </td>

                    {/* Assigned Role */}
                    <td className="px-5 py-3.5">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-bold uppercase tracking-wider ${
                          u.role === 'ADMIN'
                            ? 'bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-700'
                            : u.role === 'STAFF'
                            ? 'bg-blue-100 dark:bg-blue-950/80 text-blue-800 dark:text-blue-300'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-300'
                        }`}
                      >
                        {u.role === 'ADMIN' && <ShieldCheck className="w-3.5 h-3.5" />}
                        {u.role === 'STAFF' && <UserCheck className="w-3.5 h-3.5" />}
                        {u.role === 'AGENT' && <UserX className="w-3.5 h-3.5" />}
                        <span>{u.role}</span>
                      </span>
                    </td>

                    {/* Last Login */}
                    <td className="px-5 py-3.5 text-xs text-slate-600 dark:text-slate-300 font-mono">
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                        <span>{u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleDateString() : 'Never'}</span>
                      </div>
                    </td>

                    {/* Account controls */}
                    <td className="px-5 py-3.5 text-right">
                      <div className="inline-flex items-center gap-2 justify-end">
                        {updatingUid === u.uid && (
                          <RefreshCcw className="w-4 h-4 animate-spin text-blue-600 dark:text-amber-400" />
                        )}

                        {/* Revoke / Enable Toggle */}
                        {currentUser?.uid !== u.uid && (
                          <button
                            onClick={() => handleToggleDisabled(u)}
                            disabled={updatingUid === u.uid}
                            title={u.isDisabled ? 'Restore user access' : 'Revoke user access (Block)'}
                            className={`p-1.5 rounded-lg border transition cursor-pointer ${
                              u.isDisabled
                                ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100'
                                : 'bg-white dark:bg-[#18181B] border-slate-300 dark:border-[#222F43] text-slate-500 dark:text-slate-400 hover:bg-rose-50 dark:hover:bg-rose-950/60 hover:text-rose-600 dark:hover:text-rose-400'
                            }`}
                          >
                            <Ban className="w-4 h-4" />
                          </button>
                        )}

                        {/* Delete Button */}
                        {currentUser?.uid !== u.uid && (
                          <button
                            onClick={() => setDeletingUser(u)}
                            disabled={updatingUid === u.uid}
                            title="Delete user record"
                            className="p-1.5 rounded-lg border border-slate-300 dark:border-[#222F43] bg-white dark:bg-[#18181B] text-slate-400 hover:bg-rose-50 dark:hover:bg-rose-950/60 hover:text-rose-600 dark:hover:text-rose-400 transition cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination & Footer */}
        <div className="px-5 py-3.5 bg-[#F7F4EF] dark:bg-[#18181B] border-t border-slate-200 dark:border-[#222F43] flex flex-wrap items-center justify-between gap-4 text-xs text-slate-500 dark:text-slate-400">
          <div>
            Showing <strong className="text-slate-800 dark:text-slate-200">{filteredUsers.length > 0 ? (page - 1) * PAGE_SIZE + 1 : 0}</strong> -{' '}
            <strong className="text-slate-800 dark:text-slate-200">{Math.min(page * PAGE_SIZE, filteredUsers.length)}</strong> of{' '}
            <strong className="text-slate-800 dark:text-slate-200">{filteredUsers.length}</strong> users
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(p - 1, 1))}
              disabled={page === 1}
              className="p-1.5 rounded-lg border border-slate-300 dark:border-[#222F43] hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span>
              Page <strong className="text-slate-700 dark:text-slate-300">{page}</strong> of{' '}
              <strong className="text-slate-700 dark:text-slate-300">{totalPages}</strong>
            </span>
            <button
              onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
              disabled={page === totalPages}
              className="p-1.5 rounded-lg border border-slate-300 dark:border-[#222F43] hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Full User Detail Pop-Up Modal */}
      <UserDetailModal
        user={activeUser}
        currentIndex={activeUserIndex}
        totalCount={filteredUsers.length}
        currentUserId={currentUser?.uid}
        onClose={() => setActiveUserIndex(null)}
        onPrev={handlePrevUser}
        onNext={handleNextUser}
        onToggleDisabled={handleToggleDisabled}
        onDeleteRequest={setDeletingUser}
        updatingUid={updatingUid}
      />

      {/* Delete Confirmation Modal */}
      {deletingUser && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-2xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#0E1526] rounded-2xl max-w-md w-full p-6 space-y-5 shadow-2xl border border-slate-200 dark:border-[#222F43] animate-in fade-in zoom-in-95">
            <div className="flex items-start justify-between">
              <div className="p-3 bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 rounded-xl border border-rose-200 dark:border-rose-800">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <button
                onClick={() => setDeletingUser(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-1">
              <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">Delete User Record?</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                Are you sure you want to permanently delete the user record for{' '}
                <strong className="text-slate-800 dark:text-slate-200">{deletingUser.displayName}</strong> ({deletingUser.email})?
              </p>
            </div>

            <div className="p-3 bg-slate-50 dark:bg-[#18181B] border border-slate-200 dark:border-[#222F43] rounded-xl text-xs text-slate-600 dark:text-slate-300 space-y-1">
              <p className="font-semibold text-slate-800 dark:text-slate-200">Warning:</p>
              <p>This action removes the user record from the system database. They will need to re-register upon next sign-in.</p>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setDeletingUser(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDelete}
                disabled={updatingUid === deletingUser.uid}
                className="px-4 py-2 text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white rounded-xl shadow-xs transition flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {updatingUid === deletingUser.uid && <RefreshCcw className="w-3.5 h-3.5 animate-spin" />}
                <span>Permanently Delete</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
