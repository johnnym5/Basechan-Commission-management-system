import { useState, useEffect, useMemo } from 'react';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { CommissionRate } from '../types';

export interface IndexedCommissionRate extends CommissionRate {
  _searchToken: string;
}

export function useCommissionRates() {
  const [rates, setRates] = useState<IndexedCommissionRate[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);

    const q = query(collection(db, 'rates'), orderBy('diffMargin', 'desc'));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const items: IndexedCommissionRate[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data() as CommissionRate;
          // Pre-compute lowercase search token once on snapshot ingestion (O(1) search lookup later)
          const searchToken = [
            data.universityName,
            data.aggregator,
            data.intake,
            data.studyLevel,
            data.country || '',
            data.guidance || 'ALLOWED',
          ]
            .join(' ')
            .toLowerCase();

          items.push({
            ...data,
            _searchToken: searchToken,
          });
        });

        setRates(items);
        setLoading(false);
      },
      (err) => {
        console.error('Firestore real-time subscription error:', err);
        setError('Failed to load real-time commission rates. Please check connection.');
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  // Single-pass KPI calculations
  const stats = useMemo(() => {
    let focusCount = 0;
    let restrictedCount = 0;
    let allowedCount = 0;
    let totalPercentMargin = 0;
    let percentRateCount = 0;
    let bestRateItem: IndexedCommissionRate | null = null;
    const uniSet = new Set<string>();
    const countrySet = new Set<string>();

    for (let i = 0; i < rates.length; i++) {
      const r = rates[i];
      uniSet.add(r.universityId);
      countrySet.add(r.country || 'UK');

      const g = r.guidance || 'ALLOWED';
      if (g === 'FOCUS') focusCount++;
      else if (g === 'DO_NOT_USE') restrictedCount++;
      else allowedCount++;

      if (!r.isFlatFee) {
        totalPercentMargin += r.diffMargin;
        percentRateCount++;
      }

      if (!bestRateItem || r.diffMargin > bestRateItem.diffMargin) {
        bestRateItem = r;
      }
    }

    const avgMargin = percentRateCount > 0 ? (totalPercentMargin / percentRateCount).toFixed(1) : '0.0';

    return {
      totalRates: rates.length,
      totalUniversities: uniSet.size,
      totalCountries: countrySet.size,
      averageMargin: avgMargin,
      bestRate: bestRateItem,
      focusCount,
      restrictedCount,
      allowedCount,
    };
  }, [rates]);

  return { rates, loading, error, stats };
}
