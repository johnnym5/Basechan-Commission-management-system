import type { CommissionRate, StudyLevel } from '../types';
import { generateCompositeId, normalizeUniversitySlug } from './excelParser';
import { resolveUniversityCountry } from './countryResolver';

export interface ParsedRateCell {
  raw: string;
  type: 'percentage' | 'fixed_fee' | 'unconfirmed' | 'text';
  value: number | null;
  displayValue: string;
  currency: string | null;
}

export interface KPISummaryMetadata {
  totalInstitutions?: number | null;
  countriesCount?: number | null;
  avgUgPgPercent?: string | number | null;
  targetIntake?: string | null;
  comparedAggregators?: number | null;
}

/**
 * Parses individual Excel rate cell values into structured rate objects.
 */
export function parseRateCell(val: string | number | null | undefined): ParsedRateCell | null {
  if (val === null || val === undefined) return null;

  if (typeof val === 'number') {
    if (isNaN(val) || !isFinite(val) || val === 0) return null;
    if (val > 0 && val <= 1) {
      const percentageValue = parseFloat((val * 100).toFixed(4));
      return {
        raw: String(val),
        type: 'percentage',
        value: percentageValue,
        displayValue: `${percentageValue}%`,
        currency: null,
      };
    }
    return {
      raw: String(val),
      type: 'fixed_fee',
      value: val,
      displayValue: String(val),
      currency: null,
    };
  }

  const s = String(val).trim();
  if (!s || s === '-' || s === '--' || s === '---' || s === ' - ') return null;

  const upper = s.toUpperCase();
  if (upper === 'N/A' || upper === 'NIL' || upper === '#N/A' || upper === '#VALUE!') {
    return null;
  }

  if (upper === 'TBC' || upper === 'TBD' || upper === 'UNCONFIRMED' || upper === 'TO BE CONFIRMED') {
    return {
      raw: s,
      type: 'unconfirmed',
      value: null,
      displayValue: s,
      currency: null,
    };
  }

  if (s.includes('%')) {
    const numericPart = parseFloat(s.replace(/[^0-9.]/g, ''));
    if (!isNaN(numericPart)) {
      return {
        raw: s,
        type: 'percentage',
        value: numericPart,
        displayValue: s,
        currency: null,
      };
    }
  }

  const currencyMatch = s.match(/\b(CAD|USD|EUR|CHF|GBP|AUD|NZD|SGD|HKD|JPY)\b/i) || s.match(/([£$€¥])/);
  if (currencyMatch) {
    let currency: string | null = null;
    const matched = currencyMatch[0];
    if (/[a-zA-Z]/.test(matched)) {
      currency = matched.toUpperCase();
    } else if (matched === '£') {
      currency = 'GBP';
    } else if (matched === '$') {
      currency = 'USD';
    } else if (matched === '€') {
      currency = 'EUR';
    } else if (matched === '¥') {
      currency = 'JPY';
    }

    const cleanNumStr = s.replace(/[^0-9.]/g, '');
    const num = parseFloat(cleanNumStr);
    if (!isNaN(num)) {
      return {
        raw: s,
        type: 'fixed_fee',
        value: num,
        displayValue: s,
        currency,
      };
    }
  }

  const cleanNumericStr = s.replace(/,/g, '');
  if (/^\d+(\.\d+)?$/.test(cleanNumericStr)) {
    const num = parseFloat(cleanNumericStr);
    if (!isNaN(num)) {
      return {
        raw: s,
        type: 'fixed_fee',
        value: num,
        displayValue: s,
        currency: null,
      };
    }
  }

  return {
    raw: s,
    type: 'text',
    value: null,
    displayValue: s,
    currency: null,
  };
}

/**
 * Extracts KPI summary metadata from the top header rows of the sheet.
 */
export function parseKPIMetadata(rows: any[][]): KPISummaryMetadata {
  const metadata: KPISummaryMetadata = {};
  const maxScan = Math.min(10, rows.length);

  for (let r = 0; r < maxScan; r++) {
    const row = rows[r];
    if (!Array.isArray(row)) continue;

    for (let c = 0; c < row.length; c++) {
      const cellVal = String(row[c] || '').trim();
      if (!cellVal) continue;

      if (/total\s+institutions?/i.test(cellVal)) {
        const numMatch = cellVal.match(/\d+/);
        if (numMatch) {
          metadata.totalInstitutions = parseInt(numMatch[0], 10);
        } else if (row[c + 1] !== undefined) {
          const nextVal = parseInt(String(row[c + 1]), 10);
          if (!isNaN(nextVal)) metadata.totalInstitutions = nextVal;
        }
      }

      if (/countries?/i.test(cellVal) && !metadata.countriesCount) {
        const numMatch = cellVal.match(/countries?:\s*(\d+)/i) || cellVal.match(/\b\d+\b/);
        if (cellVal.includes(':') && numMatch) {
          metadata.countriesCount = parseInt(numMatch[1] || numMatch[0], 10);
        } else if (row[c + 1] !== undefined) {
          const nextVal = parseInt(String(row[c + 1]), 10);
          if (!isNaN(nextVal)) metadata.countriesCount = nextVal;
        }
      }

      if (/avg\s+(ug\/pg|commission)?/i.test(cellVal)) {
        const match = cellVal.match(/[\d.]+%?/);
        if (match) {
          metadata.avgUgPgPercent = match[0];
        } else if (row[c + 1] !== undefined) {
          metadata.avgUgPgPercent = String(row[c + 1]).trim();
        }
      }

      if (/target\s+intake/i.test(cellVal)) {
        const parts = cellVal.split(':');
        if (parts.length > 1 && parts[1].trim()) {
          metadata.targetIntake = parts[1].trim();
        } else if (row[c + 1] !== undefined) {
          metadata.targetIntake = String(row[c + 1]).trim();
        }
      }

      if (/compared\s+aggregators?/i.test(cellVal)) {
        const numMatch = cellVal.match(/\d+/);
        if (numMatch) {
          metadata.comparedAggregators = parseInt(numMatch[0], 10);
        } else if (row[c + 1] !== undefined) {
          const nextVal = parseInt(String(row[c + 1]), 10);
          if (!isNaN(nextVal)) metadata.comparedAggregators = nextVal;
        }
      }
    }
  }

  return metadata;
}

const KNOWN_AGGREGATORS = [
  'BASECHAN',
  'EDVOY',
  'SI-UK',
  'UAP',
  'CRIZAC',
  'KC OVERSEAS',
  'AIMS EDUCATION',
];

/**
 * Parses the 2027 Agent Consolidated Master Sheet into Firestore-ready CommissionRate records.
 */
export function parseAgentMasterSheet(
  rows: any[][],
  sheetName = '2027 Master Baseline'
): CommissionRate[] {
  if (!rows || rows.length === 0) return [];

  const metadata = parseKPIMetadata(rows);
  const intake = metadata.targetIntake || '2027';

  let headerRowIdx = -1;
  let uniCol = 0;
  let countryCol = 1;
  let baselineFdCol = 2;
  let baselineUgCol = 3;
  let baselinePgCol = 4;

  const aggCols: Record<string, { ug?: number; pg?: number }> = {
    BASECHAN: { ug: 5, pg: 6 },
    EDVOY: { ug: 7, pg: 8 },
    'SI-UK': { ug: 9, pg: 10 },
    UAP: { ug: 11, pg: 12 },
    CRIZAC: { ug: 13, pg: 14 },
    'KC OVERSEAS': { ug: 15, pg: 16 },
    'AIMS EDUCATION': { ug: 17, pg: 18 },
  };

  for (let r = 0; r < Math.min(15, rows.length); r++) {
    const row = rows[r];
    if (!Array.isArray(row)) continue;

    for (let c = 0; c < row.length; c++) {
      const cell = String(row[c] || '').trim().toLowerCase();
      if (cell === 'institution' || cell === 'university' || cell === 'university name') {
        headerRowIdx = r;
        uniCol = c;
        break;
      }
    }
    if (headerRowIdx !== -1) break;
  }

  if (headerRowIdx !== -1) {
    const headerRow = rows[headerRowIdx];
    for (let c = 0; c < headerRow.length; c++) {
      const h = String(headerRow[c] || '').trim().toLowerCase();
      if (!h) continue;

      if (h.includes('country') || h.includes('location')) countryCol = c;
      else if (h.includes('baseline') && h.includes('fd')) baselineFdCol = c;
      else if (h.includes('baseline') && h.includes('ug')) baselineUgCol = c;
      else if (h.includes('baseline') && h.includes('pg')) baselinePgCol = c;
      else {
        for (const agg of KNOWN_AGGREGATORS) {
          const aggKey = agg.toLowerCase();
          if (h.includes(aggKey)) {
            if (!aggCols[agg]) aggCols[agg] = {};
            if (h.includes('ug')) aggCols[agg].ug = c;
            else if (h.includes('pg')) aggCols[agg].pg = c;
          }
        }
      }
    }
  }

  const startRow = headerRowIdx !== -1 ? headerRowIdx + 1 : 0;
  const rateMap = new Map<string, CommissionRate>();

  for (let r = startRow; r < rows.length; r++) {
    const row = rows[r];
    if (!Array.isArray(row)) continue;

    const rawUni = String(row[uniCol] || '').trim();
    if (!rawUni || rawUni === '-') continue;

    const lowerUni = rawUni.toLowerCase();
    if (
      lowerUni.includes('total') ||
      lowerUni.includes('summary') ||
      lowerUni.includes('average') ||
      lowerUni === 'institution' ||
      lowerUni === 'university'
    ) {
      continue;
    }

    const universityName = rawUni;
    const universityId = normalizeUniversitySlug(universityName);
    const rawCountry = row[countryCol] !== undefined ? String(row[countryCol]).trim() : '';
    const country = resolveUniversityCountry(universityName, rawCountry);

    const parsedBaselineFd = parseRateCell(row[baselineFdCol]);
    const parsedBaselineUg = parseRateCell(row[baselineUgCol]);
    const parsedBaselinePg = parseRateCell(row[baselinePgCol]);

    for (const agg of KNOWN_AGGREGATORS) {
      const cols = aggCols[agg];
      if (!cols) continue;

      const ugVal = cols.ug !== undefined ? row[cols.ug] : undefined;
      const pgVal = cols.pg !== undefined ? row[cols.pg] : undefined;

      const parsedUg = parseRateCell(ugVal);
      const parsedPg = parseRateCell(pgVal);

      const levelConfigs: { level: StudyLevel; cell: ParsedRateCell | null; baselineCell: ParsedRateCell | null }[] = [
        { level: 'UG', cell: parsedUg, baselineCell: parsedBaselineUg },
        { level: 'PG', cell: parsedPg, baselineCell: parsedBaselinePg },
      ];

      for (const { level, cell, baselineCell } of levelConfigs) {
        if (!cell) continue;

        let masterRate = 0;
        let agentRate = 0;

        if (baselineCell && baselineCell.value !== null) {
          masterRate = baselineCell.value;
        } else if (cell.value !== null) {
          masterRate = cell.value;
        }

        if (cell.value !== null) {
          agentRate = cell.value;
        }

        const diffMargin = parseFloat((masterRate - agentRate).toFixed(2));
        const isFlatFee = cell.type === 'fixed_fee';

        let notes: string | undefined;
        if (cell.type === 'unconfirmed') {
          notes = 'Rate Unconfirmed (TBC)';
        } else if (cell.currency) {
          notes = `Currency: ${cell.currency}`;
        }

        const id = generateCompositeId(universityName, intake, agg, level);

        const rateObj: CommissionRate = {
          id,
          universityId,
          universityName,
          country,
          intake,
          aggregator: agg,
          studyLevel: level,
          masterRate,
          agentRate,
          diffMargin,
          isFlatFee,
          netOrGross: 'NET',
          notes,
          sourceSheet: sheetName,
          sourceRow: r + 1,
          updatedAt: new Date().toISOString(),
        };

        rateMap.set(id, rateObj);
      }
    }

    if (parsedBaselineFd && parsedBaselineFd.value !== null) {
      const fdId = generateCompositeId(universityName, intake, 'BASECHAN', 'FD');
      if (!rateMap.has(fdId)) {
        rateMap.set(fdId, {
          id: fdId,
          universityId,
          universityName,
          country,
          intake,
          aggregator: 'BASECHAN',
          studyLevel: 'FD',
          masterRate: parsedBaselineFd.value,
          agentRate: parsedBaselineFd.value,
          diffMargin: 0,
          isFlatFee: parsedBaselineFd.type === 'fixed_fee',
          netOrGross: 'NET',
          sourceSheet: sheetName,
          sourceRow: r + 1,
          updatedAt: new Date().toISOString(),
        });
      }
    }
  }

  return Array.from(rateMap.values());
}
