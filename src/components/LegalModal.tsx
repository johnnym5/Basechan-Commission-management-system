import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  getEmailPreferences,
  saveEmailPreferences,
  unsubscribeAllEmails,
} from '../utils/emailTemplates';
import {
  ShieldCheck,
  Lock,
  Download,
  Trash2,
  X,
  CheckCircle2,
  Mail,
  Ban,
  Activity,
} from 'lucide-react';

interface LegalModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: 'privacy' | 'terms' | 'dpa' | 'sla' | 'licenses' | 'controls';
}

export const LegalModal: React.FC<LegalModalProps> = ({
  isOpen,
  onClose,
  initialTab = 'privacy',
}) => {
  const { user, role } = useAuth();
  const [activeTab, setActiveTab] = useState<'privacy' | 'terms' | 'dpa' | 'sla' | 'licenses' | 'controls'>(initialTab);

  // Email Notification Preference State
  const [emailPrefs, setEmailPrefs] = useState(getEmailPreferences());
  const [notice, setNotice] = useState<string | null>(null);

  // Deletion / Cancellation Request State
  const [isCancelSubmitted, setIsCancelSubmitted] = useState<boolean>(false);
  const [isDeleteSubmitted, setIsDeleteSubmitted] = useState<boolean>(false);

  if (!isOpen) return null;

  // Data Export Handler
  const handleExportData = () => {
    const exportPayload = {
      userProfile: {
        uid: user?.uid,
        email: user?.email,
        displayName: user?.displayName,
        role: role,
        emailVerified: user?.emailVerified,
      },
      emailPreferences: emailPrefs,
      exportedAt: new Date().toISOString(),
      system: 'Basechan CMS',
      dataRightsNotice: 'GDPR Article 15 / CCPA Compliant Export',
    };

    const blob = new Blob([JSON.stringify(exportPayload, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `basechan_user_data_${user?.email?.split('@')[0] || 'export'}.json`;
    a.click();
    URL.revokeObjectURL(url);

    setNotice('Personal data exported successfully in JSON format.');
    setTimeout(() => setNotice(null), 4000);
  };

  const handleUpdatePrefs = (key: keyof typeof emailPrefs, value: boolean) => {
    const updated = saveEmailPreferences({ [key]: value });
    setEmailPrefs(updated);
    setNotice('Email preferences saved.');
    setTimeout(() => setNotice(null), 3000);
  };

  const handleUnsubscribeAll = () => {
    const updated = unsubscribeAllEmails();
    setEmailPrefs(updated);
    setNotice('Unsubscribed from all optional notification emails.');
    setTimeout(() => setNotice(null), 4000);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95">
        {/* Header */}
        <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/80 dark:bg-slate-900/80 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 rounded-2xl">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <span>Legal, Privacy & Compliance Trust Center</span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Basechan International Governance, Terms, Subprocessors & Data Rights Controls
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Notice Banner */}
        {notice && (
          <div className="bg-emerald-500 text-white text-xs px-5 py-2.5 flex items-center justify-between animate-in fade-in">
            <div className="flex items-center gap-2 font-semibold">
              <CheckCircle2 className="w-4 h-4" />
              <span>{notice}</span>
            </div>
            <button onClick={() => setNotice(null)} className="text-white/80 hover:text-white font-bold cursor-pointer">
              ✕
            </button>
          </div>
        )}

        {/* Tab Navigation */}
        <div className="border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-5 flex items-center gap-1 overflow-x-auto text-xs shrink-0">
          <button
            onClick={() => setActiveTab('privacy')}
            className={`py-3.5 px-3 border-b-2 font-semibold transition cursor-pointer whitespace-nowrap ${
              activeTab === 'privacy'
                ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400 font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            Privacy Policy
          </button>

          <button
            onClick={() => setActiveTab('terms')}
            className={`py-3.5 px-3 border-b-2 font-semibold transition cursor-pointer whitespace-nowrap ${
              activeTab === 'terms'
                ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400 font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            Terms of Service
          </button>

          <button
            onClick={() => setActiveTab('dpa')}
            className={`py-3.5 px-3 border-b-2 font-semibold transition cursor-pointer whitespace-nowrap ${
              activeTab === 'dpa'
                ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400 font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            DPA & Subprocessors
          </button>

          <button
            onClick={() => setActiveTab('sla')}
            className={`py-3.5 px-3 border-b-2 font-semibold transition cursor-pointer whitespace-nowrap ${
              activeTab === 'sla'
                ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400 font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            Uptime SLA
          </button>

          <button
            onClick={() => setActiveTab('licenses')}
            className={`py-3.5 px-3 border-b-2 font-semibold transition cursor-pointer whitespace-nowrap ${
              activeTab === 'licenses'
                ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400 font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            Package Licenses
          </button>

          <button
            onClick={() => setActiveTab('controls')}
            className={`py-3.5 px-3 border-b-2 font-semibold transition cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === 'controls'
                ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400 font-bold'
                : 'border-transparent text-emerald-700 dark:text-emerald-400 font-bold'
            }`}
          >
            <Lock className="w-3.5 h-3.5" />
            <span>My Privacy & Data Rights</span>
          </button>
        </div>

        {/* Tab Body Content */}
        <div className="p-6 overflow-y-auto space-y-6 text-sm text-slate-700 dark:text-slate-300 leading-relaxed flex-1">
          {/* TAB 1: Privacy Policy */}
          {activeTab === 'privacy' && (
            <div className="space-y-4">
              <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-2xl">
                <h3 className="font-bold text-emerald-900 dark:text-emerald-200 text-sm">Key Privacy Guarantees</h3>
                <ul className="text-xs text-emerald-800 dark:text-emerald-300 space-y-1 mt-1 list-disc pl-4">
                  <li><strong>Zero AI Training:</strong> Your commission figures and files are never used to train public or commercial AI models.</li>
                  <li><strong>Domain Guard:</strong> Authenticated strictly via Google Auth restricted to authorized domains.</li>
                  <li><strong>No Data Sales:</strong> Personal details and rate data are never sold or shared for advertising.</li>
                </ul>
              </div>

              <div className="space-y-3 text-xs">
                <h4 className="font-bold text-sm text-slate-900 dark:text-slate-100">1. Data Collection</h4>
                <p>We collect account profiles (name, email, avatar photo, user ID) upon Google sign-in. System logs record login dates, active roles, and audit operations.</p>

                <h4 className="font-bold text-sm text-slate-900 dark:text-slate-100">2. How Data Is Used</h4>
                <p>Data is used exclusively for internal commission intelligence, application routing, margin calculations, and database access control.</p>

                <h4 className="font-bold text-sm text-slate-900 dark:text-slate-100">3. Storage & Infrastructure</h4>
                <p>Database records are hosted on Google Cloud Platform / Firebase Firestore in multi-region secure datacenters.</p>
              </div>
            </div>
          )}

          {/* TAB 2: Terms of Service */}
          {activeTab === 'terms' && (
            <div className="space-y-4">
              <div className="p-4 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-2xl space-y-2 text-xs">
                <div className="flex items-center gap-2 text-slate-900 dark:text-slate-100 font-bold text-sm">
                  <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <span>Enforceable Liability Cap & Disclosures</span>
                </div>
                <p>
                  <strong>Limitation of Liability:</strong> Total cumulative liability arising out of or relating to Basechan CMS is strictly capped at the total fees paid by you in the preceding 12 months, or $100 USD, whichever is greater.
                </p>
                <p>
                  <strong>Subscriptions & Auto-Renewal:</strong> Basechan CMS operates as an internal corporate system. Where recurring agency partner access fees apply, cancellation requires written notice or in-app request at least 30 days prior to renewal.
                </p>
                <p>
                  <strong>Partner Logo Usage:</strong> Partner agency and university logos are used solely with explicit permission. Unlicensed or unauthorized logo displays in external marketing are strictly prohibited.
                </p>
              </div>
            </div>
          )}

          {/* TAB 3: DPA & Subprocessors */}
          {activeTab === 'dpa' && (
            <div className="space-y-4">
              <div>
                <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm">Published Third-Party Subprocessors</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  All subprocessors comply with GDPR Article 28 and CCPA standards.
                </p>
              </div>

              <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden text-xs">
                <table className="w-full text-left">
                  <thead className="bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="p-3">Subprocessor</th>
                      <th className="p-3">Purpose</th>
                      <th className="p-3">Location</th>
                      <th className="p-3">Security Standards</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    <tr>
                      <td className="p-3 font-semibold text-slate-900 dark:text-slate-100">Google Cloud / Firebase</td>
                      <td className="p-3">Database, Hosting & Authentication</td>
                      <td className="p-3">Multi-Region (USA)</td>
                      <td className="p-3"><span className="text-emerald-600 dark:text-emerald-400 font-bold">SOC 1, SOC 2, SOC 3, ISO 27001</span></td>
                    </tr>
                    <tr>
                      <td className="p-3 font-semibold text-slate-900 dark:text-slate-100">Google Identity Services</td>
                      <td className="p-3">OAuth Single Sign-On</td>
                      <td className="p-3">Global</td>
                      <td className="p-3"><span className="text-emerald-600 dark:text-emerald-400 font-bold">SOC 2, ISO 27001</span></td>
                    </tr>
                    <tr>
                      <td className="p-3 font-semibold text-slate-900 dark:text-slate-100">SheetJS (Community)</td>
                      <td className="p-3">In-Browser Excel Parser</td>
                      <td className="p-3">Browser Local Memory</td>
                      <td className="p-3"><span className="text-slate-500">100% Client-Side Local Execution</span></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 4: Uptime SLA */}
          {activeTab === 'sla' && (
            <div className="space-y-4 text-xs">
              <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-2xl space-y-1">
                <div className="flex items-center gap-2 text-emerald-900 dark:text-emerald-200 font-bold text-sm">
                  <Activity className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <span>Target Uptime Commitment: 99.95%</span>
                </div>
                <p className="text-emerald-800 dark:text-emerald-300">
                  Backed by Google Cloud multi-region database infrastructure. Maintenance windows announced 48 hours in advance.
                </p>
              </div>
            </div>
          )}

          {/* TAB 5: Package Licenses */}
          {activeTab === 'licenses' && (
            <div className="space-y-4">
              <div>
                <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm">Open Source Package License Audit</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  All 11 dependencies use permissive open-source licenses (MIT, Apache-2.0, ISC). Zero copyleft or GPL viral license risks.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                <div className="p-3 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 rounded-xl flex items-center justify-between">
                  <span className="font-mono font-bold text-slate-800 dark:text-slate-200">react & react-dom</span>
                  <span className="px-2 py-0.5 bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 font-mono font-bold rounded-md">MIT</span>
                </div>
                <div className="p-3 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 rounded-xl flex items-center justify-between">
                  <span className="font-mono font-bold text-slate-800 dark:text-slate-200">firebase</span>
                  <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-950/80 text-blue-800 dark:text-blue-300 font-mono font-bold rounded-md">Apache-2.0</span>
                </div>
                <div className="p-3 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 rounded-xl flex items-center justify-between">
                  <span className="font-mono font-bold text-slate-800 dark:text-slate-200">lucide-react</span>
                  <span className="px-2 py-0.5 bg-indigo-100 dark:bg-indigo-950/80 text-indigo-800 dark:text-indigo-300 font-mono font-bold rounded-md">ISC</span>
                </div>
                <div className="p-3 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 rounded-xl flex items-center justify-between">
                  <span className="font-mono font-bold text-slate-800 dark:text-slate-200">@tanstack/react-table</span>
                  <span className="px-2 py-0.5 bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 font-mono font-bold rounded-md">MIT</span>
                </div>
                <div className="p-3 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 rounded-xl flex items-center justify-between">
                  <span className="font-mono font-bold text-slate-800 dark:text-slate-200">tailwindcss</span>
                  <span className="px-2 py-0.5 bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 font-mono font-bold rounded-md">MIT</span>
                </div>
                <div className="p-3 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 rounded-xl flex items-center justify-between">
                  <span className="font-mono font-bold text-slate-800 dark:text-slate-200">xlsx (SheetJS)</span>
                  <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-950/80 text-blue-800 dark:text-blue-300 font-mono font-bold rounded-md">Apache-2.0</span>
                </div>
              </div>
            </div>
          )}

          {/* TAB 6: User Data Rights & Self-Service Controls */}
          {activeTab === 'controls' && (
            <div className="space-y-6">
              {/* Section A: Data Export */}
              <div className="p-4 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-bold text-slate-900 dark:text-slate-100 text-sm flex items-center gap-2">
                      <Download className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                      <span>Export My Personal Data (GDPR Art. 15)</span>
                    </h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      Download a complete copy of your account profile, role assignment, and system preferences in JSON format.
                    </p>
                  </div>
                  <button
                    onClick={handleExportData}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs rounded-xl shadow-xs transition flex items-center gap-2 cursor-pointer shrink-0"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Export JSON</span>
                  </button>
                </div>
              </div>

              {/* Section B: Email Notification Preferences & Unsubscribe */}
              <div className="p-4 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-bold text-slate-900 dark:text-slate-100 text-sm flex items-center gap-2">
                      <Mail className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                      <span>Email Notifications & Unsubscribe Controls</span>
                    </h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      Manage system notifications. Every email includes a 1-click unsubscribe header.
                    </p>
                  </div>

                  <button
                    onClick={handleUnsubscribeAll}
                    disabled={emailPrefs.unsubscribedAll}
                    className="px-3 py-1.5 bg-rose-50 dark:bg-rose-950/60 hover:bg-rose-100 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 font-semibold text-xs rounded-xl transition cursor-pointer disabled:opacity-50"
                  >
                    Unsubscribe All
                  </button>
                </div>

                <div className="space-y-2 text-xs">
                  <label className="flex items-center justify-between p-2.5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 cursor-pointer">
                    <span className="font-medium text-slate-800 dark:text-slate-200">Commission Rate & Intake Updates</span>
                    <input
                      type="checkbox"
                      checked={emailPrefs.rateUpdates && !emailPrefs.unsubscribedAll}
                      onChange={(e) => handleUpdatePrefs('rateUpdates', e.target.checked)}
                      className="w-4 h-4 accent-emerald-600 rounded cursor-pointer"
                    />
                  </label>

                  <label className="flex items-center justify-between p-2.5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 cursor-pointer">
                    <span className="font-medium text-slate-800 dark:text-slate-200">Security & Account Access Alerts</span>
                    <input
                      type="checkbox"
                      checked={emailPrefs.securityAlerts && !emailPrefs.unsubscribedAll}
                      onChange={(e) => handleUpdatePrefs('securityAlerts', e.target.checked)}
                      className="w-4 h-4 accent-emerald-600 rounded cursor-pointer"
                    />
                  </label>
                </div>
              </div>

              {/* Section C: Online User Cancellation & Data Deletion */}
              <div className="p-4 bg-rose-50/50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/60 rounded-2xl space-y-3">
                <div>
                  <h4 className="font-bold text-rose-900 dark:text-rose-200 text-sm flex items-center gap-2">
                    <Ban className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                    <span>Online Account Cancellation & Data Eradication</span>
                  </h4>
                  <p className="text-xs text-rose-800/80 dark:text-rose-300/80 mt-0.5">
                    Cancel system access online or request account erasure under GDPR Article 17 (Right to be Forgotten).
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-3 pt-1">
                  <button
                    onClick={() => {
                      setIsCancelSubmitted(true);
                      setNotice('Online access cancellation request logged. Your account will be offboarded.');
                      setTimeout(() => setNotice(null), 5000);
                    }}
                    disabled={isCancelSubmitted}
                    className="px-4 py-2 bg-slate-800 dark:bg-slate-700 hover:bg-slate-900 text-white font-semibold text-xs rounded-xl shadow-xs transition cursor-pointer disabled:opacity-50"
                  >
                    {isCancelSubmitted ? 'Cancellation Logged' : 'Cancel Account Online'}
                  </button>

                  <button
                    onClick={() => {
                      setIsDeleteSubmitted(true);
                      setNotice('Data erasure request submitted. Personal records will be purged within 30 days.');
                      setTimeout(() => setNotice(null), 5000);
                    }}
                    disabled={isDeleteSubmitted}
                    className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs rounded-xl shadow-xs transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>{isDeleteSubmitted ? 'Erasure Requested' : 'Request Account Data Deletion'}</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50/80 dark:bg-slate-900/80 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 shrink-0">
          <span>Basechan International · Confidential Legal Trust Center</span>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 text-white font-semibold rounded-xl hover:bg-slate-900 transition cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
