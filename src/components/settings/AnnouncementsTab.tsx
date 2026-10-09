import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  subscribeToSystemAnnouncements,
  publishAnnouncement,
  deleteAnnouncement,
  type SystemAnnouncement,
} from '../../services/announcementService';
import {
  Megaphone,
  Plus,
  Trash2,
  Bell,
  CheckCircle2,
} from 'lucide-react';

export const AnnouncementsTab: React.FC = () => {
  const { user } = useAuth();
  const [announcements, setAnnouncements] = useState<SystemAnnouncement[]>([]);
  const [loading, setLoading] = useState(true);

  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [targetRole, setTargetRole] = useState<'ALL' | 'STAFF' | 'AGENT'>('ALL');
  const [isBanner, setIsBanner] = useState(true);
  const [isPublishing, setIsPublishing] = useState(false);
  const [statusNotice, setStatusNotice] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    return subscribeToSystemAnnouncements(
      (items) => {
        setAnnouncements(items);
        setLoading(false);
      },
      (err) => {
        console.error('Error fetching system announcements:', err);
        setLoading(false);
      }
    );
  }, []);

  const handlePublish = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !message.trim()) return;

    setIsPublishing(true);
    setStatusNotice(null);

    try {
      await publishAnnouncement(
        {
          title: title.trim(),
          message: message.trim(),
          targetRole,
          isBanner,
          isActive: true,
          createdBy: user?.email || 'Admin',
        },
        user?.email || 'Admin'
      );

      setTitle('');
      setMessage('');
      setTargetRole('ALL');
      setIsBanner(true);
      setStatusNotice('Announcement published successfully.');
    } catch (err) {
      console.error('Error publishing announcement:', err);
      setStatusNotice('Error publishing announcement. Please check permissions.');
    } finally {
      setIsPublishing(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteAnnouncement(id);
      setStatusNotice('Announcement deleted.');
    } catch (err) {
      console.error('Error deleting announcement:', err);
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

      {/* Publish New Broadcast Announcement Form */}
      <div className="p-5 rounded-3xl bg-white dark:bg-[#0E1526] border border-slate-200 dark:border-[#222F43] shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-[#222F43] pb-3">
          <div className="flex items-center gap-2">
            <Megaphone className="w-4 h-4 text-blue-600 dark:text-amber-400" />
            <h3 className="font-extrabold text-sm text-slate-900 dark:text-slate-100">
              Publish System Broadcast Announcement
            </h3>
          </div>
          <span className="px-2 py-0.5 rounded text-[9px] font-black uppercase bg-blue-100 dark:bg-amber-400 text-blue-900 dark:text-slate-950">
            SYSTEM ANNOUNCEMENTS
          </span>
        </div>

        <form onSubmit={handlePublish} className="space-y-4 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="block font-bold text-slate-700 dark:text-slate-300">
                Announcement Headline Title
              </label>
              <input
                type="text"
                placeholder="e.g. Sept 2026 Commission Rates Published"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-[#222F43] bg-slate-50 dark:bg-[#18181B] text-slate-900 dark:text-slate-100 font-bold text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block font-bold text-slate-700 dark:text-slate-300">
                Target Audience Recipient
              </label>
              <select
                value={targetRole}
                onChange={(e) => setTargetRole(e.target.value as 'ALL' | 'STAFF' | 'AGENT')}
                className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-[#222F43] bg-slate-50 dark:bg-[#18181B] text-slate-900 dark:text-slate-100 font-extrabold text-xs cursor-pointer"
              >
                <option value="ALL">All Users (Staff & Agents)</option>
                <option value="STAFF">Staff Members Only</option>
                <option value="AGENT">Approved Agents Only</option>
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="block font-bold text-slate-700 dark:text-slate-300">
              Announcement Message Body
            </label>
            <textarea
              rows={3}
              placeholder="e.g. New commission structures for UK and Australia September 2026 intakes have been updated."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              required
              className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-[#222F43] bg-slate-50 dark:bg-[#18181B] text-slate-900 dark:text-slate-100 font-medium text-xs leading-relaxed"
            />
          </div>

          <div className="flex items-center justify-between pt-2">
            <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-700 dark:text-slate-300">
              <input
                type="checkbox"
                checked={isBanner}
                onChange={(e) => setIsBanner(e.target.checked)}
                className="w-4 h-4 rounded border-slate-300 dark:border-slate-700 text-blue-600 dark:text-amber-400 focus:ring-amber-400 cursor-pointer"
              />
              <span>Display as top banner alert on login</span>
            </label>

            <button
              type="submit"
              disabled={isPublishing || !title.trim() || !message.trim()}
              className="px-5 py-2.5 bg-blue-600 dark:bg-amber-400 text-white dark:text-slate-950 font-extrabold text-xs rounded-xl shadow-xs hover:bg-blue-700 dark:hover:bg-amber-500 disabled:opacity-40 transition cursor-pointer flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              <span>{isPublishing ? 'Publishing...' : 'Publish Announcement'}</span>
            </button>
          </div>
        </form>
      </div>

      {/* Active System Announcements List */}
      <div className="space-y-3">
        <span className="text-xs font-extrabold text-slate-700 dark:text-slate-300 uppercase tracking-wider block">
          Active Announcements ({announcements.length}):
        </span>

        {loading ? (
          <div className="p-8 text-center text-xs text-slate-400 font-medium">
            Loading system announcements...
          </div>
        ) : announcements.length === 0 ? (
          <div className="p-8 border border-dashed border-slate-200 dark:border-[#222F43] rounded-3xl text-center text-xs text-slate-400 font-medium space-y-1">
            <Bell className="w-6 h-6 mx-auto text-slate-300 dark:text-slate-600" />
            <p>No active announcements broadcasted.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {announcements.map((anc) => (
              <div
                key={anc.id}
                className="p-4 rounded-2xl bg-white dark:bg-[#0E1526] border border-slate-200 dark:border-[#222F43] flex items-start justify-between gap-4 text-xs"
              >
                <div className="space-y-1.5 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-extrabold text-sm text-slate-900 dark:text-slate-100">
                      {anc.title}
                    </span>
                    <span className="px-2 py-0.5 rounded text-[9px] font-black uppercase bg-blue-100 dark:bg-blue-950/80 text-blue-800 dark:text-blue-300">
                      Target: {anc.targetRole}
                    </span>
                    {anc.isBanner && (
                      <span className="px-2 py-0.5 rounded text-[9px] font-black uppercase bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300">
                        Top Banner
                      </span>
                    )}
                  </div>
                  <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
                    {anc.message}
                  </p>
                  <div className="text-[10px] text-slate-400 font-medium flex items-center gap-3 pt-1">
                    <span>By: {anc.createdBy}</span>
                    <span>•</span>
                    <span>{new Date(anc.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleDelete(anc.id)}
                  title="Delete Announcement"
                  className="p-2 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded-xl transition cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
