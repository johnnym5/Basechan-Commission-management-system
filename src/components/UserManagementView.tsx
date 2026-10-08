import React, { useEffect, useState, useMemo } from 'react';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import type { UserRecord, UserRole } from '../types';
import {
  Users,
  Wifi,
  ShieldCheck,
  UserCheck,
  UserX,
  Search,
  SlidersHorizontal,
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

export const UserManagementView: React.FC = () => {
  const { updateUserRole, setUserDisabledStatus, deleteUserRecord, user: currentUser } = useAuth();
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [roleFilter, setRoleFilter] = useState<UserRole | 'ALL'>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ONLINE' | 'OFFLINE' | 'DISABLED'>('ALL');

  // Action Loading states
  const [updatingUid, setUpdatingUid] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Delete Modal State
  const [deletingUser, setDeletingUser] = useState<UserRecord | null>(null);

  // Pagination State
  const [page, setPage] = useState<number>(1);
  const PAGE_SIZE = 10;

  // Subscribe to real-time users collection
  useEffect(() => {
    setLoading(true);
    const q = query(collection(db, 'users'), orderBy('lastLoginAt', 'desc'));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const records: UserRecord[] = [];
        snapshot.forEach((docSnap) => {
          records.push(docSnap.data() as UserRecord);
        });
        setUsers(records);
        setLoading(false);
      },
      (err) => {
        console.error('Error listening to users collection:', err);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [searchQuery, roleFilter, statusFilter]);

  // Role modification handler
  const handleRoleChange = async (targetUid: string, targetEmail: string, newRole: UserRole) => {
    try {
      setUpdatingUid(targetUid);
      await updateUserRole(targetUid, newRole);
      setNotice(`Updated role for ${targetEmail} to ${newRole}`);
      setTimeout(() => setNotice(null), 4000);
    } catch (err) {
      console.error('Failed to change user role:', err);
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
  const adminCount = useMemo(() => users.filter((u) => u.role === 'ADMIN').length, [users]);
  const staffCount = useMemo(() => users.filter((u) => u.role === 'STAFF').length, [users]);
  const agentCount = useMemo(() => users.filter((u) => u.role === 'AGENT').length, [users]);
  const disabledCount = useMemo(() => users.filter((u) => u.isDisabled).length, [users]);

  // Filtering
  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
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
  }, [users, searchQuery, roleFilter, statusFilter]);

  // Paginated Slice
  const totalPages = Math.ceil(filteredUsers.length / PAGE_SIZE) || 1;
  const paginatedUsers = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filteredUsers.slice(start, start + PAGE_SIZE);
  }, [filteredUsers, page]);

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

  return (
    <div className="space-y-6">
      {/* Banner Notice */}
      {notice && (
        <div className="bg-emerald-500 text-white text-xs px-4 py-3 rounded-xl shadow-md flex items-center justify-between animate-in fade-in">
          <div className="flex items-center gap-2 font-semibold">
            <CheckCircle2 className="w-4 h-4" />
            <span>{notice}</span>
          </div>
          <button onClick={() => setNotice(null)} className="text-white/80 hover:text-white font-bold cursor-pointer">
            ✕
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2.5">
            <Users className="w-7 h-7 text-emerald-600 dark:text-emerald-400" />
            User Management & Activity
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            View all users, check who is currently online, assign roles, and manage account access.
          </p>
        </div>
      </div>

      {/* Metric Cards Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Registered Accounts
            </p>
            <p className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-1 font-mono">
              {users.length}
            </p>
          </div>
          <div className="p-3 bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 rounded-xl">
            <Users className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Currently Online
            </p>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 font-mono">
                {onlineCount}
              </span>
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
              </span>
            </div>
          </div>
          <div className="p-3 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 rounded-xl">
            <Wifi className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Staff & Agents
            </p>
            <p className="text-2xl font-bold text-indigo-600 dark:text-indigo-400 mt-1 font-mono">
              {staffCount} <span className="text-xs font-normal text-slate-400">Staff</span> / {agentCount} <span className="text-xs font-normal text-slate-400">Agents</span>
            </p>
          </div>
          <div className="p-3 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 rounded-xl">
            <UserCheck className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Blocked / Disabled
            </p>
            <p className={`text-2xl font-bold mt-1 font-mono ${disabledCount > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-700 dark:text-slate-300'}`}>
              {disabledCount}
            </p>
          </div>
          <div className="p-3 bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 rounded-xl">
            <Ban className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Controls Bar */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div className="relative flex-1 min-w-[260px]">
          <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
          <input
            type="text"
            placeholder="Search users by name or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-xs sm:text-sm border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3 text-xs">
          <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider">
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span>Filters:</span>
          </div>

          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value as UserRole | 'ALL')}
            className="px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
          >
            <option value="ALL">All Roles ({users.length})</option>
            <option value="ADMIN">Admins ({adminCount})</option>
            <option value="STAFF">Staff ({staffCount})</option>
            <option value="AGENT">Agents ({agentCount})</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as 'ALL' | 'ONLINE' | 'OFFLINE' | 'DISABLED')}
            className="px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
          >
            <option value="ALL">All Statuses</option>
            <option value="ONLINE">Online Only ({onlineCount})</option>
            <option value="OFFLINE">Offline Only</option>
            <option value="DISABLED">Blocked / Disabled ({disabledCount})</option>
          </select>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead className="bg-slate-50/80 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-300 uppercase tracking-wider">
              <tr>
                <th className="px-5 py-3.5">User</th>
                <th className="px-5 py-3.5">Status</th>
                <th className="px-5 py-3.5">Assigned Role</th>
                <th className="px-5 py-3.5">Last Logged In</th>
                <th className="px-5 py-3.5">Joined Date</th>
                <th className="px-5 py-3.5 text-right">Actions & Role Control</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center text-slate-500 dark:text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <div className="w-6 h-6 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
                      <span className="text-xs">Fetching registered users from Firestore...</span>
                    </div>
                  </td>
                </tr>
              ) : paginatedUsers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center text-slate-500 dark:text-slate-400">
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
                          <div className="w-9 h-9 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold text-xs flex items-center justify-center">
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
                            ? 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
                            : u.role === 'STAFF'
                            ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800'
                            : 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
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
                        <span>{formatDate(u.lastLoginAt)}</span>
                      </div>
                    </td>

                    {/* Joined Date */}
                    <td className="px-5 py-3.5 text-xs text-slate-500 dark:text-slate-400 font-mono">
                      {formatDate(u.createdAt)}
                    </td>

                    {/* Actions & Role Control */}
                    <td className="px-5 py-3.5 text-right">
                      <div className="inline-flex items-center gap-2 justify-end">
                        {updatingUid === u.uid && (
                          <RefreshCcw className="w-4 h-4 animate-spin text-emerald-600 dark:text-emerald-400" />
                        )}

                        {/* Role Selector */}
                        <select
                          value={u.role}
                          disabled={updatingUid === u.uid || currentUser?.uid === u.uid}
                          onChange={(e) =>
                            handleRoleChange(u.uid, u.email, e.target.value as UserRole)
                          }
                          className="px-2.5 py-1 text-xs border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 font-medium text-slate-700 dark:text-slate-200 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 disabled:opacity-50 cursor-pointer"
                        >
                          <option value="ADMIN">ADMIN</option>
                          <option value="STAFF">STAFF</option>
                          <option value="AGENT">AGENT</option>
                        </select>

                        {/* Revoke / Enable Toggle */}
                        {currentUser?.uid !== u.uid && (
                          <button
                            onClick={() => handleToggleDisabled(u)}
                            disabled={updatingUid === u.uid}
                            title={u.isDisabled ? 'Restore user access' : 'Revoke user access (Block)'}
                            className={`p-1.5 rounded-lg border transition cursor-pointer ${
                              u.isDisabled
                                ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100'
                                : 'bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:bg-rose-50 dark:hover:bg-rose-950/60 hover:text-rose-600 dark:hover:text-rose-400'
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
                            className="p-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-400 hover:bg-rose-50 dark:hover:bg-rose-950/60 hover:text-rose-600 dark:hover:text-rose-400 transition cursor-pointer"
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
        <div className="px-5 py-3.5 bg-slate-50/60 dark:bg-slate-800/60 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-4 text-xs text-slate-500 dark:text-slate-400">
          <div>
            Showing <strong className="text-slate-800 dark:text-slate-200">{filteredUsers.length > 0 ? (page - 1) * PAGE_SIZE + 1 : 0}</strong> -{' '}
            <strong className="text-slate-800 dark:text-slate-200">{Math.min(page * PAGE_SIZE, filteredUsers.length)}</strong> of{' '}
            <strong className="text-slate-800 dark:text-slate-200">{filteredUsers.length}</strong> users
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(p - 1, 1))}
              disabled={page === 1}
              className="p-1.5 rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
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
              className="p-1.5 rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {deletingUser && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-2xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full p-6 space-y-5 shadow-2xl border border-slate-200 dark:border-slate-800 animate-in fade-in zoom-in-95">
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

            <div className="p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-600 dark:text-slate-300 space-y-1">
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
