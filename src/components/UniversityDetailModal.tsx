import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Globe,
  Award,
  Building2,
  Banknote,
  Calendar,
  Layers,
  Pencil,
  Trash2,
  Check,
  RotateCcw,
  Loader2,
  Star,
  Plus,
  AlertCircle,
} from 'lucide-react';
import type { CommissionRate, StudyLevel } from '../types';
import { useAuth } from '../context/AuthContext';
import { generateCompositeId, normalizeUniversitySlug } from '../utils/idGenerator';

export interface UniversityDetailData {
  country: string; // Col A
  university: string; // Col B
  agentRateFD: string; // Col C
  agentRateUG: string; // Col D
  agentRatePG: string; // Col E
  commissionType: string; // Col F
  baselineIntake: string; // Col G
  masterRateUG: string; // Col H
  masterRatePG: string; // Col I
  edvoyUG: string; // Col J
  edvoyPG: string; // Col K
  siUkUG: string; // Col L
  siUkPG: string; // Col M
  uapUG: string; // Col N
  uapPG: string; // Col O
  crizacUG: string; // Col P
  crizacPG: string; // Col Q
  kcOverseasUG: string; // Col R
  kcOverseasPG: string; // Col S
  aimsEducationUG: string; // Col T
  aimsEducationPG: string; // Col U
  defaultRoute?: string;
  guidance?: string;
}

interface UniversityDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  data?: UniversityDetailData | null;
  ratesForUniversity?: CommissionRate[];
  universityName?: string;
  defaultIntake?: string;
  onSetDefaultIntake?: (intakeName: string) => Promise<void> | void;
  onSaveUniversity?: (updatedData: UniversityDetailData, makeDefaultIntake?: boolean) => Promise<void> | void;
  onDeleteUniversity?: (universityName: string, intake?: string) => Promise<void> | void;
  onAddRoute?: (rate: CommissionRate) => Promise<void> | void;
}

export const UniversityDetailModal: React.FC<UniversityDetailModalProps> = ({
  isOpen,
  onClose,
  data: rawData,
  ratesForUniversity = [],
  universityName,
  defaultIntake,
  onSetDefaultIntake,
  onSaveUniversity,
  onDeleteUniversity,
  onAddRoute,
}) => {
  const { role } = useAuth();
  const isAdmin = role === 'ADMIN';

  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [makeDefaultIntake, setMakeDefaultIntake] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);

  // Add Route state
  const [newRouteAggregator, setNewRouteAggregator] = useState('');
  const [newRouteLevel, setNewRouteLevel] = useState<StudyLevel>('UG');
  const [newRouteAgentRate, setNewRouteAgentRate] = useState('');
  const [newRouteMasterRate, setNewRouteMasterRate] = useState('');
  const [addingRoute, setAddingRoute] = useState(false);
  const [addRouteError, setAddRouteError] = useState<string | null>(null);
  const [addRouteSuccess, setAddRouteSuccess] = useState<string | null>(null);

  // Build resolved data record from rawData or ratesForUniversity
  const resolvedData: UniversityDetailData = useMemo(() => {
    if (rawData) return rawData;

    const name = universityName || ratesForUniversity[0]?.universityName || 'University';
    const country = ratesForUniversity[0]?.country || 'United Kingdom';
    const intake = ratesForUniversity[0]?.intake || 'Sept 2026';

    const defaultMatch = ratesForUniversity.find((r) => r.isDefaultRoute === true);
    const focusMatch = ratesForUniversity.find((r) => r.guidance === 'FOCUS');
    const defaultRoute = defaultMatch ? defaultMatch.aggregator : (focusMatch ? focusMatch.aggregator : ratesForUniversity[0]?.aggregator || 'BASECHAN');

    const getRate = (agg: string, level: string, isMaster = false): string => {
      const matches = ratesForUniversity.filter(
        (r) =>
          (r.aggregator || '').toUpperCase() === agg.toUpperCase() &&
          r.studyLevel === level
      );
      if (!matches.length) return '-';

      const match =
        matches.find((r) => isMaster ? (r.masterRate || 0) > 0 : (r.agentRate || 0) > 0) ||
        matches.find((r) => r.intake === intake) ||
        matches[0];

      const val = isMaster ? match.masterRate : match.agentRate;
      if (!val) return '-';
      return match.isFlatFee ? `£${val}` : `${val}%`;
    };

    const directUgMaster = getRate('BASECHAN', 'UG', true) !== '-' ? getRate('BASECHAN', 'UG', true) : getRate('Direct', 'UG', true);
    const directPgMaster = getRate('BASECHAN', 'PG', true) !== '-' ? getRate('BASECHAN', 'PG', true) : getRate('Direct', 'PG', true);

    const directUgAgent = getRate('BASECHAN', 'UG') !== '-' ? getRate('BASECHAN', 'UG') : getRate('Direct', 'UG');
    const directPgAgent = getRate('BASECHAN', 'PG') !== '-' ? getRate('BASECHAN', 'PG') : getRate('Direct', 'PG');
    const directFdAgent = getRate('BASECHAN', 'FD') !== '-' ? getRate('BASECHAN', 'FD') : getRate('Direct', 'FD');

    const isFlat = ratesForUniversity.some((r) => r.isFlatFee);

    return {
      country,
      university: name,
      agentRateFD: directFdAgent,
      agentRateUG: directUgAgent,
      agentRatePG: directPgAgent,
      commissionType: isFlat ? 'Fixed Fee' : 'Percentage',
      baselineIntake: intake,
      masterRateUG: directUgMaster,
      masterRatePG: directPgMaster,
      edvoyUG: getRate('EDVOY', 'UG'),
      edvoyPG: getRate('EDVOY', 'PG'),
      siUkUG: getRate('SI-UK', 'UG'),
      siUkPG: getRate('SI-UK', 'PG'),
      uapUG: getRate('UAP', 'UG'),
      uapPG: getRate('UAP', 'PG'),
      crizacUG: getRate('CRIZAC', 'UG'),
      crizacPG: getRate('CRIZAC', 'PG'),
      kcOverseasUG: getRate('KC OVERSEAS', 'UG'),
      kcOverseasPG: getRate('KC OVERSEAS', 'PG'),
      aimsEducationUG: getRate('AIMS EDUCATION', 'UG'),
      aimsEducationPG: getRate('AIMS EDUCATION', 'PG'),
      defaultRoute,
      guidance: ratesForUniversity[0]?.guidance || 'ALLOWED',
    };
  }, [rawData, ratesForUniversity, universityName]);

  const [editForm, setEditForm] = useState<UniversityDetailData>(resolvedData);

  useEffect(() => {
    setEditForm(resolvedData);
    setIsEditing(false);
    setMakeDefaultIntake(false);
  }, [resolvedData, isOpen]);

  if (!isOpen || !isAdmin) return null;

  const handleInputChange = (field: keyof UniversityDetailData, value: string) => {
    setEditForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    if (!onSaveUniversity) {
      setIsEditing(false);
      return;
    }
    setSaving(true);
    try {
      await onSaveUniversity(editForm, makeDefaultIntake);
      setIsEditing(false);
    } catch (err) {
      console.error('Failed to save university rate changes:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!onDeleteUniversity) return;
    const intakeLabel = resolvedData.baselineIntake ? ` (${resolvedData.baselineIntake})` : '';
    if (
      window.confirm(
        `Are you sure you want to delete all rate records for "${resolvedData.university}"${intakeLabel}? This action cannot be undone.`
      )
    ) {
      await onDeleteUniversity(resolvedData.university, resolvedData.baselineIntake);
      onClose();
    }
  };

  const handleAddNewRoute = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddRouteError(null);
    setAddRouteSuccess(null);
    if (!onAddRoute) return;

    const agg = newRouteAggregator.trim();
    if (!agg) {
      setAddRouteError('Aggregator name is required.');
      return;
    }

    const parseNum = (v: string) => {
      const clean = v.replace(/[^0-9.]/g, '');
      const n = parseFloat(clean);
      return Number.isNaN(n) ? 0 : n;
    };

    const agentNum = parseNum(newRouteAgentRate);
    const masterNum = parseNum(newRouteMasterRate);
    if (agentNum === 0 && masterNum === 0) {
      setAddRouteError('Please enter an Agent Rate or Master Rate.');
      return;
    }

    const uni = resolvedData.university;
    const intake = resolvedData.baselineIntake || defaultIntake || 'Sept 2026';

    // Duplicate route check for the active intake
    const alreadyExists = ratesForUniversity.some(
      (r) =>
        r.aggregator.trim().toLowerCase() === agg.toLowerCase() &&
        r.studyLevel === newRouteLevel &&
        (!r.intake || r.intake === intake)
    );
    if (alreadyExists) {
      setAddRouteError(`A route for "${agg}" (${newRouteLevel}) already exists in this intake. Edit the existing rate directly.`);
      return;
    }

    const id = generateCompositeId(uni, intake, agg, newRouteLevel);

    const existingUniId = ratesForUniversity.find((r) => Boolean(r.universityId && r.universityId.trim()))?.universityId || normalizeUniversitySlug(uni);

    const newRate: CommissionRate = {
      id,
      universityId: existingUniId,
      universityName: uni,
      country: resolvedData.country || 'United Kingdom',
      intake,
      aggregator: agg,
      studyLevel: newRouteLevel,
      agentRate: agentNum,
      masterRate: masterNum,
      diffMargin: Number((masterNum - agentNum).toFixed(2)),
      isFlatFee: resolvedData.commissionType === 'Fixed Fee',
      netOrGross: 'GROSS',
      guidance: (resolvedData.guidance as any) || 'ALLOWED',
      isDefaultRoute: false,
      updatedAt: new Date().toISOString(),
    };

    try {
      setAddingRoute(true);
      await onAddRoute(newRate);
      setAddRouteSuccess(`Route for ${agg} (${newRouteLevel}) added successfully!`);
      setNewRouteAggregator('');
      setNewRouteAgentRate('');
      setNewRouteMasterRate('');
    } catch (err: unknown) {
      setAddRouteError(err instanceof Error ? err.message : 'Failed to add route');
    } finally {
      setAddingRoute(false);
    }
  };

  const isIntakeSystemDefault = defaultIntake && editForm.baselineIntake === defaultIntake;

  const aggregatorsList = [
    { name: 'EDVOY', ug: editForm.edvoyUG, pg: editForm.edvoyPG },
    { name: 'SI-UK', ug: editForm.siUkUG, pg: editForm.siUkPG },
    { name: 'UAP', ug: editForm.uapUG, pg: editForm.uapPG },
    { name: 'CRIZAC', ug: editForm.crizacUG, pg: editForm.crizacPG },
    { name: 'KC OVERSEAS', ug: editForm.kcOverseasUG, pg: editForm.kcOverseasPG },
    { name: 'AIMS EDUCATION', ug: editForm.aimsEducationUG, pg: editForm.aimsEducationPG },
  ] as const;

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 overflow-y-auto animate-backdrop-fade"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative my-auto max-w-4xl w-full bg-white dark:bg-[#0E1526] text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-[#222F43] rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Modal Header */}
        <div className="p-5 sm:p-6 border-b border-slate-200 dark:border-[#222F43] bg-slate-50/90 dark:bg-[#18181B]/90 flex items-start justify-between shrink-0">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-md text-[10px] font-black uppercase bg-indigo-100 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 flex items-center gap-1">
                <Globe className="w-3 h-3" />
                {editForm.country}
              </span>

              {/* Intake Badge & Set Default Control */}
              <div className="flex items-center gap-1">
                <span className="px-2.5 py-0.5 rounded-md text-[10px] font-black uppercase bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  {editForm.baselineIntake}
                </span>

                {isIntakeSystemDefault ? (
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-400/40 flex items-center gap-1" title="System Default Intake">
                    <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                    Default Intake
                  </span>
                ) : (
                  isAdmin && onSetDefaultIntake && (
                    <button
                      type="button"
                      onClick={() => onSetDefaultIntake(editForm.baselineIntake)}
                      className="px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-slate-200 dark:bg-slate-800 hover:bg-amber-500/20 text-slate-700 dark:text-slate-300 hover:text-amber-300 border border-slate-300 dark:border-slate-700 transition cursor-pointer flex items-center gap-1"
                      title="Set as System Default Intake"
                    >
                      <Star className="w-3 h-3 text-amber-400" />
                      Set as Default
                    </button>
                  )
                )}
              </div>

              {/* Commission Type Badge */}
              <span className="px-2.5 py-0.5 rounded-md text-[10px] font-black uppercase bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800 flex items-center gap-1">
                <Layers className="w-3 h-3" />
                {editForm.commissionType}
              </span>

              {/* Default Route Badge */}
              <span className="px-2.5 py-0.5 rounded-md text-[10px] font-black uppercase bg-blue-100 dark:bg-blue-950/80 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 flex items-center gap-1">
                <Award className="w-3 h-3 text-amber-500" />
                Default Route: {editForm.defaultRoute || 'BASECHAN'}
              </span>

              {/* Guidance Status Badge */}
              <span className={`px-2.5 py-0.5 rounded-md text-[10px] font-black uppercase border flex items-center gap-1 ${
                editForm.guidance === 'FOCUS'
                  ? 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700'
                  : editForm.guidance === 'DO_NOT_USE'
                  ? 'bg-rose-100 dark:bg-rose-950/80 text-rose-700 dark:text-rose-300 border-rose-300 dark:border-rose-700'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700'
              }`}>
                Guidance: {editForm.guidance || 'ALLOWED'}
              </span>
            </div>

            <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-slate-100 leading-tight">
              {resolvedData.university}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {isEditing
                ? 'Editing Specifications Form — Live changes reflect in top summary cards above'
                : 'Master Commission Record & Competitor Aggregator Benchmark Matrix'}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {isAdmin && !isEditing && (
              <>
                <button
                  type="button"
                  onClick={() => setIsEditing(true)}
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 transition cursor-pointer active:scale-95"
                  title="Edit university rates, default intake & default route"
                >
                  <Pencil className="w-3.5 h-3.5" />
                  <span>Edit Record</span>
                </button>

                {onDeleteUniversity && (
                  <button
                    type="button"
                    onClick={handleDelete}
                    className="p-2 text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-950/60 rounded-xl transition cursor-pointer"
                    title="Delete university record"
                  >
                    <Trash2 className="w-4.5 h-4.5" />
                  </button>
                )}
              </>
            )}

            {isEditing && (
              <>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving}
                  className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 transition cursor-pointer active:scale-95 disabled:opacity-50"
                >
                  {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                  <span>Save</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setEditForm(resolvedData);
                    setIsEditing(false);
                    setMakeDefaultIntake(false);
                  }}
                  disabled={saving}
                  className="px-3 py-1.5 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold rounded-xl text-xs flex items-center gap-1 transition cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Cancel</span>
                </button>
              </>
            )}

            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-800 rounded-xl transition cursor-pointer ml-1"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-5 sm:p-6 space-y-6 overflow-y-auto flex-1 text-xs">
          {/* SECTION 1: Top Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Sub-Agent Rates */}
            <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl space-y-3">
              <div className="flex items-center justify-between border-b border-emerald-500/20 pb-2">
                <h3 className="font-extrabold text-sm text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
                  <Banknote className="w-4 h-4" />
                  Basechan Sub-Agent Rates (Payouts)
                </h3>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="p-2.5 bg-white dark:bg-[#18181B] rounded-xl border border-emerald-500/20">
                  <span className="block text-[10px] font-bold text-slate-400 uppercase">Agent FD</span>
                  <span className="font-mono font-extrabold text-sm text-emerald-700 dark:text-emerald-300 mt-1 block">
                    {editForm.agentRateFD}
                  </span>
                </div>

                <div className="p-2.5 bg-white dark:bg-[#18181B] rounded-xl border border-emerald-500/20">
                  <span className="block text-[10px] font-bold text-slate-400 uppercase">Agent UG</span>
                  <span className="font-mono font-extrabold text-sm text-emerald-700 dark:text-emerald-300 mt-1 block">
                    {editForm.agentRateUG}
                  </span>
                </div>

                <div className="p-2.5 bg-white dark:bg-[#18181B] rounded-xl border border-emerald-500/20">
                  <span className="block text-[10px] font-bold text-slate-400 uppercase">Agent PG</span>
                  <span className="font-mono font-extrabold text-sm text-emerald-700 dark:text-emerald-300 mt-1 block">
                    {editForm.agentRatePG}
                  </span>
                </div>
              </div>
            </div>

            {/* Master Original Contract Rates */}
            <div className="p-4 bg-indigo-500/10 border border-indigo-500/20 rounded-2xl space-y-3">
              <div className="flex items-center justify-between border-b border-indigo-500/20 pb-2">
                <h3 className="font-extrabold text-sm text-indigo-800 dark:text-indigo-300 flex items-center gap-2">
                  <Building2 className="w-4 h-4" />
                  Master Direct Institutional Contract
                </h3>
              </div>

              <div className="grid grid-cols-2 gap-2 text-center">
                <div className="p-2.5 bg-white dark:bg-[#18181B] rounded-xl border border-indigo-500/20">
                  <span className="block text-[10px] font-bold text-slate-400 uppercase">Master UG</span>
                  <span className="font-mono font-extrabold text-sm text-indigo-700 dark:text-indigo-300 mt-1 block">
                    {editForm.masterRateUG}
                  </span>
                </div>

                <div className="p-2.5 bg-white dark:bg-[#18181B] rounded-xl border border-indigo-500/20">
                  <span className="block text-[10px] font-bold text-slate-400 uppercase">Master PG</span>
                  <span className="font-mono font-extrabold text-sm text-indigo-700 dark:text-indigo-300 mt-1 block">
                    {editForm.masterRatePG}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* SECTION 2: Competitor Aggregator Benchmark Matrix */}
          <div className="p-4 bg-slate-100 dark:bg-[#18181B] border border-slate-200 dark:border-[#222F43] rounded-2xl space-y-3">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-[#222F43] pb-2">
              <h3 className="font-extrabold text-sm text-slate-800 dark:text-slate-200 flex items-center gap-2">
                <Award className="w-4 h-4 text-amber-500" />
                Third-Party Aggregator Rates Comparison
              </h3>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
              {aggregatorsList.map((agg) => (
                <div
                  key={agg.name}
                  className={`p-3 border rounded-xl text-center space-y-1.5 ${
                    editForm.defaultRoute === agg.name
                      ? 'bg-blue-50/80 dark:bg-blue-950/40 border-blue-400 ring-2 ring-blue-500/20'
                      : 'bg-white dark:bg-[#0E1526] border-slate-200 dark:border-[#222F43]'
                  }`}
                >
                  <span className="font-extrabold text-xs text-slate-900 dark:text-slate-100 block truncate flex items-center justify-center gap-1">
                    {agg.name}
                    {editForm.defaultRoute === agg.name && (
                      <Star className="w-3 h-3 fill-amber-400 text-amber-400 shrink-0" />
                    )}
                  </span>
                  <div className="pt-1 border-t border-slate-100 dark:border-[#1E293B] space-y-1">
                    <div className="flex items-center justify-between text-[10px]">
                      <span className="text-slate-400 font-bold">UG:</span>
                      <span className="font-mono font-bold text-slate-700 dark:text-slate-300">{agg.ug}</span>
                    </div>

                    <div className="flex items-center justify-between text-[10px]">
                      <span className="text-slate-400 font-bold">PG:</span>
                      <span className="font-mono font-bold text-slate-700 dark:text-slate-300">{agg.pg}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* SECTION 3: Primary Editable Specifications Form (Hidden until Edit Mode) */}
          {isEditing && (
            <div className="p-4 bg-white dark:bg-[#0E1526] border border-blue-500 ring-2 ring-blue-500/20 rounded-2xl space-y-3 animate-in fade-in duration-150">
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-[#222F43] pb-2">
                <h3 className="font-extrabold text-xs text-slate-800 dark:text-slate-200 uppercase tracking-wider block">
                  University Commission & Aggregator Specifications <span className="text-blue-500 font-normal ml-1">(Edit Mode Active)</span>
                </h3>
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-1.5 text-xs font-bold text-amber-500 dark:text-amber-400 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={makeDefaultIntake}
                      onChange={(e) => setMakeDefaultIntake(e.target.checked)}
                      className="w-3.5 h-3.5 rounded border-slate-300 text-amber-500 focus:ring-amber-500"
                    />
                    <span>Set as System Default Intake</span>
                  </label>
                </div>
              </div>

              {/* Default Route Picker */}
              <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl flex items-center justify-between gap-3 text-xs">
                <span className="font-bold text-blue-800 dark:text-blue-300 flex items-center gap-1.5">
                  <Award className="w-4 h-4 text-amber-400" />
                  Default Route for Staff:
                </span>
                <select
                  value={editForm.defaultRoute || 'BASECHAN'}
                  onChange={(e) => handleInputChange('defaultRoute', e.target.value)}
                  className="px-2.5 py-1 rounded-lg bg-white dark:bg-[#18181B] border border-blue-400 font-bold text-xs"
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

              {/* Guidance / Status Selector */}
              <div className="p-3 bg-slate-500/10 border border-slate-500/20 rounded-xl flex items-center justify-between gap-3 text-xs">
                <span className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <span>School Guidance (Status):</span>
                </span>
                <select
                  value={editForm.guidance || 'ALLOWED'}
                  onChange={(e) => handleInputChange('guidance', e.target.value)}
                  className="px-2.5 py-1 rounded-lg bg-white dark:bg-[#18181B] border border-slate-400 dark:border-slate-600 font-bold text-xs"
                >
                  <option value="ALLOWED">🔵 Allowed (Standard)</option>
                  <option value="FOCUS">🟢 Focus / Preferred</option>
                  <option value="DO_NOT_USE">🔴 Do Not Use</option>
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 text-[11px] font-mono">
                {/* Country */}
                <div className="p-2 bg-slate-50 dark:bg-[#18181B] rounded-xl flex items-center justify-between">
                  <span className="text-slate-400 font-sans font-semibold">Country:</span>
                  <input
                    type="text"
                    value={editForm.country}
                    onChange={(e) => handleInputChange('country', e.target.value)}
                    className="w-28 text-right font-mono font-bold text-xs p-1 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0E1526] text-slate-900 dark:text-slate-100"
                  />
                </div>

                {/* University */}
                <div className="p-2 bg-slate-50 dark:bg-[#18181B] rounded-xl flex items-center justify-between">
                  <span className="text-slate-400 font-sans font-semibold">University:</span>
                  <span className="font-bold truncate max-w-[150px]">{editForm.university}</span>
                </div>

                {/* Agent Rate (FD) */}
                <div className="p-2 bg-slate-50 dark:bg-[#18181B] rounded-xl flex items-center justify-between">
                  <span className="text-slate-400 font-sans font-semibold">Agent Rate (FD):</span>
                  <input
                    type="text"
                    value={editForm.agentRateFD}
                    onChange={(e) => handleInputChange('agentRateFD', e.target.value)}
                    className="w-28 text-right font-mono font-bold text-xs p-1 rounded border border-emerald-500/40 bg-white dark:bg-[#0E1526] text-emerald-600 dark:text-emerald-400"
                  />
                </div>

                {/* Agent Rate (UG) */}
                <div className="p-2 bg-slate-50 dark:bg-[#18181B] rounded-xl flex items-center justify-between">
                  <span className="text-slate-400 font-sans font-semibold">Agent Rate (UG):</span>
                  <input
                    type="text"
                    value={editForm.agentRateUG}
                    onChange={(e) => handleInputChange('agentRateUG', e.target.value)}
                    className="w-28 text-right font-mono font-bold text-xs p-1 rounded border border-emerald-500/40 bg-white dark:bg-[#0E1526] text-emerald-600 dark:text-emerald-400"
                  />
                </div>

                {/* Agent Rate (PG) */}
                <div className="p-2 bg-slate-50 dark:bg-[#18181B] rounded-xl flex items-center justify-between">
                  <span className="text-slate-400 font-sans font-semibold">Agent Rate (PG):</span>
                  <input
                    type="text"
                    value={editForm.agentRatePG}
                    onChange={(e) => handleInputChange('agentRatePG', e.target.value)}
                    className="w-28 text-right font-mono font-bold text-xs p-1 rounded border border-emerald-500/40 bg-white dark:bg-[#0E1526] text-emerald-600 dark:text-emerald-400"
                  />
                </div>

                {/* Commission Type */}
                <div className="p-2 bg-slate-50 dark:bg-[#18181B] rounded-xl flex items-center justify-between">
                  <span className="text-slate-400 font-sans font-semibold">Commission Type:</span>
                  <select
                    value={editForm.commissionType}
                    onChange={(e) => handleInputChange('commissionType', e.target.value)}
                    className="w-28 text-right font-mono font-bold text-xs p-1 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0E1526] text-slate-900 dark:text-slate-100"
                  >
                    <option value="Percentage">Percentage</option>
                    <option value="Fixed Fee">Fixed Fee</option>
                    <option value="Mixed (Fee/%)">Mixed (Fee/%)</option>
                  </select>
                </div>

                {/* Baseline Intake */}
                <div className="p-2 bg-slate-50 dark:bg-[#18181B] rounded-xl flex items-center justify-between">
                  <span className="text-slate-400 font-sans font-semibold">Baseline Intake:</span>
                  <input
                    type="text"
                    value={editForm.baselineIntake}
                    onChange={(e) => handleInputChange('baselineIntake', e.target.value)}
                    className="w-28 text-right font-mono font-bold text-xs p-1 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0E1526] text-slate-900 dark:text-slate-100"
                  />
                </div>

                {/* Master Original (UG) */}
                <div className="p-2 bg-slate-50 dark:bg-[#18181B] rounded-xl flex items-center justify-between">
                  <span className="text-slate-400 font-sans font-semibold">Master Original (UG):</span>
                  <input
                    type="text"
                    value={editForm.masterRateUG}
                    onChange={(e) => handleInputChange('masterRateUG', e.target.value)}
                    className="w-28 text-right font-mono font-bold text-xs p-1 rounded border border-indigo-500/40 bg-white dark:bg-[#0E1526] text-indigo-600 dark:text-indigo-400"
                  />
                </div>

                {/* Master Original (PG) */}
                <div className="p-2 bg-slate-50 dark:bg-[#18181B] rounded-xl flex items-center justify-between">
                  <span className="text-slate-400 font-sans font-semibold">Master Original (PG):</span>
                  <input
                    type="text"
                    value={editForm.masterRatePG}
                    onChange={(e) => handleInputChange('masterRatePG', e.target.value)}
                    className="w-28 text-right font-mono font-bold text-xs p-1 rounded border border-indigo-500/40 bg-white dark:bg-[#0E1526] text-indigo-600 dark:text-indigo-400"
                  />
                </div>

                {/* EDVOY (UG) */}
                <div className="p-2 bg-slate-50 dark:bg-[#18181B] rounded-xl flex items-center justify-between">
                  <span className="text-slate-400 font-sans font-semibold">EDVOY (UG):</span>
                  <input
                    type="text"
                    value={editForm.edvoyUG}
                    onChange={(e) => handleInputChange('edvoyUG', e.target.value)}
                    className="w-24 text-right font-mono font-bold text-xs p-1 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0E1526] text-slate-900 dark:text-slate-100"
                  />
                </div>

                {/* EDVOY (PG) */}
                <div className="p-2 bg-slate-50 dark:bg-[#18181B] rounded-xl flex items-center justify-between">
                  <span className="text-slate-400 font-sans font-semibold">EDVOY (PG):</span>
                  <input
                    type="text"
                    value={editForm.edvoyPG}
                    onChange={(e) => handleInputChange('edvoyPG', e.target.value)}
                    className="w-24 text-right font-mono font-bold text-xs p-1 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0E1526] text-slate-900 dark:text-slate-100"
                  />
                </div>

                {/* SI-UK (UG) */}
                <div className="p-2 bg-slate-50 dark:bg-[#18181B] rounded-xl flex items-center justify-between">
                  <span className="text-slate-400 font-sans font-semibold">SI-UK (UG):</span>
                  <input
                    type="text"
                    value={editForm.siUkUG}
                    onChange={(e) => handleInputChange('siUkUG', e.target.value)}
                    className="w-24 text-right font-mono font-bold text-xs p-1 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0E1526] text-slate-900 dark:text-slate-100"
                  />
                </div>

                {/* SI-UK (PG) */}
                <div className="p-2 bg-slate-50 dark:bg-[#18181B] rounded-xl flex items-center justify-between">
                  <span className="text-slate-400 font-sans font-semibold">SI-UK (PG):</span>
                  <input
                    type="text"
                    value={editForm.siUkPG}
                    onChange={(e) => handleInputChange('siUkPG', e.target.value)}
                    className="w-24 text-right font-mono font-bold text-xs p-1 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0E1526] text-slate-900 dark:text-slate-100"
                  />
                </div>

                {/* UAP (UG) */}
                <div className="p-2 bg-slate-50 dark:bg-[#18181B] rounded-xl flex items-center justify-between">
                  <span className="text-slate-400 font-sans font-semibold">UAP (UG):</span>
                  <input
                    type="text"
                    value={editForm.uapUG}
                    onChange={(e) => handleInputChange('uapUG', e.target.value)}
                    className="w-24 text-right font-mono font-bold text-xs p-1 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0E1526] text-slate-900 dark:text-slate-100"
                  />
                </div>

                {/* UAP (PG) */}
                <div className="p-2 bg-slate-50 dark:bg-[#18181B] rounded-xl flex items-center justify-between">
                  <span className="text-slate-400 font-sans font-semibold">UAP (PG):</span>
                  <input
                    type="text"
                    value={editForm.uapPG}
                    onChange={(e) => handleInputChange('uapPG', e.target.value)}
                    className="w-24 text-right font-mono font-bold text-xs p-1 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0E1526] text-slate-900 dark:text-slate-100"
                  />
                </div>

                {/* CRIZAC (UG) */}
                <div className="p-2 bg-slate-50 dark:bg-[#18181B] rounded-xl flex items-center justify-between">
                  <span className="text-slate-400 font-sans font-semibold">CRIZAC (UG):</span>
                  <input
                    type="text"
                    value={editForm.crizacUG}
                    onChange={(e) => handleInputChange('crizacUG', e.target.value)}
                    className="w-24 text-right font-mono font-bold text-xs p-1 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0E1526] text-slate-900 dark:text-slate-100"
                  />
                </div>

                {/* CRIZAC (PG) */}
                <div className="p-2 bg-slate-50 dark:bg-[#18181B] rounded-xl flex items-center justify-between">
                  <span className="text-slate-400 font-sans font-semibold">CRIZAC (PG):</span>
                  <input
                    type="text"
                    value={editForm.crizacPG}
                    onChange={(e) => handleInputChange('crizacPG', e.target.value)}
                    className="w-24 text-right font-mono font-bold text-xs p-1 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0E1526] text-slate-900 dark:text-slate-100"
                  />
                </div>

                {/* KC OVERSEAS (UG) */}
                <div className="p-2 bg-slate-50 dark:bg-[#18181B] rounded-xl flex items-center justify-between">
                  <span className="text-slate-400 font-sans font-semibold">KC OVERSEAS (UG):</span>
                  <input
                    type="text"
                    value={editForm.kcOverseasUG}
                    onChange={(e) => handleInputChange('kcOverseasUG', e.target.value)}
                    className="w-24 text-right font-mono font-bold text-xs p-1 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0E1526] text-slate-900 dark:text-slate-100"
                  />
                </div>

                {/* KC OVERSEAS (PG) */}
                <div className="p-2 bg-slate-50 dark:bg-[#18181B] rounded-xl flex items-center justify-between">
                  <span className="text-slate-400 font-sans font-semibold">KC OVERSEAS (PG):</span>
                  <input
                    type="text"
                    value={editForm.kcOverseasPG}
                    onChange={(e) => handleInputChange('kcOverseasPG', e.target.value)}
                    className="w-24 text-right font-mono font-bold text-xs p-1 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0E1526] text-slate-900 dark:text-slate-100"
                  />
                </div>

                {/* AIMS EDUCATION (UG) */}
                <div className="p-2 bg-slate-50 dark:bg-[#18181B] rounded-xl flex items-center justify-between">
                  <span className="text-slate-400 font-sans font-semibold">AIMS EDUCATION (UG):</span>
                  <input
                    type="text"
                    value={editForm.aimsEducationUG}
                    onChange={(e) => handleInputChange('aimsEducationUG', e.target.value)}
                    className="w-24 text-right font-mono font-bold text-xs p-1 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0E1526] text-slate-900 dark:text-slate-100"
                  />
                </div>

                {/* AIMS EDUCATION (PG) */}
                <div className="p-2 bg-slate-50 dark:bg-[#18181B] rounded-xl flex items-center justify-between">
                  <span className="text-slate-400 font-sans font-semibold">AIMS EDUCATION (PG):</span>
                  <input
                    type="text"
                    value={editForm.aimsEducationPG}
                    onChange={(e) => handleInputChange('aimsEducationPG', e.target.value)}
                    className="w-24 text-right font-mono font-bold text-xs p-1 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0E1526] text-slate-900 dark:text-slate-100"
                  />
                </div>
              </div>

              {/* Add Custom Aggregator Route Form */}
              {onAddRoute && (
                <div className="mt-5 p-4 rounded-2xl bg-indigo-50/50 dark:bg-[#131B2E] border border-indigo-200 dark:border-indigo-900/60 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 rounded-lg bg-indigo-600 text-white">
                        <Plus className="w-4 h-4" />
                      </div>
                      <h4 className="text-xs font-black uppercase tracking-wider text-indigo-700 dark:text-indigo-300">
                        Add Custom Aggregator Route
                      </h4>
                    </div>
                  </div>

                  {addRouteError && (
                    <div className="p-2 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-semibold flex items-center gap-1.5">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                      <span>{addRouteError}</span>
                    </div>
                  )}

                  {addRouteSuccess && (
                    <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold flex items-center gap-1.5">
                      <Check className="w-3.5 h-3.5 shrink-0" />
                      <span>{addRouteSuccess}</span>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5 text-xs">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">
                        Aggregator Name
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. INTO, Kaplan, QS"
                        value={newRouteAggregator}
                        onChange={(e) => setNewRouteAggregator(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0E1526] text-slate-900 dark:text-slate-100 font-semibold focus:outline-none focus:border-indigo-500"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">
                        Study Level
                      </label>
                      <select
                        value={newRouteLevel}
                        onChange={(e) => setNewRouteLevel(e.target.value as StudyLevel)}
                        className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0E1526] text-slate-900 dark:text-slate-100 font-semibold focus:outline-none focus:border-indigo-500"
                      >
                        <option value="UG">Undergraduate (UG)</option>
                        <option value="PG">Postgraduate (PG)</option>
                        <option value="FD">Foundation (FD)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">
                        Agent Rate
                      </label>
                      <input
                        type="text"
                        placeholder="Agent Rate"
                        value={newRouteAgentRate}
                        onChange={(e) => setNewRouteAgentRate(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0E1526] text-slate-900 dark:text-slate-100 font-mono focus:outline-none focus:border-indigo-500"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">
                        Master Rate
                      </label>
                      <input
                        type="text"
                        placeholder="Master Rate"
                        value={newRouteMasterRate}
                        onChange={(e) => setNewRouteMasterRate(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0E1526] text-slate-900 dark:text-slate-100 font-mono focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end pt-1">
                    <button
                      type="button"
                      disabled={addingRoute}
                      onClick={handleAddNewRoute}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs transition shadow-xs active:scale-95 disabled:opacity-50 cursor-pointer"
                    >
                      {addingRoute ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                      <span>{addingRoute ? 'Adding...' : 'Add Route Now'}</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};
