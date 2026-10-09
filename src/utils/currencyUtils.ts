export type CurrencyCode = 'GBP' | 'USD' | 'EUR' | 'NGN';

export interface CurrencyConfig {
  code: CurrencyCode;
  symbol: string;
  rateToGBP: number; // Conversion multiplier relative to GBP
}

export const CURRENCIES: Record<CurrencyCode, CurrencyConfig> = {
  GBP: { code: 'GBP', symbol: '£', rateToGBP: 1.0 },
  USD: { code: 'USD', symbol: '$', rateToGBP: 1.27 },
  EUR: { code: 'EUR', symbol: '€', rateToGBP: 1.17 },
  NGN: { code: 'NGN', symbol: '₦', rateToGBP: 1950.0 },
};

export const formatCurrencyValue = (
  amountGbp: number,
  currency: CurrencyCode,
  isFlatFee: boolean = true
): string => {
  if (!isFlatFee) {
    return `${amountGbp}%`;
  }

  const config = CURRENCIES[currency] || CURRENCIES.GBP;
  const converted = amountGbp * config.rateToGBP;

  if (currency === 'NGN') {
    return `₦${Math.round(converted).toLocaleString()}`;
  }

  return `${config.symbol}${Math.round(converted).toLocaleString()}`;
};
