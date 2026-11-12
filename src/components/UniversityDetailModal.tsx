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
  StickyNote,
  Share2,
} from 'lucide-react';
import type { CommissionRate, StudyLevel } from '../types';
import { useAuth } from '../context/AuthContext';
import { generateCompositeId, normalizeUniversitySlug } from '../utils/idGenerator';
import { AddIntakeModal } from './AddIntakeModal';

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
  notes?: string;
  routeIntakes?: Record<string, string>;
  routeCommissionTypes?: Record<string, string>;
}

interface UniversityDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  data?: UniversityDetailData | null;
  ratesForUniversity?: CommissionRate[];
  universityName?: string;
  defaultIntake?: string;
  availableIntakes?: string[];
  onSetDefaultIntake?: (intakeName: string) => Promise<void> | void;
  onSaveUniversity?: (updatedData: UniversityDetailData, makeDefaultIntake?: boolean) => Promise<void> | void;
  onDeleteUniversity?: (universityName: string, intake?: string) => Promise<void> | void;
  onAddRoute?: (rate: CommissionRate) => Promise<void> | void;
  onAddNewIntake?: (newIntake: string) => Promise<void> | void;
  onShareRate?: (rate: CommissionRate) => void;
  onUpdateSingleRoute?: (rate: CommissionRate, updates: Partial<CommissionRate>) => Promise<void>;
  onResetRouteRates?: (rate: CommissionRate) => Promise<void>;
}

export const UniversityDetailModal: React.FC<UniversityDetailModalProps> = ({
  isOpen,
  onClose,
  data: rawData,
  ratesForUniversity = [],
  universityName,
  defaultIntake,
  availableIntakes = [],
  onSetDefaultIntake,
  onSaveUniversity,
  onDeleteUniversity,
  onAddRoute,
  onAddNewIntake,
  onShareRate,
  onUpdateSingleRoute,
  onResetRouteRates,
}) => {
  const { role } = useAuth();
  const isAdmin = role === 'ADMIN';
  void onUpdateSingleRoute;

  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [makeDefaultIntake, setMakeDefaultIntake] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Add Route state
  const [newRouteAggregator, setNewRouteAggregator] = useState('');
  const [newRouteLevel, setNewRouteLevel] = useState<StudyLevel>('UG');
  const [newRouteAgentRate, setNewRouteAgentRate] = useState('');
  const [newRouteMasterRate, setNewRouteMasterRate] = useState('');
  const [addingRoute, setAddingRoute] = useState(false);
  const [addRouteError, setAddRouteError] = useState<string | null>(null);
  const [addRouteSuccess, setAddRouteSuccess] = useState<string | null>(null);

  const [routeSavingKey, setRouteSavingKey] = useState<string | null>(null);

  // Quick Edit Modal state
  const [quickEditModalRoute, setQuickEditModalRoute] = useState<string | null>(null);
  const [quickEditMasterUG, setQuickEditMasterUG] = useState('');
  const [quickEditMasterPG, setQuickEditMasterPG] = useState('');
  const [quickEditTypeUG, setQuickEditTypeUG] = useState<'Percentage' | 'Fixed Fee'>('Percentage');
  const [quickEditTypePG, setQuickEditTypePG] = useState<'Percentage' | 'Fixed Fee'>('Percentage');
  const [quickEditAgentFD, setQuickEditAgentFD] = useState('');
  const [quickEditAgentUG, setQuickEditAgentUG] = useState('');
  const [quickEditAgentPG, setQuickEditAgentPG] = useState('');
  const [quickEditSaving, setQuickEditSaving] = useState(false);

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

    // Build initial per-route intakes and commission types
    const routeIntakes: Record<string, string> = {};
    const routeCommissionTypes: Record<string, string> = {};
    const initialNotes = (rawData as UniversityDetailData | undefined)?.notes || (ratesForUniversity as CommissionRate[]).find((r) => Boolean(r.notes && r.notes.trim()))?.notes || '';

    ratesForUniversity.forEach((r) => {
      const key = `${r.aggregator.toUpperCase()}_${r.studyLevel}`;
      if (r.intake) routeIntakes[key] = r.intake;
      routeCommissionTypes[key] = r.isFlatFee ? 'Fixed Fee' : 'Percentage';
    });

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
      edvoyUG: getRate('EDVOY', 'UG', true),
      edvoyPG: getRate('EDVOY', 'PG', true),
      siUkUG: getRate('SI-UK', 'UG', true),
      siUkPG: getRate('SI-UK', 'PG', true),
      uapUG: getRate('UAP', 'UG', true),
      uapPG: getRate('UAP', 'PG', true),
      crizacUG: getRate('CRIZAC', 'UG', true),
      crizacPG: getRate('CRIZAC', 'PG', true),
      kcOverseasUG: getRate('KC OVERSEAS', 'UG', true),
      kcOverseasPG: getRate('KC OVERSEAS', 'PG', true),
      aimsEducationUG: getRate('AIMS EDUCATION', 'UG', true),
      aimsEducationPG: getRate('AIMS EDUCATION', 'PG', true),
      defaultRoute,
      guidance: ratesForUniversity[0]?.guidance || 'ALLOWED',
      notes: initialNotes,
      routeIntakes,
      routeCommissionTypes,
    };
  }, [rawData, ratesForUniversity, universityName]);

  const [editForm, setEditForm] = useState<UniversityDetailData>(resolvedData);
  const [isAddIntakeOpen, setIsAddIntakeOpen] = useState(false);
  const [activeRouteKeyForNewIntake, setActiveRouteKeyForNewIntake] = useState<string | null>(null);

  // Combine available intakes
  const allKnownIntakes = useMemo(() => {
    const set = new Set<string>(availableIntakes);
    if (resolvedData.baselineIntake) set.add(resolvedData.baselineIntake);
    ratesForUniversity.forEach((r) => {
      if (r.intake) set.add(r.intake);
    });
    if (editForm.baselineIntake) set.add(editForm.baselineIntake);
    if (editForm.routeIntakes) {
      Object.values(editForm.routeIntakes).forEach((v) => {
        if (v) set.add(v);
      });
    }
    return Array.from(set).filter(Boolean).sort();
  }, [availableIntakes, resolvedData.baselineIntake, ratesForUniversity, editForm.baselineIntake, editForm.routeIntakes]);

  useEffect(() => {
    setEditForm(resolvedData);
    setIsEditing(false);
    setMakeDefaultIntake(false);
    setSaveError(null);
  }, [resolvedData, isOpen]);

  if (!isOpen || !isAdmin) return null;

  const handleInputChange = (field: keyof UniversityDetailData, value: string) => {
    setSaveError(null);
    setEditForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleRouteIntakeChange = (routeKey: string, intakeValue: string) => {
    setSaveError(null);
    setEditForm((prev) => ({
      ...prev,
      routeIntakes: {
        ...(prev.routeIntakes || {}),
        [routeKey]: intakeValue,
      },
    }));
  };

  const handleRouteCommissionTypeChange = (routeKey: string, typeValue: string) => {
    setSaveError(null);
    setEditForm((prev) => ({
      ...prev,
      routeCommissionTypes: {
        ...(prev.routeCommissionTypes || {}),
        [routeKey]: typeValue,
      },
    }));
  };

  const handleBulkApplyIntake = (intakeValue: string) => {
    if (!intakeValue) return;
    setEditForm((prev) => {
      const nextRouteIntakes: Record<string, string> = { ...(prev.routeIntakes || {}) };
      const allAggregators = ['BASECHAN', 'EDVOY', 'SI-UK', 'UAP', 'CRIZAC', 'KC OVERSEAS', 'AIMS EDUCATION'];
      allAggregators.forEach((agg) => {
        nextRouteIntakes[`${agg}_UG`] = intakeValue;
        nextRouteIntakes[`${agg}_PG`] = intakeValue;
      });
      nextRouteIntakes['BASECHAN_FD'] = intakeValue;
      return {
        ...prev,
        baselineIntake: intakeValue,
        routeIntakes: nextRouteIntakes,
      };
    });
  };

  const handleBulkApplyCommissionType = (typeValue: string) => {
    if (!typeValue) return;
    setEditForm((prev) => {
      const nextRouteTypes: Record<string, string> = { ...(prev.routeCommissionTypes || {}) };
      const allAggregators = ['BASECHAN', 'EDVOY', 'SI-UK', 'UAP', 'CRIZAC', 'KC OVERSEAS', 'AIMS EDUCATION'];
      allAggregators.forEach((agg) => {
        nextRouteTypes[`${agg}_UG`] = typeValue;
        nextRouteTypes[`${agg}_PG`] = typeValue;
      });
      nextRouteTypes['BASECHAN_FD'] = typeValue;
      return {
        ...prev,
        commissionType: typeValue,
        routeCommissionTypes: nextRouteTypes,
      };
    });
  };

  const handleCreateNewIntake = async (newIntake: string) => {
    if (onAddNewIntake) {
      await onAddNewIntake(newIntake);
    }
    if (activeRouteKeyForNewIntake) {
      handleRouteIntakeChange(activeRouteKeyForNewIntake, newIntake);
      setActiveRouteKeyForNewIntake(null);
    } else {
      handleBulkApplyIntake(newIntake);
    }
  };

  const handleSave = async () => {
    if (!onSaveUniversity) {
      setIsEditing(false);
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      await onSaveUniversity(editForm, makeDefaultIntake);
      setIsEditing(false);
    } catch (err) {
      console.error('Failed to save university rate changes:', err);
      setSaveError(err instanceof Error ? err.message : 'Could not save rate changes. Please retry.');
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

  const handleInlineResetRate = async (aggName: string, level: 'UG' | 'PG') => {
    const rateMatch = ratesForUniversity.find(
      (r) => (r.aggregator || '').toUpperCase() === aggName.toUpperCase() && r.studyLevel === level
    );
    if (rateMatch && onResetRouteRates) {
      if (!window.confirm(`Reset ${aggName} (${level}) rates to 0?`)) return;
      const key = `${aggName}_${level}`;
      setRouteSavingKey(key);
      try {
        await onResetRouteRates(rateMatch);
        // Also update local editForm state
        const formField = `${aggName.toLowerCase().replace(/[\s-]/g, '')}${level}` as keyof UniversityDetailData;
        if (formField in editForm) {
          handleInputChange(formField, '0');
        }
      } catch (err) {
        console.error('Reset error:', err);
      } finally {
        setRouteSavingKey(null);
      }
    } else {
      // Just zero out in local editForm
      const mapping: Record<string, keyof UniversityDetailData> = {
        'EDVOY_UG': 'edvoyUG', 'EDVOY_PG': 'edvoyPG',
        'SI-UK_UG': 'siUkUG', 'SI-UK_PG': 'siUkPG',
        'UAP_UG': 'uapUG', 'UAP_PG': 'uapPG',
        'CRIZAC_UG': 'crizacUG', 'CRIZAC_PG': 'crizacPG',
        'KC OVERSEAS_UG': 'kcOverseasUG', 'KC OVERSEAS_PG': 'kcOverseasPG',
        'AIMS EDUCATION_UG': 'aimsEducationUG', 'AIMS EDUCATION_PG': 'aimsEducationPG',
      };
      const field = mapping[`${aggName}_${level}`];
      if (field) {
        handleInputChange(field, '0');
      }
    }
  };

  const openQuickEditModal = (aggName: string) => {
    setQuickEditModalRoute(aggName);
    if (aggName === 'BASECHAN') {
      setQuickEditMasterUG(editForm.masterRateUG.replace(/[^0-9.]/g, ''));
      setQuickEditMasterPG(editForm.masterRatePG.replace(/[^0-9.]/g, ''));
      setQuickEditAgentFD(editForm.agentRateFD.replace(/[^0-9.]/g, ''));
      setQuickEditAgentUG(editForm.agentRateUG.replace(/[^0-9.]/g, ''));
      setQuickEditAgentPG(editForm.agentRatePG.replace(/[^0-9.]/g, ''));
      const typeUG = (editForm.routeCommissionTypes?.['BASECHAN_UG'] as 'Percentage' | 'Fixed Fee') || (editForm.commissionType as 'Percentage' | 'Fixed Fee') || 'Percentage';
      const typePG = (editForm.routeCommissionTypes?.['BASECHAN_PG'] as 'Percentage' | 'Fixed Fee') || (editForm.commissionType as 'Percentage' | 'Fixed Fee') || 'Percentage';
      setQuickEditTypeUG(typeUG);
      setQuickEditTypePG(typePG);
    } else {
      const mapping: Record<string, { ug: string; pg: string }> = {
        'EDVOY': { ug: editForm.edvoyUG, pg: editForm.edvoyPG },
        'SI-UK': { ug: editForm.siUkUG, pg: editForm.siUkPG },
        'UAP': { ug: editForm.uapUG, pg: editForm.uapPG },
        'CRIZAC': { ug: editForm.crizacUG, pg: editForm.crizacPG },
        'KC OVERSEAS': { ug: editForm.kcOverseasUG, pg: editForm.kcOverseasPG },
        'AIMS EDUCATION': { ug: editForm.aimsEducationUG, pg: editForm.aimsEducationPG },
      };
      const vals = mapping[aggName] || { ug: '', pg: '' };
      setQuickEditMasterUG(vals.ug.replace(/[^0-9.]/g, ''));
      setQuickEditMasterPG(vals.pg.replace(/[^0-9.]/g, ''));
      const typeUG = (editForm.routeCommissionTypes?.[`${aggName}_UG`] as 'Percentage' | 'Fixed Fee') || (editForm.commissionType as 'Percentage' | 'Fixed Fee') || 'Percentage';
      const typePG = (editForm.routeCommissionTypes?.[`${aggName}_PG`] as 'Percentage' | 'Fixed Fee') || (editForm.commissionType as 'Percentage' | 'Fixed Fee') || 'Percentage';
      setQuickEditTypeUG(typeUG);
      setQuickEditTypePG(typePG);
    }
  };

  const handleSaveQuickEdit = async () => {
    if (!quickEditModalRoute) return;
    setQuickEditSaving(true);
    const aggName = quickEditModalRoute;
    try {
      if (aggName === 'BASECHAN') {
        const nextData: UniversityDetailData = {
          ...editForm,
          masterRateUG: quickEditMasterUG ? (quickEditTypeUG === 'Fixed Fee' ? `£${quickEditMasterUG}` : `${quickEditMasterUG}%`) : '-',
          masterRatePG: quickEditMasterPG ? (quickEditTypePG === 'Fixed Fee' ? `£${quickEditMasterPG}` : `${quickEditMasterPG}%`) : '-',
          agentRateFD: quickEditAgentFD ? (quickEditTypeUG === 'Fixed Fee' ? `£${quickEditAgentFD}` : `${quickEditAgentFD}%`) : '-',
          agentRateUG: quickEditAgentUG ? (quickEditTypeUG === 'Fixed Fee' ? `£${quickEditAgentUG}` : `${quickEditAgentUG}%`) : '-',
          agentRatePG: quickEditAgentPG ? (quickEditTypePG === 'Fixed Fee' ? `£${quickEditAgentPG}` : `${quickEditAgentPG}%`) : '-',
          routeCommissionTypes: {
            ...(editForm.routeCommissionTypes || {}),
            'BASECHAN_UG': quickEditTypeUG,
            'BASECHAN_PG': quickEditTypePG,
            'BASECHAN_FD': quickEditTypeUG,
          },
        };
        setEditForm(nextData);
        if (onSaveUniversity) {
          await onSaveUniversity(nextData);
        }
      } else {
        const ugFormatted = quickEditMasterUG ? (quickEditTypeUG === 'Fixed Fee' ? `£${quickEditMasterUG}` : `${quickEditMasterUG}%`) : '-';
        const pgFormatted = quickEditMasterPG ? (quickEditTypePG === 'Fixed Fee' ? `£${quickEditMasterPG}` : `${quickEditMasterPG}%`) : '-';
        const mapping: Record<string, { ugField: keyof UniversityDetailData; pgField: keyof UniversityDetailData }> = {
          'EDVOY': { ugField: 'edvoyUG', pgField: 'edvoyPG' },
          'SI-UK': { ugField: 'siUkUG', pgField: 'siUkPG' },
          'UAP': { ugField: 'uapUG', pgField: 'uapPG' },
          'CRIZAC': { ugField: 'crizacUG', pgField: 'crizacPG' },
          'KC OVERSEAS': { ugField: 'kcOverseasUG', pgField: 'kcOverseasPG' },
          'AIMS EDUCATION': { ugField: 'aimsEducationUG', pgField: 'aimsEducationPG' },
        };
        const fields = mapping[aggName];
        const nextData: UniversityDetailData = {
          ...editForm,
          ...(fields ? { [fields.ugField]: ugFormatted, [fields.pgField]: pgFormatted } : {}),
          routeCommissionTypes: {
            ...(editForm.routeCommissionTypes || {}),
            [`${aggName}_UG`]: quickEditTypeUG,
            [`${aggName}_PG`]: quickEditTypePG,
          },
        };
        setEditForm(nextData);
        if (onSaveUniversity) {
          await onSaveUniversity(nextData);
        }
      }
      setQuickEditModalRoute(null);
    } catch (err) {
      console.error('Error saving quick edit:', err);
    } finally {
      setQuickEditSaving(false);
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

            {isEditing ? (
              <div className="pt-1">
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Institution Name
                </label>
                <input
                  type="text"
                  value={editForm.university}
                  onChange={(e) => handleInputChange('university', e.target.value)}
                  className="w-full max-w-md px-3 py-1.5 rounded-xl border border-blue-400 bg-white dark:bg-[#18181B] text-slate-900 dark:text-slate-100 font-extrabold text-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  placeholder="University Name"
                />
              </div>
            ) : (
              <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-slate-100 leading-tight">
                {resolvedData.university}
              </h2>
            )}
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {isEditing
                ? 'Editing Specifications Form — Live changes reflect across all routes and top summary cards'
                : 'Master Commission Record & Competitor Aggregator Benchmark Matrix'}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {onShareRate && ratesForUniversity.length > 0 && (
              <button
                type="button"
                onClick={() => onShareRate(ratesForUniversity[0])}
                className="p-2 text-amber-500 hover:bg-amber-100 dark:hover:bg-amber-950/60 rounded-xl transition cursor-pointer"
                title="Share rate card"
              >
                <Share2 className="w-4.5 h-4.5" />
              </button>
            )}

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
          {saveError && (
            <div role="alert" className="rounded-xl border border-rose-400/40 bg-rose-500/10 px-3 py-2 text-sm font-semibold text-rose-700 dark:text-rose-300">
              {saveError}
            </div>
          )}

          {/* Shared Notes Section: Visible to All Roles (Admin, Staff, Agent) */}
          <div className="p-4 bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-900/60 rounded-2xl space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-extrabold text-xs text-indigo-800 dark:text-indigo-300 flex items-center gap-2">
                <StickyNote className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                <span>Institution Directives & Notes (Shared with Admin, Staff, Agents)</span>
              </span>
            </div>
            {isEditing ? (
              <textarea
                value={editForm.notes || ''}
                onChange={(e) => handleInputChange('notes', e.target.value)}
                placeholder="Add special instructions, commission policies, or intake directives for this university..."
                rows={3}
                className="w-full p-2.5 rounded-xl border border-indigo-300 dark:border-indigo-800 bg-white dark:bg-[#18181B] text-slate-900 dark:text-slate-100 font-medium text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
            ) : (
              <p className="text-xs text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">
                {resolvedData.notes?.trim() ? resolvedData.notes : 'No specific directives or notes added for this institution.'}
              </p>
            )}
          </div>

          {/* SECTION 1: Top Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Sub-Agent Rates */}
            <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl space-y-3 relative">
              <div className="flex items-center justify-between border-b border-emerald-500/20 pb-2">
                <h3 className="font-extrabold text-sm text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
                  <Banknote className="w-4 h-4" />
                  Basechan Sub-Agent Rates (Payouts)
                </h3>
                {isAdmin && !isEditing && (
                  <button
                    type="button"
                    onClick={() => openQuickEditModal('BASECHAN')}
                    className="flex items-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400 hover:text-emerald-500 px-2 py-0.5 rounded-lg hover:bg-emerald-500/20 transition cursor-pointer"
                    title="Edit Basechan rates & Agent payouts"
                  >
                    <Pencil className="w-3 h-3" />
                    <span>Edit</span>
                  </button>
                )}
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
            <div className="p-4 bg-indigo-500/10 border border-indigo-500/20 rounded-2xl space-y-3 relative">
              <div className="flex items-center justify-between border-b border-indigo-500/20 pb-2">
                <h3 className="font-extrabold text-sm text-indigo-800 dark:text-indigo-300 flex items-center gap-2">
                  <Building2 className="w-4 h-4" />
                  Master Direct Institutional Contract
                </h3>
                {isAdmin && !isEditing && (
                  <button
                    type="button"
                    onClick={() => openQuickEditModal('BASECHAN')}
                    className="flex items-center gap-1 text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 px-2 py-0.5 rounded-lg hover:bg-indigo-500/20 transition cursor-pointer"
                    title="Edit Master Direct rates"
                  >
                    <Pencil className="w-3 h-3" />
                    <span>Edit</span>
                  </button>
                )}
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

          {/* SECTION 2: Competitor Aggregator Benchmark Routes - List Form */}
          <div className="p-4 bg-slate-100 dark:bg-[#18181B] border border-slate-200 dark:border-[#222F43] rounded-2xl space-y-3">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-[#222F43] pb-2">
              <h3 className="font-extrabold text-sm text-slate-800 dark:text-slate-200 flex items-center gap-2">
                <Award className="w-4 h-4 text-amber-500" />
                Aggregator Routes & Commission Benchmarks
              </h3>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-[#222F43] text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    <th className="py-2 px-3">Route / Portal</th>
                    <th className="py-2 px-3">UG Rate</th>
                    <th className="py-2 px-3">PG Rate</th>
                    <th className="py-2 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-[#222F43] text-xs">
                  {/* Basechan Direct Row */}
                  <tr className="hover:bg-slate-50/50 dark:hover:bg-[#0E1526]/50 transition">
                    <td className="py-2.5 px-3">
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold text-slate-900 dark:text-slate-100">BASECHAN (Direct)</span>
                        {editForm.defaultRoute === 'BASECHAN' && (
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase bg-amber-500/20 text-amber-500 flex items-center gap-0.5">
                            <Star className="w-2.5 h-2.5 fill-amber-500" />
                            Default
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-2.5 px-3">
                      <span className="font-mono font-bold text-slate-700 dark:text-slate-300">
                        {editForm.masterRateUG}
                      </span>
                    </td>
                    <td className="py-2.5 px-3">
                      <span className="font-mono font-bold text-slate-700 dark:text-slate-300">
                        {editForm.masterRatePG}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {isAdmin && (
                          <button
                            type="button"
                            onClick={() => openQuickEditModal('BASECHAN')}
                            className="p-1.5 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/50 rounded-lg transition cursor-pointer"
                            title="Edit Basechan and Agent rates"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {onShareRate && ratesForUniversity.find((r) => (!r.aggregator || r.aggregator.toUpperCase() === 'BASECHAN' || r.aggregator.toUpperCase() === 'DIRECT')) && (
                          <button
                            type="button"
                            onClick={() => {
                              const r = ratesForUniversity.find((item) => (!item.aggregator || item.aggregator.toUpperCase() === 'BASECHAN' || item.aggregator.toUpperCase() === 'DIRECT'));
                              if (r) onShareRate(r);
                            }}
                            className="p-1.5 text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-950/50 rounded-lg transition cursor-pointer"
                            title="Share Basechan rate card"
                          >
                            <Share2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>

                  {/* Third-Party Aggregator Rows */}
                  {aggregatorsList.map((agg) => {
                    const ugRate = ratesForUniversity.find((r) => (r.aggregator || '').toUpperCase() === agg.name.toUpperCase() && r.studyLevel === 'UG');
                    const pgRate = ratesForUniversity.find((r) => (r.aggregator || '').toUpperCase() === agg.name.toUpperCase() && r.studyLevel === 'PG');
                    const anyRate = ugRate || pgRate;
                    const typeUG = editForm.routeCommissionTypes?.[`${agg.name}_UG`] || editForm.commissionType;
                    const typePG = editForm.routeCommissionTypes?.[`${agg.name}_PG`] || editForm.commissionType;

                    return (
                      <tr key={agg.name} className="hover:bg-slate-50/50 dark:hover:bg-[#0E1526]/50 transition">
                        <td className="py-2.5 px-3">
                          <div className="flex items-center gap-2">
                            <span className="font-extrabold text-slate-800 dark:text-slate-200">{agg.name}</span>
                            {editForm.defaultRoute === agg.name && (
                              <span className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase bg-amber-500/20 text-amber-500 flex items-center gap-0.5">
                                <Star className="w-2.5 h-2.5 fill-amber-500" />
                                Default
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-2.5 px-3">
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono font-bold text-slate-700 dark:text-slate-300">{agg.ug}</span>
                            <span className="text-[9px] font-bold px-1 py-0.2 rounded bg-slate-200 dark:bg-slate-800 text-slate-500">
                              {typeUG === 'Fixed Fee' ? '£ Fixed' : '%'}
                            </span>
                          </div>
                        </td>
                        <td className="py-2.5 px-3">
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono font-bold text-slate-700 dark:text-slate-300">{agg.pg}</span>
                            <span className="text-[9px] font-bold px-1 py-0.2 rounded bg-slate-200 dark:bg-slate-800 text-slate-500">
                              {typePG === 'Fixed Fee' ? '£ Fixed' : '%'}
                            </span>
                          </div>
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {isAdmin && (
                              <button
                                type="button"
                                onClick={() => openQuickEditModal(agg.name)}
                                className="p-1.5 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/50 rounded-lg transition cursor-pointer"
                                title={`Edit ${agg.name} rates`}
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                            )}
                            {isAdmin && (
                              <button
                                type="button"
                                onClick={() => {
                                  handleInlineResetRate(agg.name, 'UG');
                                  handleInlineResetRate(agg.name, 'PG');
                                }}
                                disabled={routeSavingKey?.startsWith(agg.name)}
                                className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded-lg transition cursor-pointer"
                                title={`Reset ${agg.name} rates to 0`}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                            {onShareRate && anyRate && (
                              <button
                                type="button"
                                onClick={() => onShareRate(anyRate)}
                                className="p-1.5 text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-950/50 rounded-lg transition cursor-pointer"
                                title={`Share ${agg.name} rate card`}
                              >
                                <Share2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
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

              {/* Single vs Bulk Route Controls Toolbar */}
              <div className="p-3.5 bg-slate-50 dark:bg-[#18181B] border border-slate-200 dark:border-[#222F43] rounded-2xl space-y-3">
                <div className="flex items-center justify-between border-b border-slate-200 dark:border-[#222F43] pb-2">
                  <span className="font-extrabold text-xs text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-blue-500" />
                    <span>Bulk Update Controls (Affect All Routes)</span>
                  </span>
                  <span className="text-[10px] text-slate-500">
                    Apply intake or commission type globally to all routes, or configure each route individually below.
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  {/* Bulk Intake */}
                  <div className="flex items-center justify-between gap-2 p-2 rounded-xl bg-white dark:bg-[#0E1526] border border-slate-200 dark:border-slate-800">
                    <span className="font-bold text-slate-600 dark:text-slate-300">Set All Intakes:</span>
                    <div className="flex items-center gap-1.5">
                      <select
                        value={editForm.baselineIntake}
                        onChange={(e) => handleBulkApplyIntake(e.target.value)}
                        className="px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 font-bold text-xs"
                      >
                        {allKnownIntakes.map((intake) => (
                          <option key={intake} value={intake}>
                            {intake}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => {
                          setActiveRouteKeyForNewIntake(null);
                          setIsAddIntakeOpen(true);
                        }}
                        className="p-1 px-1.5 bg-blue-600 hover:bg-blue-500 text-white font-extrabold rounded-lg text-[10px] flex items-center gap-0.5 cursor-pointer"
                        title="Add New Intake"
                      >
                        <Plus className="w-3 h-3" />
                        <span>Add</span>
                      </button>
                    </div>
                  </div>

                  {/* Bulk Commission Type */}
                  <div className="flex items-center justify-between gap-2 p-2 rounded-xl bg-white dark:bg-[#0E1526] border border-slate-200 dark:border-slate-800">
                    <span className="font-bold text-slate-600 dark:text-slate-300">Set All Commission Types:</span>
                    <select
                      value={editForm.commissionType}
                      onChange={(e) => handleBulkApplyCommissionType(e.target.value)}
                      className="px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 font-bold text-xs"
                    >
                      <option value="Percentage">Percentage (%)</option>
                      <option value="Fixed Fee">Fixed Fee (£)</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Sub-Agent Master Payouts Section */}
              <div className="p-3.5 bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-500/20 rounded-2xl space-y-2">
                <span className="font-extrabold text-xs text-emerald-800 dark:text-emerald-300 uppercase tracking-wider block">
                  Sub-Agent Payout Rates (Independent of Aggregators)
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs font-mono">
                  <div className="p-2 bg-white dark:bg-[#0E1526] rounded-xl flex items-center justify-between border border-emerald-500/20">
                    <span className="text-slate-400 font-sans font-semibold">Agent (FD):</span>
                    <input
                      type="text"
                      value={editForm.agentRateFD}
                      onChange={(e) => handleInputChange('agentRateFD', e.target.value)}
                      className="w-24 text-right font-mono font-bold text-xs p-1 rounded border border-emerald-500/40 bg-white dark:bg-[#0E1526] text-emerald-600 dark:text-emerald-400"
                    />
                  </div>
                  <div className="p-2 bg-white dark:bg-[#0E1526] rounded-xl flex items-center justify-between border border-emerald-500/20">
                    <span className="text-slate-400 font-sans font-semibold">Agent (UG):</span>
                    <input
                      type="text"
                      value={editForm.agentRateUG}
                      onChange={(e) => handleInputChange('agentRateUG', e.target.value)}
                      className="w-24 text-right font-mono font-bold text-xs p-1 rounded border border-emerald-500/40 bg-white dark:bg-[#0E1526] text-emerald-600 dark:text-emerald-400"
                    />
                  </div>
                  <div className="p-2 bg-white dark:bg-[#0E1526] rounded-xl flex items-center justify-between border border-emerald-500/20">
                    <span className="text-slate-400 font-sans font-semibold">Agent (PG):</span>
                    <input
                      type="text"
                      value={editForm.agentRatePG}
                      onChange={(e) => handleInputChange('agentRatePG', e.target.value)}
                      className="w-24 text-right font-mono font-bold text-xs p-1 rounded border border-emerald-500/40 bg-white dark:bg-[#0E1526] text-emerald-600 dark:text-emerald-400"
                    />
                  </div>
                </div>
              </div>

              {/* Per-Route Independent Specification Table (Option A) */}
              <div className="space-y-2 pt-1">
                <span className="font-extrabold text-xs text-slate-800 dark:text-slate-200 uppercase tracking-wider block">
                  Per-Route Independent Settings (Intake, Commission Type & Rates)
                </span>
                <div className="border border-slate-200 dark:border-[#222F43] rounded-2xl overflow-hidden divide-y divide-slate-200 dark:divide-[#222F43]">
                  {[
                    { key: 'BASECHAN', name: 'BASECHAN (Direct Master)', ug: editForm.masterRateUG, pg: editForm.masterRatePG, isDirect: true },
                    { key: 'EDVOY', name: 'EDVOY', ug: editForm.edvoyUG, pg: editForm.edvoyPG },
                    { key: 'SI-UK', name: 'SI-UK', ug: editForm.siUkUG, pg: editForm.siUkPG },
                    { key: 'UAP', name: 'UAP', ug: editForm.uapUG, pg: editForm.uapPG },
                    { key: 'CRIZAC', name: 'CRIZAC', ug: editForm.crizacUG, pg: editForm.crizacPG },
                    { key: 'KC OVERSEAS', name: 'KC OVERSEAS', ug: editForm.kcOverseasUG, pg: editForm.kcOverseasPG },
                    { key: 'AIMS EDUCATION', name: 'AIMS EDUCATION', ug: editForm.aimsEducationUG, pg: editForm.aimsEducationPG },
                  ].map((route) => {
                    const routeIntake = editForm.routeIntakes?.[`${route.key}_UG`] || editForm.baselineIntake;
                    const routeTypeUG = editForm.routeCommissionTypes?.[`${route.key}_UG`] || editForm.commissionType;
                    const routeTypePG = editForm.routeCommissionTypes?.[`${route.key}_PG`] || editForm.commissionType;

                    const handleUgRateChange = (val: string) => {
                      if (route.key === 'BASECHAN') handleInputChange('masterRateUG', val);
                      else if (route.key === 'EDVOY') handleInputChange('edvoyUG', val);
                      else if (route.key === 'SI-UK') handleInputChange('siUkUG', val);
                      else if (route.key === 'UAP') handleInputChange('uapUG', val);
                      else if (route.key === 'CRIZAC') handleInputChange('crizacUG', val);
                      else if (route.key === 'KC OVERSEAS') handleInputChange('kcOverseasUG', val);
                      else if (route.key === 'AIMS EDUCATION') handleInputChange('aimsEducationUG', val);
                    };

                    const handlePgRateChange = (val: string) => {
                      if (route.key === 'BASECHAN') handleInputChange('masterRatePG', val);
                      else if (route.key === 'EDVOY') handleInputChange('edvoyPG', val);
                      else if (route.key === 'SI-UK') handleInputChange('siUkPG', val);
                      else if (route.key === 'UAP') handleInputChange('uapPG', val);
                      else if (route.key === 'CRIZAC') handleInputChange('crizacPG', val);
                      else if (route.key === 'KC OVERSEAS') handleInputChange('kcOverseasPG', val);
                      else if (route.key === 'AIMS EDUCATION') handleInputChange('aimsEducationPG', val);
                    };

                    return (
                      <div
                        key={route.key}
                        className="p-3 bg-white dark:bg-[#0E1526] flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs"
                      >
                        <div className="flex items-center gap-2 min-w-[140px]">
                          <span className="font-extrabold text-slate-800 dark:text-slate-200">
                            {route.name}
                          </span>
                          {editForm.defaultRoute === route.key && (
                            <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400 shrink-0" />
                          )}
                        </div>

                        {/* Route Controls Grid */}
                        <div className="flex flex-wrap items-center gap-2.5">
                          {/* Route Intake Dropdown with + Add */}
                          <div className="flex items-center gap-1 bg-slate-50 dark:bg-[#18181B] p-1 rounded-xl border border-slate-200 dark:border-slate-800">
                            <span className="text-[10px] font-bold text-slate-400 px-1">Intake:</span>
                            <select
                              value={routeIntake}
                              onChange={(e) => {
                                handleRouteIntakeChange(`${route.key}_UG`, e.target.value);
                                handleRouteIntakeChange(`${route.key}_PG`, e.target.value);
                              }}
                              className="px-2 py-0.5 rounded-lg bg-white dark:bg-[#0E1526] border border-slate-300 dark:border-slate-700 font-bold text-xs"
                            >
                              {allKnownIntakes.map((intake) => (
                                <option key={intake} value={intake}>
                                  {intake}
                                </option>
                              ))}
                            </select>
                            <button
                              type="button"
                              onClick={() => {
                                setActiveRouteKeyForNewIntake(`${route.key}_UG`);
                                setIsAddIntakeOpen(true);
                              }}
                              className="p-1 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-950/60 rounded-md transition cursor-pointer"
                              title={`Add intake for ${route.name}`}
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                          </div>

                          {/* Route Commission Type — UG and PG independently */}
                          <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-[#18181B] p-1 rounded-xl border border-slate-200 dark:border-slate-800 flex-wrap">
                            <span className="text-[10px] font-bold text-slate-400 px-1">Type:</span>
                            <div className="flex items-center gap-1">
                              <span className="text-[9px] font-bold text-indigo-400 uppercase">UG</span>
                              <select
                                value={routeTypeUG}
                                onChange={(e) => handleRouteCommissionTypeChange(`${route.key}_UG`, e.target.value)}
                                className="px-1.5 py-0.5 rounded-lg bg-white dark:bg-[#0E1526] border border-slate-300 dark:border-slate-700 font-bold text-xs"
                              >
                                <option value="Percentage">%</option>
                                <option value="Fixed Fee">Fixed (£)</option>
                              </select>
                            </div>
                            <div className="flex items-center gap-1">
                              <span className="text-[9px] font-bold text-violet-400 uppercase">PG</span>
                              <select
                                value={routeTypePG}
                                onChange={(e) => handleRouteCommissionTypeChange(`${route.key}_PG`, e.target.value)}
                                className="px-1.5 py-0.5 rounded-lg bg-white dark:bg-[#0E1526] border border-slate-300 dark:border-slate-700 font-bold text-xs"
                              >
                                <option value="Percentage">%</option>
                                <option value="Fixed Fee">Fixed (£)</option>
                              </select>
                            </div>
                          </div>

                          {/* Route UG & PG Rates */}
                          <div className="flex items-center gap-2">
                            <div className="flex items-center gap-1">
                              <span className="text-[10px] font-bold text-slate-400">UG:</span>
                              <input
                                type="text"
                                value={route.ug}
                                onChange={(e) => handleUgRateChange(e.target.value)}
                                className="w-16 px-1.5 py-1 text-center font-mono font-bold text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#18181B] text-slate-900 dark:text-slate-100"
                                placeholder="UG Rate"
                              />
                            </div>

                            <div className="flex items-center gap-1">
                              <span className="text-[10px] font-bold text-slate-400">PG:</span>
                              <input
                                type="text"
                                value={route.pg}
                                onChange={(e) => handlePgRateChange(e.target.value)}
                                className="w-16 px-1.5 py-1 text-center font-mono font-bold text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#18181B] text-slate-900 dark:text-slate-100"
                                placeholder="PG Rate"
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
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

      {/* Add Intake Modal */}
      <AddIntakeModal
        isOpen={isAddIntakeOpen}
        onClose={() => {
          setIsAddIntakeOpen(false);
          setActiveRouteKeyForNewIntake(null);
        }}
        onAddIntake={handleCreateNewIntake}
        existingIntakes={allKnownIntakes}
      />

      {/* Quick Edit Route Modal */}
      {quickEditModalRoute && (
        <div
          className="fixed inset-0 z-[10000] bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4 animate-backdrop-fade"
          onClick={() => setQuickEditModalRoute(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md bg-white dark:bg-[#0E1526] border border-slate-200 dark:border-[#222F43] rounded-2xl p-5 shadow-2xl space-y-4 text-xs"
          >
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-[#222F43] pb-3">
              <div className="flex items-center gap-2">
                <Pencil className="w-4 h-4 text-blue-500" />
                <h3 className="font-extrabold text-sm text-slate-900 dark:text-slate-100">
                  Edit {quickEditModalRoute === 'BASECHAN' ? 'Basechan & Agent Rates' : `${quickEditModalRoute} Rates`}
                </h3>
              </div>
              <button
                onClick={() => setQuickEditModalRoute(null)}
                className="p-1 text-slate-400 hover:text-slate-200 rounded-lg transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3.5">
              {/* If Basechan, show Agent Rates section */}
              {quickEditModalRoute === 'BASECHAN' && (
                <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl space-y-2.5">
                  <span className="font-bold text-[11px] text-emerald-800 dark:text-emerald-300 block">
                    Basechan Sub-Agent Payout Rates:
                  </span>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 mb-1">Agent FD</label>
                      <input
                        type="text"
                        value={quickEditAgentFD}
                        onChange={(e) => setQuickEditAgentFD(e.target.value)}
                        placeholder="FD Rate"
                        className="w-full px-2 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#18181B] font-mono text-center font-bold"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 mb-1">Agent UG</label>
                      <input
                        type="text"
                        value={quickEditAgentUG}
                        onChange={(e) => setQuickEditAgentUG(e.target.value)}
                        placeholder="UG Rate"
                        className="w-full px-2 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#18181B] font-mono text-center font-bold"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 mb-1">Agent PG</label>
                      <input
                        type="text"
                        value={quickEditAgentPG}
                        onChange={(e) => setQuickEditAgentPG(e.target.value)}
                        placeholder="PG Rate"
                        className="w-full px-2 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#18181B] font-mono text-center font-bold"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Master / Route Rates */}
              <div className="space-y-3">
                {/* UG Level */}
                <div className="p-3 bg-slate-50 dark:bg-[#18181B] rounded-xl border border-slate-200 dark:border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-indigo-600 dark:text-indigo-400">UG Rate</span>
                    <select
                      value={quickEditTypeUG}
                      onChange={(e) => setQuickEditTypeUG(e.target.value as 'Percentage' | 'Fixed Fee')}
                      className="px-2 py-1 rounded bg-white dark:bg-[#0E1526] border border-slate-300 dark:border-slate-700 font-bold text-[11px]"
                    >
                      <option value="Percentage">Percentage (%)</option>
                      <option value="Fixed Fee">Fixed Fee (£)</option>
                    </select>
                  </div>
                  <input
                    type="text"
                    value={quickEditMasterUG}
                    onChange={(e) => setQuickEditMasterUG(e.target.value)}
                    placeholder={quickEditTypeUG === 'Fixed Fee' ? 'e.g. 2500' : 'e.g. 15'}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0E1526] font-mono text-sm font-bold"
                  />
                </div>

                {/* PG Level */}
                <div className="p-3 bg-slate-50 dark:bg-[#18181B] rounded-xl border border-slate-200 dark:border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-violet-600 dark:text-violet-400">PG Rate</span>
                    <select
                      value={quickEditTypePG}
                      onChange={(e) => setQuickEditTypePG(e.target.value as 'Percentage' | 'Fixed Fee')}
                      className="px-2 py-1 rounded bg-white dark:bg-[#0E1526] border border-slate-300 dark:border-slate-700 font-bold text-[11px]"
                    >
                      <option value="Percentage">Percentage (%)</option>
                      <option value="Fixed Fee">Fixed Fee (£)</option>
                    </select>
                  </div>
                  <input
                    type="text"
                    value={quickEditMasterPG}
                    onChange={(e) => setQuickEditMasterPG(e.target.value)}
                    placeholder={quickEditTypePG === 'Fixed Fee' ? 'e.g. 3000' : 'e.g. 20'}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0E1526] font-mono text-sm font-bold"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200 dark:border-[#222F43]">
              <button
                type="button"
                onClick={() => setQuickEditModalRoute(null)}
                className="px-3.5 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={quickEditSaving}
                onClick={handleSaveQuickEdit}
                className="px-4 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold transition flex items-center gap-1.5 disabled:opacity-50 cursor-pointer shadow-xs active:scale-95"
              >
                {quickEditSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                <span>Save Route</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>,
    document.body
  );
};
