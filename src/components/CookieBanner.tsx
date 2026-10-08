import React, { useState, useEffect } from 'react';
import { ShieldCheck, Cookie } from 'lucide-react';

export interface CookieConsent {
  essential: boolean;
  analytics: boolean;
  decidedAt: string;
}

const STORAGE_KEY = 'basechan_cookie_consent';

export const CookieBanner: React.FC = () => {
  const [isVisible, setIsVisible] = useState<boolean>(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (!saved) {
        setIsVisible(true);
      }
    } catch (e) {
      console.error('Failed to read cookie consent state:', e);
      setIsVisible(true);
    }
  }, []);

  const handleAcceptAll = () => {
    const consent: CookieConsent = {
      essential: true,
      analytics: true,
      decidedAt: new Date().toISOString(),
    };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(consent));
    } catch (e) {
      console.error('Failed to save cookie consent:', e);
    }
    setIsVisible(false);
  };

  const handleRejectNonEssential = () => {
    const consent: CookieConsent = {
      essential: true,
      analytics: false,
      decidedAt: new Date().toISOString(),
    };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(consent));
    } catch (e) {
      console.error('Failed to save cookie consent:', e);
    }
    setIsVisible(false);
  };

  if (!isVisible) return null;

  return (
    <div className="fixed bottom-0 inset-x-0 z-50 p-4 sm:p-6 bg-slate-900/95 dark:bg-slate-950/95 backdrop-blur-md border-t border-slate-800 text-white shadow-2xl animate-in slide-in-from-bottom-5 duration-300">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-start gap-3 max-w-3xl">
          <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl shrink-0 mt-0.5">
            <Cookie className="w-5 h-5" />
          </div>
          <div className="space-y-1">
            <h3 className="text-sm font-bold flex items-center gap-2 text-white">
              <span>Privacy & Cookie Preferences</span>
              <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-mono px-2 py-0.5 rounded-full uppercase">
                GDPR & CCPA Compliant
              </span>
            </h3>
            <p className="text-xs text-slate-300 leading-relaxed">
              We use essential cookies and local storage to keep you authenticated and store your theme preferences. We do not use third-party tracking or advertising cookies.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto justify-end">
          <button
            onClick={handleRejectNonEssential}
            className="flex-1 md:flex-initial px-4 py-2 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl transition cursor-pointer"
          >
            Reject Non-Essential
          </button>

          <button
            onClick={handleAcceptAll}
            className="flex-1 md:flex-initial px-5 py-2 text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl shadow-md transition cursor-pointer flex items-center justify-center gap-1.5"
          >
            <ShieldCheck className="w-4 h-4" />
            <span>Accept All</span>
          </button>
        </div>
      </div>
    </div>
  );
};
