import * as XLSX from 'xlsx';
import type { CommissionRate } from '../types';
import { generateCompositeId, normalizeUniversitySlug } from './excelParser';
import { resolveUniversityCountry } from './countryResolver';

// -------------------------------------------------------------
// TYPE DEFINITIONS & SCHEMAS
// -------------------------------------------------------------
export type RateType = 'PERCENT' | 'FIXED' | 'TBC' | 'NONE';

export interface ParsedRate {
  type: RateType;
  value: number | null;        // Decimals (e.g., 0.15 for 15%) or raw currency float (1800.0)
  displayValue: string | null; // e.g., "15%" or "CAD 1,800.00"
  currency?: string | null;    // "CAD", "USD", "EUR", "GBP", "CHF", etc.
  raw: string;
}

export interface InstitutionMasterRecord {
  id: string;
  country: string;
  university: string;
  commissionType: 'Percentage' | 'Fixed Fee' | 'Mixed (Fee/%)' | 'Unknown';
  baselineIntake: string;

  // Basechan Offered Agent Rates
  agentRateFD: ParsedRate;
  agentRateUG: ParsedRate;
  agentRatePG: ParsedRate;

  // Master Direct Contract Rates
  masterRateUG: ParsedRate;
  masterRatePG: ParsedRate;

  // Competitor Aggregator Benchmarks
  competitors: {
    edvoy: { ug: ParsedRate; pg: ParsedRate };
    siUk: { ug: ParsedRate; pg: ParsedRate };
    uap: { ug: ParsedRate; pg: ParsedRate };
    crizac: { ug: ParsedRate; pg: ParsedRate };
    kcOverseas: { ug: ParsedRate; pg: ParsedRate };
    aimsEducation: { ug: ParsedRate; pg: ParsedRate };
  };

  // Derived Business Analytics
  analytics: {
    grossMarginSpreadUG: number | null; // Master UG - Agent UG (if both are percent)
    grossMarginSpreadPG: number | null; // Master PG - Agent PG (if both are percent)
    bestCompetitorRateUG: { aggregator: string; rate: ParsedRate } | null;
    isBasechanCompetitiveUG: boolean;
  };
}

// -------------------------------------------------------------
// RATE PARSER ENGINE
// -------------------------------------------------------------
export function parseRateCell(input: any): ParsedRate {
  if (input === null || input === undefined) {
    return { type: 'NONE', value: null, displayValue: null, raw: '' };
  }

  const str = String(input).trim();

  // 1. Check for empty / unoffered values
  if (!str || str === '-' || str === '–' || str === '—' || str.toLowerCase() === 'n/a') {
    return { type: 'NONE', value: null, displayValue: null, raw: str };
  }

  // 2. Check for TBC (To Be Confirmed)
  if (str.toUpperCase() === 'TBC') {
    return { type: 'TBC', value: null, displayValue: 'TBC', raw: str };
  }

  // 3. Percentage Parsing (e.g. "10.50%", "15%")
  if (str.includes('%')) {
    const numericPart = parseFloat(str.replace(/[^0-9.-]/g, ''));
    if (!isNaN(numericPart)) {
      return {
        type: 'PERCENT',
        value: numericPart / 100, // Normalized decimal for calculations
        displayValue: `${numericPart}%`,
        currency: null,
        raw: str
      };
    }
  }

  // 4. Currency Fixed Fee Parsing (e.g., "CAD 1,800.00", "USD 2,500.00", "EUR 1,050.00", "CHF 600.00")
  const currencyRegex = /^([A-Z]{3}|\$|€|£)?\s*([\d,]+(?:\.\d+)?)\s*([A-Z]{3})?$/i;
  const match = str.match(currencyRegex);

  if (match) {
    const rawCurrency = (match[1] || match[3] || '').toUpperCase();
    if (rawCurrency) {
      const cleanNumber = parseFloat(match[2].replace(/,/g, ''));

      let normalizedCurrency = 'LOCAL';
      if (rawCurrency.includes('USD') || rawCurrency === '$') normalizedCurrency = 'USD';
      else if (rawCurrency.includes('CAD')) normalizedCurrency = 'CAD';
      else if (rawCurrency.includes('EUR') || rawCurrency === '€') normalizedCurrency = 'EUR';
      else if (rawCurrency.includes('GBP') || rawCurrency === '£') normalizedCurrency = 'GBP';
      else if (rawCurrency.includes('CHF')) normalizedCurrency = 'CHF';

      if (!isNaN(cleanNumber)) {
        return {
          type: 'FIXED',
          value: cleanNumber,
          displayValue: `${normalizedCurrency} ${cleanNumber.toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
          currency: normalizedCurrency,
          raw: str
        };
      }
    }
  }

  // 5. Fallback pure numeric check (e.g., raw numeric in cell like 0.105 or fixed 2000)
  const numericVal = parseFloat(str.replace(/,/g, ''));
  if (!isNaN(numericVal)) {
    // If it's a decimal like 0.15, Excel stored it as a percent
    if (numericVal > 0 && numericVal <= 1) {
      return {
        type: 'PERCENT',
        value: numericVal,
        displayValue: `${(numericVal * 100).toFixed(2)}%`,
        currency: null,
        raw: str
      };
    }
    // Otherwise, treat as flat amount
    return {
      type: 'FIXED',
      value: numericVal,
      displayValue: `${numericVal}`,
      currency: null,
      raw: str
    };
  }

  return { type: 'NONE', value: null, displayValue: null, raw: str };
}

// -------------------------------------------------------------
// WORKBOOK PARSER (Dynamic Row Ingestion)
// -------------------------------------------------------------
export function parseMasterCommissionWorkbook(bufferOrPath: ArrayBuffer | string): {
  metadata: Record<string, any>;
  records: InstitutionMasterRecord[];
  errors: Array<{ row: number; reason: string }>;
} {
  const workbook = typeof bufferOrPath === 'string'
    ? XLSX.readFile(bufferOrPath)
    : XLSX.read(bufferOrPath, { type: 'array' });

  // Locate the target sheet or fallback to sheet 0
  const sheetName = workbook.SheetNames.find(name => name.includes('MASTER') || name.includes('CONSOLIDATED')) || workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];

  // Convert raw sheet data into 2D grid
  const rawRows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

  let headerRowIndex = -1;
  const colMap: Record<string, number> = {};

  // Find header row dynamically (looking for 'Country' and 'University')
  for (let r = 0; r < Math.min(rawRows.length, 15); r++) {
    if (!Array.isArray(rawRows[r])) continue;
    const row = rawRows[r].map(c => String(c).trim().toLowerCase());
    if ((row.includes('country') || row.includes('location')) && (row.includes('university') || row.includes('institution') || row.includes('university name'))) {
      headerRowIndex = r;
      rawRows[r].forEach((cellValue, colIdx) => {
        const normalized = String(cellValue).trim().toLowerCase();
        colMap[normalized] = colIdx;
      });
      break;
    }
  }

  // Fallback: search for university / institution column if country column name differs
  if (headerRowIndex === -1) {
    for (let r = 0; r < Math.min(rawRows.length, 15); r++) {
      if (!Array.isArray(rawRows[r])) continue;
      const row = rawRows[r].map(c => String(c).trim().toLowerCase());
      if (row.includes('university') || row.includes('institution') || row.includes('university name')) {
        headerRowIndex = r;
        rawRows[r].forEach((cellValue, colIdx) => {
          const normalized = String(cellValue).trim().toLowerCase();
          colMap[normalized] = colIdx;
        });
        break;
      }
    }
  }

  if (headerRowIndex === -1) {
    throw new Error('Invalid Document Schema: Unable to locate Header row containing "Country" and "University".');
  }

  // Parse Top Summary Metadata (from rows before the header)
  const metadata: Record<string, any> = {};
  if (headerRowIndex >= 2) {
    const kpiHeaders = rawRows[0];
    const kpiValues = rawRows[1];
    if (Array.isArray(kpiHeaders) && Array.isArray(kpiValues)) {
      kpiHeaders.forEach((k: any, i: number) => {
        if (k && kpiValues[i] !== undefined) {
          metadata[String(k).trim()] = kpiValues[i];
        }
      });
    }
  }

  const records: InstitutionMasterRecord[] = [];
  const errors: Array<{ row: number; reason: string }> = [];

  const getCol = (row: any[], name: string): any => {
    let idx = colMap[name.toLowerCase()];
    if (idx === undefined) {
      const lower = name.toLowerCase();
      if (lower === 'university') {
        idx = colMap['institution'] ?? colMap['university name'];
      } else if (lower === 'country') {
        idx = colMap['location'];
      }
    }
    return idx !== undefined && row[idx] !== undefined ? row[idx] : '';
  };

  // Iterate institution rows
  for (let r = headerRowIndex + 1; r < rawRows.length; r++) {
    const row = rawRows[r];
    if (!Array.isArray(row)) continue;
    const country = String(getCol(row, 'Country')).trim();
    const university = String(getCol(row, 'University')).trim();

    // Skip empty separator rows
    if (!country && !university) continue;

    try {
      const agentRateFD = parseRateCell(getCol(row, 'Agent Rate (FD)'));
      const agentRateUG = parseRateCell(getCol(row, 'Agent Rate (UG)'));
      const agentRatePG = parseRateCell(getCol(row, 'Agent Rate (PG)'));

      const masterRateUG = parseRateCell(getCol(row, 'Master Original Rate (UG)'));
      const masterRatePG = parseRateCell(getCol(row, 'Master Original Rate (PG)'));

      const edvoyUG = parseRateCell(getCol(row, 'EDVOY (UG)'));
      const edvoyPG = parseRateCell(getCol(row, 'EDVOY (PG)'));
      const siUkUG = parseRateCell(getCol(row, 'SI-UK (UG)'));
      const siUkPG = parseRateCell(getCol(row, 'SI-UK (PG)'));
      const uapUG = parseRateCell(getCol(row, 'UAP (UG)'));
      const uapPG = parseRateCell(getCol(row, 'UAP (PG)'));
      const crizacUG = parseRateCell(getCol(row, 'CRIZAC (UG)'));
      const crizacPG = parseRateCell(getCol(row, 'CRIZAC (PG)'));
      const kcOverseasUG = parseRateCell(getCol(row, 'KC OVERSEAS (UG)'));
      const kcOverseasPG = parseRateCell(getCol(row, 'KC OVERSEAS (PG)'));
      const aimsUG = parseRateCell(getCol(row, 'AIMS EDUCATION (UG)'));
      const aimsPG = parseRateCell(getCol(row, 'AIMS EDUCATION (PG)'));

      // Gross Margin Spreads
      let grossMarginSpreadUG: number | null = null;
      if (masterRateUG.type === 'PERCENT' && agentRateUG.type === 'PERCENT' && masterRateUG.value !== null && agentRateUG.value !== null) {
        grossMarginSpreadUG = parseFloat(((masterRateUG.value - agentRateUG.value) * 100).toFixed(2));
      }

      let grossMarginSpreadPG: number | null = null;
      if (masterRatePG.type === 'PERCENT' && agentRatePG.type === 'PERCENT' && masterRatePG.value !== null && agentRatePG.value !== null) {
        grossMarginSpreadPG = parseFloat(((masterRatePG.value - agentRatePG.value) * 100).toFixed(2));
      }

      // Benchmark competitive comparison (UG)
      const competitorRates = [
        { aggregator: 'EDVOY', rate: edvoyUG },
        { aggregator: 'SI-UK', rate: siUkUG },
        { aggregator: 'UAP', rate: uapUG },
        { aggregator: 'CRIZAC', rate: crizacUG },
        { aggregator: 'KC OVERSEAS', rate: kcOverseasUG },
        { aggregator: 'AIMS EDUCATION', rate: aimsUG }
      ].filter(c => c.rate.type === 'PERCENT' && c.rate.value !== null);

      let bestCompetitor: { aggregator: string; rate: ParsedRate } | null = null;
      let isBasechanCompetitiveUG = true;

      if (competitorRates.length > 0) {
        bestCompetitor = competitorRates.reduce((max, c) => ((c.rate.value ?? 0) > (max.rate.value ?? 0) ? c : max), competitorRates[0]);
        if (agentRateUG.type === 'PERCENT' && agentRateUG.value !== null) {
          isBasechanCompetitiveUG = agentRateUG.value >= (bestCompetitor.rate.value ?? 0);
        }
      }

      records.push({
        id: `${country}_${university}_${r}`.replace(/\s+/g, '_').toLowerCase(),
        country,
        university,
        commissionType: (getCol(row, 'Commission Type') as any) || 'Unknown',
        baselineIntake: String(getCol(row, 'Baseline Intake')).trim(),
        agentRateFD,
        agentRateUG,
        agentRatePG,
        masterRateUG,
        masterRatePG,
        competitors: {
          edvoy: { ug: edvoyUG, pg: edvoyPG },
          siUk: { ug: siUkUG, pg: siUkPG },
          uap: { ug: uapUG, pg: uapPG },
          crizac: { ug: crizacUG, pg: crizacPG },
          kcOverseas: { ug: kcOverseasUG, pg: kcOverseasPG },
          aimsEducation: { ug: aimsUG, pg: aimsPG }
        },
        analytics: {
          grossMarginSpreadUG,
          grossMarginSpreadPG,
          bestCompetitorRateUG: bestCompetitor,
          isBasechanCompetitiveUG
        }
      });
    } catch (err: any) {
      errors.push({ row: r + 1, reason: err.message });
    }
  }

  return { metadata, records, errors };
}

/**
 * Utility helper to convert InstitutionMasterRecords into flat CommissionRate[] list for existing UI views.
 */
export function institutionRecordsToCommissionRates(
  records: InstitutionMasterRecord[],
  sheetName = '2027 Master Baseline'
): CommissionRate[] {
  const list: CommissionRate[] = [];

  records.forEach((record) => {
    const universityName = record.university;
    const universityId = normalizeUniversitySlug(universityName);
    const country = resolveUniversityCountry(universityName, record.country) || record.country || 'UK';
    const intake = record.baselineIntake || '2027';

    // Agent FD
    if (record.agentRateFD.type !== 'NONE' && record.agentRateFD.value !== null) {
      const id = generateCompositeId(universityName, intake, 'BASECHAN', 'FD');
      list.push({
        id,
        universityId,
        universityName,
        country,
        intake,
        aggregator: 'BASECHAN',
        studyLevel: 'FD',
        masterRate: record.agentRateFD.value * (record.agentRateFD.type === 'PERCENT' ? 100 : 1),
        agentRate: record.agentRateFD.value * (record.agentRateFD.type === 'PERCENT' ? 100 : 1),
        diffMargin: 0,
        isFlatFee: record.agentRateFD.type === 'FIXED',
        netOrGross: 'NET',
        sourceSheet: sheetName,
        updatedAt: new Date().toISOString(),
      });
    }

    // UG Direct
    const masterUgVal = record.masterRateUG.value ?? record.agentRateUG.value ?? 0;
    const agentUgVal = record.agentRateUG.value ?? 0;
    const isPercentUg = record.agentRateUG.type === 'PERCENT' || record.masterRateUG.type === 'PERCENT';
    const ugMaster = isPercentUg ? masterUgVal * 100 : masterUgVal;
    const ugAgent = isPercentUg ? agentUgVal * 100 : agentUgVal;

    const ugId = generateCompositeId(universityName, intake, 'BASECHAN', 'UG');
    list.push({
      id: ugId,
      universityId,
      universityName,
      country,
      intake,
      aggregator: 'BASECHAN',
      studyLevel: 'UG',
      masterRate: parseFloat(ugMaster.toFixed(2)),
      agentRate: parseFloat(ugAgent.toFixed(2)),
      diffMargin: record.analytics.grossMarginSpreadUG ?? parseFloat((ugMaster - ugAgent).toFixed(2)),
      isFlatFee: record.agentRateUG.type === 'FIXED',
      netOrGross: 'NET',
      sourceSheet: sheetName,
      updatedAt: new Date().toISOString(),
    });

    // PG Direct
    const masterPgVal = record.masterRatePG.value ?? record.agentRatePG.value ?? 0;
    const agentPgVal = record.agentRatePG.value ?? 0;
    const isPercentPg = record.agentRatePG.type === 'PERCENT' || record.masterRatePG.type === 'PERCENT';
    const pgMaster = isPercentPg ? masterPgVal * 100 : masterPgVal;
    const pgAgent = isPercentPg ? agentPgVal * 100 : agentPgVal;

    const pgId = generateCompositeId(universityName, intake, 'BASECHAN', 'PG');
    list.push({
      id: pgId,
      universityId,
      universityName,
      country,
      intake,
      aggregator: 'BASECHAN',
      studyLevel: 'PG',
      masterRate: parseFloat(pgMaster.toFixed(2)),
      agentRate: parseFloat(pgAgent.toFixed(2)),
      diffMargin: record.analytics.grossMarginSpreadPG ?? parseFloat((pgMaster - pgAgent).toFixed(2)),
      isFlatFee: record.agentRatePG.type === 'FIXED',
      netOrGross: 'NET',
      sourceSheet: sheetName,
      updatedAt: new Date().toISOString(),
    });

    // Competitor Benchmark Aggregators (EDVOY, SI-UK, UAP, CRIZAC, KC OVERSEAS, AIMS EDUCATION)
    const competitorMap: Array<{
      aggregator: string;
      ug: ParsedRate;
      pg: ParsedRate;
    }> = [
      { aggregator: 'EDVOY', ug: record.competitors.edvoy.ug, pg: record.competitors.edvoy.pg },
      { aggregator: 'SI-UK', ug: record.competitors.siUk.ug, pg: record.competitors.siUk.pg },
      { aggregator: 'UAP', ug: record.competitors.uap.ug, pg: record.competitors.uap.pg },
      { aggregator: 'CRIZAC', ug: record.competitors.crizac.ug, pg: record.competitors.crizac.pg },
      { aggregator: 'KC OVERSEAS', ug: record.competitors.kcOverseas.ug, pg: record.competitors.kcOverseas.pg },
      { aggregator: 'AIMS EDUCATION', ug: record.competitors.aimsEducation.ug, pg: record.competitors.aimsEducation.pg },
    ];

    competitorMap.forEach(({ aggregator, ug, pg }) => {
      if (ug.type !== 'NONE') {
        const val = ug.value !== null ? (ug.type === 'PERCENT' ? ug.value * 100 : ug.value) : 0;
        const id = generateCompositeId(universityName, intake, aggregator, 'UG');
        list.push({
          id,
          universityId,
          universityName,
          country,
          intake,
          aggregator,
          studyLevel: 'UG',
          masterRate: parseFloat(ugMaster.toFixed(2)),
          agentRate: parseFloat(val.toFixed(2)),
          diffMargin: parseFloat((ugMaster - val).toFixed(2)),
          isFlatFee: ug.type === 'FIXED',
          netOrGross: 'NET',
          notes: ug.type === 'TBC' ? 'Rate Unconfirmed (TBC)' : '',
          sourceSheet: sheetName,
          updatedAt: new Date().toISOString(),
        });
      }

      if (pg.type !== 'NONE') {
        const val = pg.value !== null ? (pg.type === 'PERCENT' ? pg.value * 100 : pg.value) : 0;
        const id = generateCompositeId(universityName, intake, aggregator, 'PG');
        list.push({
          id,
          universityId,
          universityName,
          country,
          intake,
          aggregator,
          studyLevel: 'PG',
          masterRate: parseFloat(pgMaster.toFixed(2)),
          agentRate: parseFloat(val.toFixed(2)),
          diffMargin: parseFloat((pgMaster - val).toFixed(2)),
          isFlatFee: pg.type === 'FIXED',
          netOrGross: 'NET',
          notes: pg.type === 'TBC' ? 'Rate Unconfirmed (TBC)' : '',
          sourceSheet: sheetName,
          updatedAt: new Date().toISOString(),
        });
      }
    });
  });

  return list;
}

export interface KPISummaryMetadata {
  totalInstitutions?: number | null;
  countriesCount?: number | null;
  avgUgPgPercent?: string | number | null;
  targetIntake?: string | null;
  comparedAggregators?: number | null;
}

export function is2027AgentMasterSheet(sheetName: string, rows?: any[][]): boolean {
  const normName = (sheetName || '').trim().toUpperCase();
  if (
    normName.includes('2027 AGENT CONSOLIDATED MASTER') ||
    normName.includes('2027 MASTER BASELINE') ||
    normName.includes('2027 AGENT MASTER') ||
    normName.includes('AGENT CONSOLIDATED MASTER') ||
    (normName.includes('2027') && (normName.includes('MASTER') || normName.includes('CONSOLIDATED') || normName.includes('BASELINE')))
  ) {
    return true;
  }

  if (rows && rows.length > 0) {
    const maxScan = Math.min(15, rows.length);
    for (let r = 0; r < maxScan; r++) {
      const row = rows[r];
      if (!Array.isArray(row)) continue;
      const rowStr = row.map((cell) => String(cell || '').toLowerCase()).join(' ');
      if (
        rowStr.includes('2027 master baseline') ||
        rowStr.includes('2027 agent consolidated master') ||
        (rowStr.includes('baseline fd') && rowStr.includes('baseline ug') && rowStr.includes('baseline pg'))
      ) {
        return true;
      }
    }
  }

  return false;
}

export function parseKPIMetadata(rows: any[][]): KPISummaryMetadata {
  const metadata: KPISummaryMetadata = {};
  if (!rows || rows.length === 0) return metadata;

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
        }
      }
      if (/countries?/i.test(cellVal) && !metadata.countriesCount) {
        const numMatch = cellVal.match(/\d+/);
        if (numMatch) {
          metadata.countriesCount = parseInt(numMatch[0], 10);
        }
      }
      if (/target\s+intake/i.test(cellVal)) {
        const parts = cellVal.split(':');
        if (parts.length > 1 && parts[1].trim()) {
          metadata.targetIntake = parts[1].trim();
        }
      }
    }
  }

  return metadata;
}

export function parseAgentMasterSheet(
  rows: any[][],
  sheetName = '2027 Master Baseline'
): CommissionRate[] {
  if (!rows || rows.length === 0) return [];

  const worksheet = XLSX.utils.aoa_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

  const { records } = parseMasterCommissionWorkbook(buffer);
  return institutionRecordsToCommissionRates(records, sheetName);
}
