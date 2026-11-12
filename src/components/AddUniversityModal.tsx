import React, { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Check,
  AlertTriangle,
  Loader2,
  Plus,
  Star,
  Layers,
} from 'lucide-react';
import type { CommissionRate, SchoolGuidance } from '../types';
import { generateCompositeId, normalizeUniversitySlug } from '../utils/idGenerator';
import { AddIntakeModal } from './AddIntakeModal';

export interface AddUniversityModalProps {
  isOpen: boolean;
  onClose: () => void;
  existingRates: CommissionRate[];
  defaultIntake?: string;
  availableIntakes?: string[];
  onAddNewIntake?: (newIntake: string) => Promise<void> | void;
  onUniversityAdded: (rates: CommissionRate[]) => Promise<void> | void;
}

interface RouteSetting {
  intake: string;
  commissionType: 'Percentage' | 'Fixed Fee';
  ugRate: string;
  pgRate: string;
}

const AGGREGATOR_ROUTES = [
  { key: 'BASECHAN', name: 'BASECHAN (Direct Master)', isDirect: true },
  { key: 'EDVOY', name: 'EDVOY', isDirect: false },
  { key: 'SI-UK', name: 'SI-UK', isDirect: false },
  { key: 'UAP', name: 'UAP', isDirect: false },
  { key: 'CRIZAC', name: 'CRIZAC', isDirect: false },
  { key: 'KC OVERSEAS', name: 'KC OVERSEAS', isDirect: false },
  { key: 'AIMS EDUCATION', name: 'AIMS EDUCATION', isDirect: false },
];

export const AddUniversityModal: React.FC<AddUniversityModalProps> = ({
  isOpen,
  onClose,
  existingRates,
  defaultIntake = 'Sept 2026',
  availableIntakes = [],
  onAddNewIntake,
  onUniversityAdded,
}) => {
  const [universityName, setUniversityName] = useState('');
  const [country, setCountry] = useState('United Kingdom');
  const [baselineIntake, setBaselineIntake] = useState(defaultIntake);
  const [globalCommissionType, setGlobalCommissionType] = useState<'Percentage' | 'Fixed Fee'>('Percentage');
  const [guidance, setGuidance] = useState<SchoolGuidance>('ALLOWED');
  const [defaultRoute, setDefaultRoute] = useState('BASECHAN');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Modal for adding a new intake
  const [isAddIntakeOpen, setIsAddIntakeOpen] = useState(false);
  const [activeRouteForIntake, setActiveRouteForIntake] = useState<string | null>(null);

  // Sub-agent payouts (Basechan Agent rates)
  const [agentFD, setAgentFD] = useState('');
  const [agentUG, setAgentUG] = useState('');
  const [agentPG, setAgentPG] = useState('');

  // Per-route independent settings (Intake, Commission Type, UG & PG rates)
  const [routes, setRoutes] = useState<Record<string, RouteSetting>>(() => {
    const initial: Record<string, RouteSetting> = {};
    AGGREGATOR_ROUTES.forEach((r) => {
      initial[r.key] = {
        intake: defaultIntake,
        commissionType: 'Percentage',
        ugRate: '',
        pgRate: '',
      };
    });
    return initial;
  });

  // Calculate all known intakes
  const allKnownIntakes = useMemo(() => {
    const set = new Set<string>(availableIntakes);
    if (defaultIntake) set.add(defaultIntake);
    if (baselineIntake) set.add(baselineIntake);
    existingRates.forEach((r) => {
      if (r.intake) set.add(r.intake);
    });
    Object.values(routes).forEach((r) => {
      if (r.intake) set.add(r.intake);
    });
    return Array.from(set).filter(Boolean).sort();
  }, [availableIntakes, defaultIntake, baselineIntake, existingRates, routes]);

  // Bulk apply intake to all routes
  const handleBulkApplyIntake = (intakeVal: string) => {
    setBaselineIntake(intakeVal);
    setRoutes((prev) => {
      const next: Record<string, RouteSetting> = {};
      AGGREGATOR_ROUTES.forEach((r) => {
        next[r.key] = {
          ...(prev[r.key] || { commissionType: 'Percentage', ugRate: '', pgRate: '' }),
          intake: intakeVal,
        };
      });
      return next;
    });
  };

  // Bulk apply commission type to all routes
  const handleBulkApplyCommissionType = (typeVal: 'Percentage' | 'Fixed Fee') => {
    setGlobalCommissionType(typeVal);
    setRoutes((prev) => {
      const next: Record<string, RouteSetting> = {};
      AGGREGATOR_ROUTES.forEach((r) => {
        next[r.key] = {
          ...(prev[r.key] || { intake: baselineIntake, ugRate: '', pgRate: '' }),
          commissionType: typeVal,
        };
      });
      return next;
    });
  };

  // Update a single route's fields
  const handleRouteChange = (key: string, field: keyof RouteSetting, value: string) => {
    setRoutes((prev) => ({
      ...prev,
      [key]: {
        ...(prev[key] || { intake: baselineIntake, commissionType: globalCommissionType, ugRate: '', pgRate: '' }),
        [field]: value,
      },
    }));
  };

  // Add new intake handler
  const handleCreateNewIntake = async (newIntake: string) => {
    if (onAddNewIntake) {
      await onAddNewIntake(newIntake);
    }
    if (activeRouteForIntake) {
      handleRouteChange(activeRouteForIntake, 'intake', newIntake);
    } else {
      handleBulkApplyIntake(newIntake);
    }
    setIsAddIntakeOpen(false);
    setActiveRouteForIntake(null);
  };

  // Duplicate detection for baseline intake
  const isDuplicateName = useMemo(() => {
    if (!universityName.trim()) return false;
    const clean = universityName.trim().toLowerCase();
    const cleanIntake = baselineIntake.trim().toLowerCase();
    return existingRates.some(
      (r) =>
        r.universityName.trim().toLowerCase() === clean &&
        r.intake.trim().toLowerCase() === cleanIntake
    );
  }, [universityName, baselineIntake, existingRates]);

  if (!isOpen) return null;

  const parseNumber = (val: string): number => {
    if (!val || val === '-' || val === '–') return 0;
    const clean = val.replace(/[^0-9.]/g, '');
    const num = parseFloat(clean);
    return Number.isNaN(num) ? 0 : num;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmedName = universityName.trim();
    if (!trimmedName) {
      setError('University Name is required.');
      return;
    }
    const trimmedCountry = country.trim() || 'United Kingdom';
    const uniId = normalizeUniversitySlug(trimmedName);
    const now = new Date().toISOString();

    const createdRates: CommissionRate[] = [];

    const agentFdNum = parseNumber(agentFD);
    const agentUgNum = parseNumber(agentUG);
    const agentPgNum = parseNumber(agentPG);

    // 1. Process Basechan Direct
    const basechanRoute = routes['BASECHAN'] || {
      intake: baselineIntake,
      commissionType: globalCommissionType,
      ugRate: '',
      pgRate: '',
    };
    const basechanIntake = basechanRoute.intake || baselineIntake;
    const basechanIsFlat = basechanRoute.commissionType === 'Fixed Fee';
    const basechanUgMaster = parseNumber(basechanRoute.ugRate);
    const basechanPgMaster = parseNumber(basechanRoute.pgRate);
    const isBasechanDefault = defaultRoute.toUpperCase() === 'BASECHAN';

    // Basechan FD
    if (agentFdNum > 0) {
      createdRates.push({
        id: generateCompositeId(trimmedName, basechanIntake, 'BASECHAN', 'FD'),
        universityId: uniId,
        universityName: trimmedName,
        country: trimmedCountry,
        intake: basechanIntake,
        aggregator: 'BASECHAN',
        studyLevel: 'FD',
        agentRate: agentFdNum,
        masterRate: agentFdNum,
        diffMargin: 0,
        isFlatFee: basechanIsFlat,
        netOrGross: 'GROSS',
        guidance,
        isDefaultRoute: isBasechanDefault,
        updatedAt: now,
      });
    }

    // Basechan UG
    if (agentUgNum > 0 || basechanUgMaster > 0) {
      const masterVal = basechanUgMaster > 0 ? basechanUgMaster : agentUgNum;
      createdRates.push({
        id: generateCompositeId(trimmedName, basechanIntake, 'BASECHAN', 'UG'),
        universityId: uniId,
        universityName: trimmedName,
        country: trimmedCountry,
        intake: basechanIntake,
        aggregator: 'BASECHAN',
        studyLevel: 'UG',
        agentRate: agentUgNum,
        masterRate: masterVal,
        diffMargin: Number((masterVal - agentUgNum).toFixed(2)),
        isFlatFee: basechanIsFlat,
        netOrGross: 'GROSS',
        guidance,
        isDefaultRoute: isBasechanDefault,
        updatedAt: now,
      });
    }

    // Basechan PG
    if (agentPgNum > 0 || basechanPgMaster > 0) {
      const masterVal = basechanPgMaster > 0 ? basechanPgMaster : agentPgNum;
      createdRates.push({
        id: generateCompositeId(trimmedName, basechanIntake, 'BASECHAN', 'PG'),
        universityId: uniId,
        universityName: trimmedName,
        country: trimmedCountry,
        intake: basechanIntake,
        aggregator: 'BASECHAN',
        studyLevel: 'PG',
        agentRate: agentPgNum,
        masterRate: masterVal,
        diffMargin: Number((masterVal - agentPgNum).toFixed(2)),
        isFlatFee: basechanIsFlat,
        netOrGross: 'GROSS',
        guidance,
        isDefaultRoute: isBasechanDefault,
        updatedAt: now,
      });
    }

    // 2. Process Third-Party Aggregators
    AGGREGATOR_ROUTES.filter((r) => !r.isDirect).forEach((r) => {
      const route = routes[r.key] || {
        intake: baselineIntake,
        commissionType: globalCommissionType,
        ugRate: '',
        pgRate: '',
      };
      const routeIntake = route.intake || baselineIntake;
      const isFlat = route.commissionType === 'Fixed Fee';
      const isRouteDefault = defaultRoute.toUpperCase() === r.key.toUpperCase();

      const ugIncoming = parseNumber(route.ugRate);
      if (ugIncoming > 0) {
        createdRates.push({
          id: generateCompositeId(trimmedName, routeIntake, r.key, 'UG'),
          universityId: uniId,
          universityName: trimmedName,
          country: trimmedCountry,
          intake: routeIntake,
          aggregator: r.key,
          studyLevel: 'UG',
          agentRate: agentUgNum,
          masterRate: ugIncoming,
          diffMargin: Number((ugIncoming - agentUgNum).toFixed(2)),
          isFlatFee: isFlat,
          netOrGross: 'GROSS',
          guidance,
          isDefaultRoute: isRouteDefault,
          updatedAt: now,
        });
      }

      const pgIncoming = parseNumber(route.pgRate);
      if (pgIncoming > 0) {
        createdRates.push({
          id: generateCompositeId(trimmedName, routeIntake, r.key, 'PG'),
          universityId: uniId,
          universityName: trimmedName,
          country: trimmedCountry,
          intake: routeIntake,
          aggregator: r.key,
          studyLevel: 'PG',
          agentRate: agentPgNum,
          masterRate: pgIncoming,
          diffMargin: Number((pgIncoming - agentPgNum).toFixed(2)),
          isFlatFee: isFlat,
          netOrGross: 'GROSS',
          guidance,
          isDefaultRoute: isRouteDefault,
          updatedAt: now,
        });
      }
    });

    if (createdRates.length === 0) {
      setError('Please enter at least one commission rate (Agent or Aggregator).');
      return;
    }

    try {
      setSaving(true);
      await onUniversityAdded(createdRates);
      onClose();
    } catch (err: unknown) {
      console.error('Error saving new university:', err);
      setError(err instanceof Error ? err.message : 'Failed to save university');
    } finally {
      setSaving(false);
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-backdrop-fade"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative my-auto max-w-4xl w-full bg-white dark:bg-[#0E1526] text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-[#222F43] rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Modal Header */}
        <div className="p-5 sm:p-6 border-b border-slate-200 dark:border-[#222F43] bg-slate-50/90 dark:bg-[#18181B]/90 flex items-start justify-between shrink-0">
          <div>
            <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-slate-100 leading-tight">
              Add New University
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Create a university and configure independent intake and commission types for its application routes.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-slate-800/60 transition cursor-pointer"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-6 overflow-y-auto flex-1 text-xs">
          {error && (
            <div className="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-500 dark:text-rose-400 text-xs font-semibold flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {isDuplicateName && (
            <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-300 text-xs font-semibold flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>A university with this name already exists in this intake. Adding will create additional routes.</span>
            </div>
          )}

          {/* Section: Institution Core Info */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            <div>
              <label htmlFor="uni-name-input" className="block text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                University Name *
              </label>
              <input
                id="uni-name-input"
                aria-label="University Name"
                type="text"
                required
                value={universityName}
                onChange={(e) => setUniversityName(e.target.value)}
                placeholder="e.g. Oxford Brookes University"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-[#131B2E] border border-slate-300 dark:border-[#222F43] text-slate-900 dark:text-white text-xs font-semibold focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition"
              />
            </div>

            <div>
              <label htmlFor="country-input" className="block text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                Country *
              </label>
              <input
                id="country-input"
                aria-label="Country"
                type="text"
                required
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                placeholder="e.g. United Kingdom, Canada, USA"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-[#131B2E] border border-slate-300 dark:border-[#222F43] text-slate-900 dark:text-white text-xs font-semibold focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition"
              />
            </div>

            <div>
              <label htmlFor="guidance-select" className="block text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                School Guidance
              </label>
              <select
                id="guidance-select"
                aria-label="School Guidance"
                value={guidance}
                onChange={(e) => setGuidance(e.target.value as SchoolGuidance)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-[#131B2E] border border-slate-300 dark:border-[#222F43] text-slate-900 dark:text-white text-xs font-semibold focus:outline-none focus:border-indigo-500 cursor-pointer"
              >
                <option value="ALLOWED">🔵 Allowed (Standard)</option>
                <option value="FOCUS">🟢 Focus (Preferred)</option>
                <option value="DO_NOT_USE">🔴 Do Not Use</option>
              </select>
            </div>
          </div>

          {/* Section: Bulk Setting Defaults */}
          <div className="p-3.5 bg-slate-50 dark:bg-[#18181B] border border-slate-200 dark:border-[#222F43] rounded-2xl space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-200 dark:border-[#222F43] pb-2 gap-1">
              <span className="font-extrabold text-xs text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-blue-500" />
                <span>Bulk Controls & Default Route</span>
              </span>
              <span className="text-[10px] text-slate-500">
                Quickly set all intakes or commission types together, or customize per route below.
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              {/* Baseline Intake Dropdown */}
              <div className="p-2.5 rounded-xl bg-white dark:bg-[#0E1526] border border-slate-200 dark:border-slate-800 flex flex-col justify-between">
                <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">
                  Set All Intakes:
                </span>
                <div className="flex items-center gap-1.5">
                  <select
                    id="baseline-intake-select"
                    aria-label="Baseline Intake"
                    value={baselineIntake}
                    onChange={(e) => handleBulkApplyIntake(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 font-bold text-xs"
                  >
                    {allKnownIntakes.map((i) => (
                      <option key={i} value={i}>
                        {i}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveRouteForIntake(null);
                      setIsAddIntakeOpen(true);
                    }}
                    className="p-1.5 bg-blue-600 hover:bg-blue-500 text-white font-extrabold rounded-lg text-xs flex items-center gap-0.5 cursor-pointer shrink-0"
                    title="Add new intake option"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Bulk Commission Type Dropdown */}
              <div className="p-2.5 rounded-xl bg-white dark:bg-[#0E1526] border border-slate-200 dark:border-slate-800 flex flex-col justify-between">
                <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">
                  Set All Commission Types:
                </span>
                <select
                  id="comm-type-select"
                  aria-label="Commission Type"
                  value={globalCommissionType}
                  onChange={(e) => handleBulkApplyCommissionType(e.target.value as 'Percentage' | 'Fixed Fee')}
                  className="w-full px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 font-bold text-xs"
                >
                  <option value="Percentage">Percentage (%)</option>
                  <option value="Fixed Fee">Fixed Fee (£)</option>
                </select>
              </div>

              {/* Default Route for Staff */}
              <div className="p-2.5 rounded-xl bg-white dark:bg-[#0E1526] border border-slate-200 dark:border-slate-800 flex flex-col justify-between">
                <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">
                  Default Route for Staff:
                </span>
                <select
                  id="default-route-select"
                  aria-label="Default Route for Staff"
                  value={defaultRoute}
                  onChange={(e) => setDefaultRoute(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 font-bold text-xs"
                >
                  <option value="BASECHAN">BASECHAN / Direct</option>
                  <option value="EDVOY">EDVOY</option>
                  <option value="SI-UK">SI-UK</option>
                  <option value="UAP">UAP</option>
                  <option value="CRIZAC">CRIZAC</option>
                  <option value="KC OVERSEAS">KC OVERSEAS</option>
                  <option value="AIMS EDUCATION">AIMS EDUCATION</option>
                </select>
              </div>
            </div>
          </div>

          {/* Section: Sub-Agent Payout Rates */}
          <div className="p-3.5 bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-500/20 rounded-2xl space-y-2">
            <span className="font-extrabold text-xs text-emerald-800 dark:text-emerald-300 uppercase tracking-wider block">
              Basechan Sub-Agent Payout Rates (Outgoing Payouts)
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs font-mono">
              <div className="p-2 bg-white dark:bg-[#0E1526] rounded-xl flex items-center justify-between border border-emerald-500/20">
                <label htmlFor="agent-fd-input" className="text-slate-500 dark:text-slate-400 font-sans font-semibold">
                  Agent (FD):
                </label>
                <input
                  id="agent-fd-input"
                  aria-label="Agent Rate (FD)"
                  type="text"
                  value={agentFD}
                  onChange={(e) => setAgentFD(e.target.value)}
                  placeholder="e.g. 8"
                  className="w-24 text-right font-mono font-bold text-xs p-1 rounded border border-emerald-500/40 bg-white dark:bg-[#0E1526] text-emerald-600 dark:text-emerald-400 focus:outline-none"
                />
              </div>
              <div className="p-2 bg-white dark:bg-[#0E1526] rounded-xl flex items-center justify-between border border-emerald-500/20">
                <label htmlFor="agent-ug-input" className="text-slate-500 dark:text-slate-400 font-sans font-semibold">
                  Agent (UG):
                </label>
                <input
                  id="agent-ug-input"
                  aria-label="Agent Rate (UG)"
                  type="text"
                  value={agentUG}
                  onChange={(e) => setAgentUG(e.target.value)}
                  placeholder="e.g. 10"
                  className="w-24 text-right font-mono font-bold text-xs p-1 rounded border border-emerald-500/40 bg-white dark:bg-[#0E1526] text-emerald-600 dark:text-emerald-400 focus:outline-none"
                />
              </div>
              <div className="p-2 bg-white dark:bg-[#0E1526] rounded-xl flex items-center justify-between border border-emerald-500/20">
                <label htmlFor="agent-pg-input" className="text-slate-500 dark:text-slate-400 font-sans font-semibold">
                  Agent (PG):
                </label>
                <input
                  id="agent-pg-input"
                  aria-label="Agent Rate (PG)"
                  type="text"
                  value={agentPG}
                  onChange={(e) => setAgentPG(e.target.value)}
                  placeholder="e.g. 12"
                  className="w-24 text-right font-mono font-bold text-xs p-1 rounded border border-emerald-500/40 bg-white dark:bg-[#0E1526] text-emerald-600 dark:text-emerald-400 focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Section: Per-Route Independent Specification Table */}
          <div className="space-y-2 pt-1">
            <span className="font-extrabold text-xs text-slate-800 dark:text-slate-200 uppercase tracking-wider block">
              Per-Route Independent Settings (Intake, Commission Type & Rates)
            </span>
            <div className="border border-slate-200 dark:border-[#222F43] rounded-2xl overflow-hidden divide-y divide-slate-200 dark:divide-[#222F43]">
              {AGGREGATOR_ROUTES.map((route) => {
                const setting = routes[route.key] || {
                  intake: baselineIntake,
                  commissionType: globalCommissionType,
                  ugRate: '',
                  pgRate: '',
                };

                return (
                  <div
                    key={route.key}
                    className="p-3 bg-white dark:bg-[#0E1526] flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs"
                  >
                    <div className="flex items-center gap-2 min-w-[160px]">
                      <span className="font-extrabold text-slate-800 dark:text-slate-200">
                        {route.name}
                      </span>
                      {defaultRoute === route.key && (
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase bg-amber-500/20 text-amber-500 flex items-center gap-0.5">
                          <Star className="w-2.5 h-2.5 fill-amber-500" />
                          Default
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-2.5">
                      {/* Route Intake Dropdown */}
                      <div className="flex items-center gap-1 bg-slate-50 dark:bg-[#18181B] p-1 rounded-xl border border-slate-200 dark:border-slate-800">
                        <span className="text-[10px] font-bold text-slate-400 px-1">Intake:</span>
                        <select
                          aria-label={`${route.key} Intake`}
                          value={setting.intake}
                          onChange={(e) => handleRouteChange(route.key, 'intake', e.target.value)}
                          className="px-2 py-0.5 rounded-lg bg-white dark:bg-[#0E1526] border border-slate-300 dark:border-slate-700 font-bold text-xs"
                        >
                          {allKnownIntakes.map((i) => (
                            <option key={i} value={i}>
                              {i}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={() => {
                            setActiveRouteForIntake(route.key);
                            setIsAddIntakeOpen(true);
                          }}
                          className="p-1 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-950/60 rounded-md transition"
                          title="Add intake"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>

                      {/* Route Commission Type */}
                      <div className="flex items-center gap-1 bg-slate-50 dark:bg-[#18181B] p-1 rounded-xl border border-slate-200 dark:border-slate-800">
                        <select
                          aria-label={`${route.key} Commission Type`}
                          value={setting.commissionType}
                          onChange={(e) =>
                            handleRouteChange(route.key, 'commissionType', e.target.value as 'Percentage' | 'Fixed Fee')
                          }
                          className="px-2 py-0.5 rounded-lg bg-white dark:bg-[#0E1526] border border-slate-300 dark:border-slate-700 font-bold text-xs"
                        >
                          <option value="Percentage">% Percentage</option>
                          <option value="Fixed Fee">£ Fixed Fee</option>
                        </select>
                      </div>

                      {/* UG Rate */}
                      <div className="flex items-center gap-1 bg-slate-50 dark:bg-[#18181B] p-1 rounded-xl border border-slate-200 dark:border-slate-800">
                        <span className="text-[10px] font-bold text-indigo-500 px-1">UG:</span>
                        <input
                          type="text"
                          aria-label={route.isDirect ? 'Master Direct (UG)' : `${route.key} (UG)`}
                          placeholder={setting.commissionType === 'Fixed Fee' ? '£ Fee' : '% Rate'}
                          value={setting.ugRate}
                          onChange={(e) => handleRouteChange(route.key, 'ugRate', e.target.value)}
                          className="w-16 px-1.5 py-0.5 text-center font-mono font-bold text-xs rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0E1526]"
                        />
                      </div>

                      {/* PG Rate */}
                      <div className="flex items-center gap-1 bg-slate-50 dark:bg-[#18181B] p-1 rounded-xl border border-slate-200 dark:border-slate-800">
                        <span className="text-[10px] font-bold text-violet-500 px-1">PG:</span>
                        <input
                          type="text"
                          aria-label={route.isDirect ? 'Master Direct (PG)' : `${route.key} (PG)`}
                          placeholder={setting.commissionType === 'Fixed Fee' ? '£ Fee' : '% Rate'}
                          value={setting.pgRate}
                          onChange={(e) => handleRouteChange(route.key, 'pgRate', e.target.value)}
                          className="w-16 px-1.5 py-0.5 text-center font-mono font-bold text-xs rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0E1526]"
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Footer Buttons */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200 dark:border-[#1F293D]">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-800/80 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white text-xs font-black shadow-lg shadow-emerald-950/40 transition cursor-pointer disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              <span>{saving ? 'Saving...' : 'Save University'}</span>
            </button>
          </div>
        </form>
      </div>

      {/* Embedded Add Intake Modal */}
      <AddIntakeModal
        isOpen={isAddIntakeOpen}
        onClose={() => {
          setIsAddIntakeOpen(false);
          setActiveRouteForIntake(null);
        }}
        existingIntakes={allKnownIntakes}
        onAddIntake={handleCreateNewIntake}
      />
    </div>,
    document.body
  );
};
