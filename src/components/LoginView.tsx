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
  CheckCircle2,
  Check,
  Mail,
} from 'lucide-react';

export const LoginView: React.FC = () => {
  const { signInWithGoogle, signInWithEmail, signUpWithEmail, sendPasswordReset, error, loading, clearError } = useAuth();
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleEmailSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (authMode === 'signup') void signUpWithEmail(name, email, password);
    else void signInWithEmail(email, password);
  };

  // Mandatory Terms Gateway Acceptance State
  const [hasAcceptedGateway, setHasAcceptedGateway] = useState<boolean>(() => {
    return localStorage.getItem('basechan_terms_accepted_v1') === 'true';
  });

  // Checkbox inside the Gateway Modal
  const [gatewayCheckbox, setGatewayCheckbox] = useState<boolean>(false);

  // Legal Modal view state
  const [isLegalModalOpen, setIsLegalModalOpen] = useState<boolean>(false);
  const [legalModalInitialTab, setLegalModalInitialTab] = useState<'privacy' | 'terms'>('terms');

  const openLegalModal = (tab: 'privacy' | 'terms') => {
    setLegalModalInitialTab(tab);
    setIsLegalModalOpen(true);
  };

  const handleAcceptGateway = () => {
    localStorage.setItem('basechan_terms_accepted_v1', 'true');
    setHasAcceptedGateway(true);
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

        {/* LEFT PANE: Brand Showcase & Value Propositions */}
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

            {/* Headline */}
            <div className="space-y-2 pt-4">
              <h1 className="text-2xl sm:text-3xl font-extrabold text-white leading-snug tracking-tight">
                Commission Rates & Profit Margins
              </h1>
              <p className="text-xs sm:text-sm text-slate-400 leading-relaxed font-normal">
                Compare university commission rates against agent payouts to see your profit margins for each school and platform.
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
                  <p className="text-[11px] text-slate-400 mt-0.5">Automated margin calculations across incoming university agreements and outgoing agent rates.</p>
                </div>
              </div>

              <div className="p-3.5 bg-slate-800/50 border border-slate-700/50 rounded-2xl flex items-start gap-3 transition hover:bg-slate-800/80">
                <div className="p-2 bg-indigo-500/10 text-indigo-400 rounded-xl shrink-0 mt-0.5 border border-indigo-500/20">
                  <Layers className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-slate-200">Multi-Aggregator Yield Analytics</h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">Compare yield performance across SI-UK, EDVOY, UAP, CRIZAC, and BASECHAN routes.</p>
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="pt-8 text-[11px] text-slate-500 border-t border-slate-800/80">
            <span>Basechan International © 2026</span>
          </div>
        </div>

        {/* RIGHT PANE: Authentication Form */}
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
                Sign in with your authorized account to access commission schedules.
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

            {/* Terms Accepted Badge Indicator */}
            <div className="p-3 bg-emerald-950/40 border border-emerald-800/60 rounded-2xl flex items-center justify-between text-xs text-emerald-300">
              <span className="flex items-center gap-2 font-medium">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Terms & Privacy Conditions Accepted</span>
              </span>
              <button
                type="button"
                onClick={() => setHasAcceptedGateway(false)}
                className="text-[10px] text-slate-400 hover:text-slate-200 underline cursor-pointer"
              >
                Re-read
              </button>
            </div>

            <form className="space-y-3" onSubmit={handleEmailSubmit}>
              {authMode === 'signup' && (
                <label className="block space-y-1.5 text-xs font-semibold text-slate-300">
                  Name
                  <input
                    type="text"
                    autoComplete="name"
                    required
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white outline-none focus:border-amber-400"
                    placeholder="Your full name"
                  />
                </label>
              )}
              <label className="block space-y-1.5 text-xs font-semibold text-slate-300">
                Email address
                <input
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white outline-none focus:border-amber-400"
                  placeholder="you@company.com"
                />
              </label>
              <label className="block space-y-1.5 text-xs font-semibold text-slate-300">
                Password
                <input
                  type="password"
                  autoComplete={authMode === 'signup' ? 'new-password' : 'current-password'}
                  required
                  minLength={6}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white outline-none focus:border-amber-400"
                  placeholder="At least 6 characters"
                />
              </label>
              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 rounded-2xl bg-amber-500 px-5 py-3.5 text-sm font-extrabold text-slate-950 transition hover:bg-amber-400 disabled:opacity-40 cursor-pointer"
              >
                <Mail className="w-4 h-4" />
                {authMode === 'signin' ? 'Sign in with email' : 'Create account'}
              </button>
              <div className="flex items-center justify-between text-xs text-slate-400">
                <button type="button" onClick={() => { setAuthMode(authMode === 'signin' ? 'signup' : 'signin'); clearError(); }} className="hover:text-amber-300 underline cursor-pointer">
                  {authMode === 'signin' ? 'Create an account' : 'Already have an account? Sign in'}
                </button>
                {authMode === 'signin' && (
                  <button type="button" disabled={!email || loading} onClick={() => void sendPasswordReset(email)} className="hover:text-amber-300 underline disabled:opacity-40 cursor-pointer">
                    Forgot password?
                  </button>
                )}
              </div>
            </form>

            <div className="flex items-center gap-3 text-[10px] uppercase tracking-wider text-slate-500"><span className="h-px flex-1 bg-slate-800" />or<span className="h-px flex-1 bg-slate-800" /></div>

            {/* Google Sign In */}
            <button
              onClick={signInWithGoogle}
              disabled={loading}
              title="Sign in with Google"
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
          <div className="flex items-center justify-end text-[11px] text-slate-500 font-medium pt-4 border-t border-slate-800">
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

      {/* MANDATORY UN-BYPASSABLE TERMS & CONDITIONS GATEWAY OVERLAY */}
      {!hasAcceptedGateway && (
        <div className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-xl flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl max-w-xl w-full p-6 sm:p-8 space-y-6 animate-in zoom-in-95 fade-in duration-200 my-auto">
            {/* Modal Header */}
            <div className="flex items-start gap-4">
              <div className="p-3 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-2xl shrink-0">
                <ShieldCheck className="w-7 h-7" />
              </div>
              <div className="space-y-1">
                <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                  Corporate Terms & Privacy Gateway
                </h2>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Before accessing the Basechan Commission Management System, you must review and accept our corporate terms of service and data protection agreement.
                </p>
              </div>
            </div>

            {/* Scrollable Summary Conditions Container */}
            <div className="max-h-64 sm:max-h-72 overflow-y-auto p-4 bg-slate-950/80 border border-slate-800 rounded-2xl text-xs space-y-3.5 text-slate-300">
              <div className="space-y-1">
                <h3 className="font-bold text-white flex items-center gap-1.5">
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  1. Authorized Corporate Personnel
                </h3>
                <p className="text-slate-400 text-[11px] leading-relaxed">
                  System access is strictly restricted to authorized Basechan International staff and verified partner agency representatives.
                </p>
              </div>

              <div className="space-y-1">
                <h3 className="font-bold text-white flex items-center gap-1.5">
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  2. Strict Confidentiality & Non-Disclosure
                </h3>
                <p className="text-slate-400 text-[11px] leading-relaxed">
                  All university commission structures, aggregator agreement rates, and student deal margins contained herein are proprietary and trade secrets.
                </p>
              </div>

              <div className="space-y-1">
                <h3 className="font-bold text-white flex items-center gap-1.5">
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  3. Acceptable Usage & Data Integrity
                </h3>
                <p className="text-slate-400 text-[11px] leading-relaxed">
                  Scraping, unauthorized exporting, or sharing rate schedules with third-party competitors will result in immediate account termination.
                </p>
              </div>

              <div className="space-y-1">
                <h3 className="font-bold text-white flex items-center gap-1.5">
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  4. Security Logging & Compliance
                </h3>
                <p className="text-slate-400 text-[11px] leading-relaxed">
                  Session activity, IP locations, and rate modifications are continuously audited under GDPR and NDPR guidelines.
                </p>
              </div>
            </div>

            {/* Direct Links to Full Legal Documents */}
            <div className="flex items-center justify-between text-xs text-slate-400 pt-1">
              <span>Inspect complete agreements:</span>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => openLegalModal('terms')}
                  className="text-amber-400 hover:underline font-semibold cursor-pointer"
                >
                  Full Terms
                </button>
                <span>•</span>
                <button
                  type="button"
                  onClick={() => openLegalModal('privacy')}
                  className="text-amber-400 hover:underline font-semibold cursor-pointer"
                >
                  Privacy Policy
                </button>
              </div>
            </div>

            {/* Acceptance Checkbox */}
            <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-2xl">
              <label className="flex items-start gap-3 cursor-pointer text-xs text-slate-200 select-none">
                <input
                  type="checkbox"
                  checked={gatewayCheckbox}
                  onChange={(e) => setGatewayCheckbox(e.target.checked)}
                  className="mt-0.5 w-4 h-4 accent-amber-500 rounded border-slate-700 cursor-pointer shrink-0"
                />
                <span className="leading-relaxed">
                  I have read, understand, and agree to the <strong>Terms of Service</strong>, <strong>Privacy Policy</strong>, and <strong>Data Processing Addendum</strong>.
                </span>
              </label>
            </div>

            {/* Action Buttons */}
            <div className="space-y-2">
              <button
                type="button"
                onClick={handleAcceptGateway}
                disabled={!gatewayCheckbox}
                className="w-full py-3.5 px-5 bg-amber-500 hover:bg-amber-600 disabled:opacity-40 disabled:cursor-not-allowed text-slate-950 font-extrabold text-sm rounded-2xl shadow-xl transition flex items-center justify-center gap-2 cursor-pointer active:scale-98"
              >
                <CheckCircle2 className="w-5 h-5" />
                <span>Accept Terms & Access Login</span>
              </button>

              <p className="text-[10px] text-center text-slate-500">
                You cannot access the application login form until you accept these terms.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Legal & Privacy Center Modal */}
      <LegalModal
        isOpen={isLegalModalOpen}
        onClose={() => setIsLegalModalOpen(false)}
        initialTab={legalModalInitialTab}
      />
    </div>
  );
};
