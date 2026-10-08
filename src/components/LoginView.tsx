import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { LegalModal } from './LegalModal';
import {
  AlertCircle,
  ShieldCheck,
  Building2,
  TrendingUp,
  Layers,
  ArrowRight,
  Lock,
} from 'lucide-react';

export const LoginView: React.FC = () => {
  const { signInWithGoogle, error, loading, clearError } = useAuth();
  const [acceptedTerms, setAcceptedTerms] = useState<boolean>(false);
  const [isLegalModalOpen, setIsLegalModalOpen] = useState<boolean>(false);
  const [legalModalInitialTab, setLegalModalInitialTab] = useState<'privacy' | 'terms'>('privacy');

  const openLegalModal = (tab: 'privacy' | 'terms') => {
    setLegalModalInitialTab(tab);
    setIsLegalModalOpen(true);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-4 sm:p-6 lg:p-8 relative overflow-hidden font-sans select-none">
      {/* Background Ambient Glows */}
      <div className="absolute top-0 right-1/4 w-[500px] h-[500px] bg-emerald-500/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-0 left-1/4 w-[500px] h-[500px] bg-indigo-500/10 rounded-full blur-[120px] pointer-events-none" />

      {/* Background Grid Accent */}
      <div className="absolute inset-0 bg-[radial-gradient(#334155_1px,transparent_1px)] [background-size:32px_32px] opacity-15 pointer-events-none" />

      {/* Main Dual-Pane Container */}
      <div className="max-w-5xl w-full grid grid-cols-1 lg:grid-cols-12 gap-0 bg-slate-900/80 backdrop-blur-2xl border border-slate-800 rounded-3xl shadow-2xl overflow-hidden relative z-10">

        {/* LEFT PANE: Brand Showcase & Value Propositions (Visible on lg+) */}
        <div className="lg:col-span-6 p-8 lg:p-12 bg-gradient-to-br from-slate-900 via-slate-900/90 to-slate-950 flex flex-col justify-between border-b lg:border-b-0 lg:border-r border-slate-800/80 relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 via-amber-400 to-indigo-500" />

          <div className="space-y-6">
            {/* Header Brand */}
            <div className="flex items-center gap-3">
              <div className="p-1 bg-slate-800 rounded-2xl border border-amber-400/40 shadow-lg shadow-amber-500/10">
                <img
                  src="/logo.png"
                  alt="Basechan Logo"
                  className="w-11 h-11 rounded-xl object-cover"
                />
              </div>
              <div>
                <h2 className="text-lg font-black tracking-tight text-white leading-tight">
                  Basechan CMS
                </h2>
                <p className="text-[11px] text-amber-400 font-semibold uppercase tracking-wider">
                  Internal Intelligence Portal
                </p>
              </div>
            </div>

            {/* Editorial Headline */}
            <div className="space-y-2 pt-4">
              <h1 className="text-2xl sm:text-3xl font-extrabold text-white leading-snug tracking-tight">
                Commission Intelligence & Margin Optimization
              </h1>
              <p className="text-xs sm:text-sm text-slate-400 leading-relaxed font-normal">
                Real-time university agreement comparator and payout routing directory built for Basechan staff and education partner agents.
              </p>
            </div>

            {/* Feature Highlights Grid */}
            <div className="space-y-3 pt-2">
              <div className="p-3.5 bg-slate-800/50 border border-slate-700/50 rounded-2xl flex items-start gap-3 transition hover:bg-slate-800/80">
                <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-xl shrink-0 mt-0.5 border border-emerald-500/20">
                  <TrendingUp className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-slate-200">Real-Time Profit Margins</h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">Automated DIFF margin calculations across incoming university agreements and outgoing agent rates.</p>
                </div>
              </div>

              <div className="p-3.5 bg-slate-800/50 border border-slate-700/50 rounded-2xl flex items-start gap-3 transition hover:bg-slate-800/80">
                <div className="p-2 bg-indigo-500/10 text-indigo-400 rounded-xl shrink-0 mt-0.5 border border-indigo-500/20">
                  <Layers className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-slate-200">Multi-Aggregator Yield Analytics</h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">Compare yield performance for SI-UK, EDVOY, UAP, CRIZAC, and BASECHAN routes.</p>
                </div>
              </div>

              <div className="p-3.5 bg-slate-800/50 border border-slate-700/50 rounded-2xl flex items-start gap-3 transition hover:bg-slate-800/80">
                <div className="p-2 bg-amber-500/10 text-amber-400 rounded-xl shrink-0 mt-0.5 border border-amber-500/20">
                  <Lock className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-slate-200">Domain-Guarded Security</h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">Strict OAuth sign-in restricted exclusively to verified corporate accounts.</p>
                </div>
              </div>
            </div>
          </div>

          {/* Footer Badge */}
          <div className="pt-8 text-[11px] text-slate-500 flex items-center justify-between border-t border-slate-800/80">
            <span>Basechan International © 2026</span>
            <span className="flex items-center gap-1 text-emerald-400 font-mono text-[10px] font-bold">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              SYSTEM ONLINE
            </span>
          </div>
        </div>

        {/* RIGHT PANE: Authentication Glass Form */}
        <div className="lg:col-span-6 p-8 lg:p-12 flex flex-col justify-between space-y-8 bg-slate-900/90 backdrop-blur-md">
          <div className="space-y-6">
            {/* Form Title */}
            <div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-slate-800 border border-slate-700 text-amber-400 mb-3">
                <Building2 className="w-3 h-3" />
                <span>Authorized Access Only</span>
              </div>
              <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                Sign in to Basechan CMS
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Authenticate with your corporate Google account to access commission schedules.
              </p>
            </div>

            {/* Error Alert Box */}
            {error && (
              <div className="bg-rose-500/10 border border-rose-500/30 rounded-2xl p-4 flex items-start gap-3 text-rose-300 text-xs animate-in fade-in">
                <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-rose-400" />
                <div className="flex-1">
                  <p className="font-semibold text-rose-200">Authentication Denied</p>
                  <p className="text-xs text-rose-300/90 mt-0.5 leading-relaxed">{error}</p>
                </div>
                <button
                  onClick={clearError}
                  className="text-xs text-rose-400 hover:text-rose-200 font-bold cursor-pointer"
                >
                  ✕
                </button>
              </div>
            )}

            {/* Corporate Domain Callout Pill */}
            <div className="p-3.5 bg-slate-800/80 border border-slate-700/80 rounded-2xl flex items-center justify-between text-xs">
              <span className="text-slate-400 font-medium">Domain Guard:</span>
              <span className="font-mono text-emerald-400 font-bold bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800/60">
                @basechaninternational.com
              </span>
            </div>

            {/* Terms Acceptance Agreement Checkbox */}
            <div className="p-4 bg-slate-800/40 border border-slate-800 rounded-2xl space-y-2">
              <label className="flex items-start gap-3 cursor-pointer text-xs text-slate-300 select-none">
                <input
                  type="checkbox"
                  checked={acceptedTerms}
                  onChange={(e) => setAcceptedTerms(e.target.checked)}
                  className="mt-0.5 w-4 h-4 accent-emerald-500 rounded border-slate-600 focus:ring-2 focus:ring-emerald-500 cursor-pointer shrink-0"
                />
                <span className="leading-relaxed">
                  I agree to Basechan's{' '}
                  <button
                    type="button"
                    onClick={() => openLegalModal('terms')}
                    className="text-emerald-400 hover:underline font-semibold cursor-pointer"
                  >
                    Terms of Service
                  </button>{' '}
                  and{' '}
                  <button
                    type="button"
                    onClick={() => openLegalModal('privacy')}
                    className="text-emerald-400 hover:underline font-semibold cursor-pointer"
                  >
                    Privacy Policy
                  </button>
                  .
                </span>
              </label>
            </div>

            {/* High-Contrast Sign In Button */}
            <button
              onClick={signInWithGoogle}
              disabled={loading || !acceptedTerms}
              title={!acceptedTerms ? 'Please tick the agreement box to enable sign in' : 'Sign in with Google'}
              className="w-full flex items-center justify-center gap-3 bg-white hover:bg-slate-100 text-slate-900 font-extrabold py-4 px-5 rounded-2xl transition duration-200 shadow-xl hover:shadow-2xl hover:-translate-y-0.5 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:translate-y-0 cursor-pointer text-sm group"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-slate-900 border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  {/* Google G Logo SVG */}
                  <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                    />
                  </svg>
                  <span>Sign in with Google</span>
                  <ArrowRight className="w-4 h-4 ml-auto text-slate-400 group-hover:text-slate-900 group-hover:translate-x-1 transition-all" />
                </>
              )}
            </button>
          </div>

          {/* Form Footer */}
          <div className="flex items-center justify-between text-[11px] text-slate-500 font-medium pt-4 border-t border-slate-800">
            <span>Confidential System</span>
            <button
              onClick={() => openLegalModal('privacy')}
              className="hover:text-slate-300 transition cursor-pointer flex items-center gap-1 font-semibold text-slate-400"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>Trust & Privacy</span>
            </button>
          </div>
        </div>
      </div>

      {/* Legal & Privacy Center Modal */}
      <LegalModal
        isOpen={isLegalModalOpen}
        onClose={() => setIsLegalModalOpen(false)}
        initialTab={legalModalInitialTab}
      />
    </div>
  );
};
