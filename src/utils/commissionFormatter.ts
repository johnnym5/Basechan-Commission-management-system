import type { CommissionRate, UserRole } from '../types';

export interface RateComparisonResult {
  isComparable: boolean;
  reason?: string;
  diffMarginDifference?: number;
  agentPayoutDifference?: number;
}

/**
  Formats a numeric commission value with unit (£ or %)
 */
export function formatCommissionValue(
  value: number | undefined | null,
  isFlatFee: boolean,
  currencySymbol = '£'
): string {
  if (value === undefined || value === null || isNaN(value) || !isFinite(value)) {
    return 'N/A';
  }

  if (isFlatFee) {
    return `${currencySymbol}${value.toLocaleString()} per eligible student`;
  }

  return `${value}%`;
}

/**
  Formats a numeric commission difference or margin with unit (percentage points or currency)
 */
export function formatCommissionDifference(
  diff: number | undefined | null,
  isFlatFee: boolean,
  currencySymbol = '£'
): string {
  if (diff === undefined || diff === null || isNaN(diff) || !isFinite(diff)) {
    return 'N/A';
  }

  const sign = diff > 0 ? '+' : '';

  if (isFlatFee) {
    return `${sign}${currencySymbol}${diff.toLocaleString()} per eligible student`;
  }

  return `${sign}${diff} percentage points`;
}

/**
  Formats master commission for display (Admin only)
 */
export function formatMasterCommission(rate: CommissionRate, currencySymbol = '£'): string {
  return formatCommissionValue(rate.masterRate, rate.isFlatFee, currencySymbol);
}

/**
  Formats agent commission payout based on user role
 */
export function formatAgentCommission(
  rate: CommissionRate,
  role: UserRole = 'AGENT',
  currencySymbol = '£'
): string {
  if (role === 'STAFF') {
    return 'N/A (Staff View)';
  }
  return formatCommissionValue(rate.agentRate, rate.isFlatFee, currencySymbol);
}

/**
  Formats net retained margin for display (Admin only)
 */
export function formatNetMargin(rate: CommissionRate, currencySymbol = '£'): string {
  return formatCommissionDifference(rate.diffMargin, rate.isFlatFee, currencySymbol);
}

/**
 * Checks whether two rates share the same rate type (isFlatFee) and calculation basis (netOrGross).
 */
export function areRatesComparable(rateA?: CommissionRate | null, rateB?: CommissionRate | null): boolean {
  if (!rateA || !rateB) return false;
  if (rateA.isFlatFee !== rateB.isFlatFee) return false;
  if (rateA.netOrGross !== rateB.netOrGross) return false;
  return true;
}

/**
 * Safely compares two commission rates, validating unit compatibility and calculation basis.
 */
export function compareCommissionRates(
  rateA: CommissionRate,
  rateB: CommissionRate
): RateComparisonResult {
  if (!rateA || !rateB) {
    return {
      isComparable: false,
      reason: 'Invalid rate objects supplied for comparison.',
    };
  }

  // Check valid numbers
  if (isNaN(rateA.diffMargin) || !isFinite(rateA.diffMargin) || isNaN(rateB.diffMargin) || !isFinite(rateB.diffMargin)) {
    return {
      isComparable: false,
      reason: 'Missing or non-finite margin values supplied for comparison.',
    };
  }

  // 1. Check unit compatibility (Percentage % vs Flat Fee)
  if (rateA.isFlatFee !== rateB.isFlatFee) {
    return {
      isComparable: false,
      reason: 'Incompatible units: Percentage-based commissions (%) and flat-fee monetary amounts cannot be compared directly as equivalent units.',
    };
  }

  // 2. Check net/gross calculation basis compatibility
  if (rateA.netOrGross !== rateB.netOrGross) {
    return {
      isComparable: false,
      reason: `Calculation basis mismatch: ${rateA.universityName} uses ${rateA.netOrGross} tuition while ${rateB.universityName} uses ${rateB.netOrGross} tuition.`,
    };
  }

  const diffMarginDifference = Number((rateA.diffMargin - rateB.diffMargin).toFixed(2));
  const agentPayoutDifference = Number((rateA.agentRate - rateB.agentRate).toFixed(2));

  return {
    isComparable: true,
    diffMarginDifference,
    agentPayoutDifference,
  };
}

/**
 * Finds the best yielding rate in a list among strictly comparable rates.
 * If candidates have mixed units (e.g. flat fee vs percentage) or mixed netOrGross,
 * returns null (or the best within the largest homogeneous cohort if homogeneousOnly = false).
 */
export function findBestComparableRate(
  rates: CommissionRate[]
): { bestRate: CommissionRate | null; isMixed: boolean } {
  const validRates = rates.filter(
    (r) => r && typeof r.diffMargin === 'number' && !isNaN(r.diffMargin) && isFinite(r.diffMargin)
  );

  if (validRates.length === 0) {
    return { bestRate: null, isMixed: false };
  }

  if (validRates.length === 1) {
    return { bestRate: validRates[0], isMixed: false };
  }

  // Check if all rates are mutually comparable
  const first = validRates[0];
  const allComparable = validRates.every((r) => areRatesComparable(first, r));

  if (!allComparable) {
    return { bestRate: null, isMixed: true };
  }

  const best = validRates.reduce((prev, curr) => (curr.diffMargin > prev.diffMargin ? curr : prev), first);
  return { bestRate: best, isMixed: false };
}

