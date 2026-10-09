import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import type { UserRole } from '../types';
import {
  X,
  HelpCircle,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  ShieldCheck,
  UserCheck,
  UserX,
  Layers3,
  Share2,
  DollarSign,
  Star,
  Pencil,
  Copy,
  BookOpen,
} from 'lucide-react';

interface UserTutorialModalProps {
  role: UserRole;
  isOpen: boolean;
  onClose: () => void;
}

interface TutorialStep {
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  content: string[];
  tips: string;
}

export const UserTutorialModal: React.FC<UserTutorialModalProps> = ({
  role,
  isOpen,
  onClose,
}) => {
  const [currentStep, setCurrentStep] = useState(0);

  if (!isOpen) return null;

  // Role-Specific Tutorial Steps
  const adminSteps: TutorialStep[] = [
    {
      title: 'Welcome to Basechan CMS Admin Control',
      subtitle: 'Full System Authority & Rate Management',
      icon: <ShieldCheck className="w-8 h-8 text-[#FBBF24]" />,
      content: [
        'Manage 2,800+ university commission rates, profit margins, and intake cycles in real time.',
        'Set school statuses: Green (Focus/Preferred), Standard (Allowed), or Red (Do Not Use).',
        'Directly override application portal routes (SI-UK, EDVOY, UAP, CRIZAC, BASECHAN) for any university row.',
      ],
      tips: 'Tip: Click any status pill or portal route dropdown on a card to change it instantly!',
    },
    {
      title: 'Bulk Updates & Multi-Select',
      subtitle: 'Mass Editing & Route Overrides',
      icon: <Pencil className="w-8 h-8 text-blue-500" />,
      content: [
        'Check any school card or click "Select All Filtered" to activate the Bulk Update Bar.',
        'Update school statuses, application portals, or commission rates for hundreds of records at once.',
        'Purge or batch edit rates without touching individual records.',
      ],
      tips: 'Tip: Use the "Bulk Route..." selector to assign 100 schools to SI-UK or EDVOY in 1 click.',
    },
    {
      title: 'Intake Cloning & Sheet Visibility',
      subtitle: 'Managing Academic Seasons & Access Control',
      icon: <Copy className="w-8 h-8 text-emerald-500" />,
      content: [
        'Use "Migrate / Clone Intake Sheet" to duplicate an entire intake (e.g. 2025 to 2026) in seconds.',
        'Use "Sheet Visibility Manager" to hide specific intakes (e.g. Jan 2026) from Staff or Agents.',
        'Hidden sheets are automatically filtered out from Staff and Agent total counts.',
      ],
      tips: 'Tip: You can hide a sheet from Agents while keeping it open for Staff counselors.',
    },
    {
      title: 'Activity History & User Management',
      subtitle: 'Audit Logs & Staff/Agent Onboarding',
      icon: <BookOpen className="w-8 h-8 text-[#FBBF24]" />,
      content: [
        'Open "Activity History" to inspect real-time delta logs of who modified rates and when.',
        'Manage registered users, assign roles (ADMIN, STAFF, AGENT), or revoke system access.',
        'Preview the system as STAFF or AGENT anytime using the FAB preview switcher.',
      ],
      tips: 'Tip: Use Ctrl + K to launch the Universal Command Palette anywhere in the app.',
    },
  ];

  const staffSteps: TutorialStep[] = [
    {
      title: 'Staff Application Guide',
      subtitle: 'Counselor Submission Routing Directory',
      icon: <UserCheck className="w-8 h-8 text-indigo-500" />,
      content: [
        'Instantly lookup which application portal (EDVOY, SI-UK, UAP, CRIZAC, Direct) to use for student applications.',
        'Filter by Focus Schools (In the Green) to prioritize preferred partner universities.',
        'View specific counselor instructions, study level requirements (UG/PG), and intake terms.',
      ],
      tips: 'Tip: Click the "Focus Schools" KPI card to show only preferred universities.',
    },
    {
      title: 'University Grouping & Watchlist',
      subtitle: 'Smart Name Aggregation & Favorites',
      icon: <Layers3 className="w-8 h-8 text-[#FBBF24]" />,
      content: [
        'Use "Group: University" to condense multiple routes for Leicester or Coventry into 1 school card.',
        'Tap "Compare All" on any university card to view all submission routes side-by-side.',
        'Tap the Star icon on any school to add it to your personal "Watchlist" for 1-click access.',
      ],
      tips: 'Tip: Click "Watchlist" in the top bar to filter your starred schools instantly.',
    },
    {
      title: 'Generating Shareable Rate Quotes',
      subtitle: '1-Click WhatsApp & PDF Export',
      icon: <Share2 className="w-8 h-8 text-emerald-500" />,
      content: [
        'Click the Share icon on any card or modal to open the Shareable Rate Card Generator.',
        'Tap "Copy WhatsApp Quote" to copy pre-formatted, clean text ready to send on WhatsApp or Email.',
        'Click "Print / Save PDF" to generate an official Basechan Letterhead document.',
      ],
      tips: 'Tip: PDF quotes format automatically into clean single-page letterheads when printing.',
    },
  ];

  const agentSteps: TutorialStep[] = [
    {
      title: 'Partner Agent Commission Portal',
      subtitle: 'Guaranteed Payout Directory',
      icon: <UserX className="w-8 h-8 text-emerald-500" />,
      content: [
        'Lookup guaranteed partner commission rates set by Basechan International across all partner universities.',
        'Search by university name, intake term, or country.',
        'Prioritize Focus Schools (In the Green) for maximum student placement success.',
      ],
      tips: 'Tip: All payout rates displayed in your portal are guaranteed for verified enrollments.',
    },
    {
      title: 'Multi-Currency Switcher',
      subtitle: 'Live Currency Conversion',
      icon: <DollarSign className="w-8 h-8 text-[#FBBF24]" />,
      content: [
        'Toggle between GBP (£), USD ($), EUR (€), and NGN (₦) in the control bar.',
        'Flat-fee commission rates automatically convert into your preferred currency using live rates.',
      ],
      tips: 'Tip: Tap NGN ₦ to view all flat-fee payouts converted into Nigerian Naira instantly.',
    },
    {
      title: 'Watchlist & Client Quotes',
      subtitle: 'Saving Institutions & Sharing Quotes',
      icon: <Star className="w-8 h-8 text-[#FBBF24]" />,
      content: [
        'Tap the Star icon on any institution to bookmark it to your Watchlist.',
        'Use the Share icon to copy a clean WhatsApp quote or download a white-label rate sheet for clients.',
      ],
      tips: 'Tip: Share cards for agents hide internal master rates automatically.',
    },
  ];

  const steps = role === 'ADMIN' ? adminSteps : role === 'STAFF' ? staffSteps : agentSteps;
  const current = steps[currentStep] || steps[0];

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep((prev) => prev + 1);
    } else {
      onClose();
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep((prev) => prev - 1);
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-hidden animate-backdrop-fade"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative my-auto max-w-lg w-full max-h-[85vh] bg-white dark:bg-[#0E1526] text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-[#222F43] rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-modal-pop z-[10000]"
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-[#222F43] flex items-center justify-between bg-slate-50/90 dark:bg-[#18181B]/90 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-amber-500/15 text-amber-500 rounded-xl border border-amber-400/30">
              <HelpCircle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm sm:text-base text-slate-900 dark:text-slate-100">
                System Guide & Onboarding
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Customized for <strong className="text-amber-500 uppercase">{role}</strong> role
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-200 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Step Body */}
        <div className="p-5 sm:p-6 space-y-4 overflow-y-auto flex-1 text-xs">
          {/* Step Icon & Header */}
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-[#18181B] border border-slate-200 dark:border-[#222F43] flex items-start gap-3.5">
            <div className="p-2.5 rounded-xl bg-white dark:bg-[#0E1526] border border-slate-200 dark:border-[#222F43] shrink-0">
              {current.icon}
            </div>
            <div className="space-y-0.5 min-w-0">
              <h2 className="font-extrabold text-sm sm:text-base text-slate-900 dark:text-slate-100 leading-tight">
                {current.title}
              </h2>
              <p className="text-xs text-indigo-600 dark:text-amber-400 font-semibold">
                {current.subtitle}
              </p>
            </div>
          </div>

          {/* Bullet Content */}
          <div className="space-y-2.5 pt-1">
            {current.content.map((point, idx) => (
              <div key={idx} className="flex items-start gap-2.5 text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                <span>{point}</span>
              </div>
            ))}
          </div>

          {/* Pro Tip Box */}
          <div className="p-3.5 bg-amber-500/10 border border-amber-400/30 text-amber-800 dark:text-amber-300 rounded-2xl text-xs font-semibold">
            {current.tips}
          </div>
        </div>

        {/* Step Indicator & Footer Navigation */}
        <div className="p-4 bg-slate-50/90 dark:bg-[#18181B]/90 border-t border-slate-100 dark:border-[#222F43] flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 shrink-0">
          <button
            onClick={handlePrev}
            disabled={currentStep === 0}
            className="px-3.5 py-2 bg-white dark:bg-[#0E1526] border border-slate-200 dark:border-[#222F43] rounded-xl font-bold hover:bg-slate-100 dark:hover:bg-slate-800 transition disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer flex items-center gap-1.5 text-slate-800 dark:text-slate-200"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>Back</span>
          </button>

          <span className="font-mono font-extrabold text-slate-700 dark:text-slate-200 text-xs">
            Step {currentStep + 1} of {steps.length}
          </span>

          <button
            onClick={handleNext}
            className="px-4 py-2 bg-blue-600 dark:bg-amber-400 text-white dark:text-slate-950 font-extrabold rounded-xl shadow-xs hover:bg-blue-700 dark:hover:bg-amber-500 transition cursor-pointer flex items-center gap-1.5"
          >
            <span>{currentStep === steps.length - 1 ? 'Start Using App' : 'Next'}</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};
