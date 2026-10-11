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
  Safely compares two commission rates, validating unit compatibility
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

  // 1. Check unit compatibility (Percentage % vs Flat Fee £)
  if (rateA.isFlatFee !== rateB.isFlatFee) {
    return {
      isComparable: false,
      reason: 'Incompatible units: Percentage-based commissions (%) and flat-fee monetary amounts (£) cannot be compared directly as equivalent units.',
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
