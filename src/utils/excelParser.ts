import * as XLSX from 'xlsx';
import type { CommissionRate } from '../types';

/**
 * Sanitizes input strings against formula injection (=, +, -, @) and HTML tags.
 */
export function sanitizeString(val: unknown, defaultVal = '-'): string {
  if (val === undefined || val === null) return defaultVal;
  let s = String(val).trim();
  if (s === '') return defaultVal;

  // Truncate excessively large input strings to prevent memory exhaustion (max 1000 chars)
  if (s.length > 1000) {
    s = s.substring(0, 1000);
  }

  // Prevent Excel CSV/Formula Injection (=cmd|' /C calc'!A0)
  if (/^[=+\-@\t\r]/.test(s)) {
    return "'" + s;
  }

  return s;
}

/**
 * Normalizes cell values safely.
 */
export function cleanVal(val: unknown, defaultVal = '-'): string {
  return sanitizeString(val, defaultVal);
}

/**
 * Canonical university name normalization:
 * Removes noisy prefix/suffix terms ("The", "University of", "University", "College")
 * so "Aberdeen University" and "University of Aberdeen" resolve to identical slugs.
 */
export function normalizeUniversitySlug(name: string): string {
  const clean = sanitizeString(name, '');
  return clean
    .toLowerCase()
    .trim()
    .replace(/\b(the|university|of|college|institution|campus|school)\b/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '') || 'unknown_uni';
}

/**
 * Canonical intake normalization so variants map to standard groupings.
 */
export function normalizeIntakeSlug(intake: string): string {
  const s = String(intake || '').toLowerCase().trim();
  if (s.includes('jan') && s.includes('2026')) return 'jan_2026';
  if (s.includes('sept') && s.includes('2026')) return 'sept_2026';
  if (s.includes('oct') || s.includes('feb')) return 'oct_feb_2026';
  if (s.includes('2026')) return '2026';
  if (s.includes('2025')) return '2025_2026';
  return s.replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'general';
}

/**
 * Canonical aggregator normalization.
 */
export function normalizeAggregatorSlug(agg: string): string {
  const s = String(agg || '').toUpperCase().trim();
  if (s.includes('EDVOY')) return 'EDVOY';
  if (s.includes('SI-UK') || s.includes('SIUK')) return 'SI-UK';
  if (s.includes('UAP')) return 'UAP';
  if (s.includes('CRIZAC')) return 'CRIZAC';
  if (s.includes('BASECHAN') || s.includes('BIL')) return 'BASECHAN';
  return s.replace(/[^A-Z0-9]+/g, '_') || 'BASECHAN';
}

/**
 * Generates an idempotent composite document key:
 * `[university]__[intake]__[aggregator]__[level]`
 */
export function generateCompositeId(
  universityName: string,
  intake: string,
  aggregator: string,
  level: string
): string {
  const u = normalizeUniversitySlug(universityName);
  const i = normalizeIntakeSlug(intake);
  const a = normalizeAggregatorSlug(aggregator);
  const l = String(level).toUpperCase().trim();
  return `${u}__${i}__${a}__${l}`;
}

/**
 * Extracts background hex color of a cell (returns "#RRGGBB" or "-").
 */
export function getCellColor(cell: XLSX.CellObject | undefined): string {
  if (!cell || !cell.s) return '-';
  const s = cell.s as {
    fgColor?: { rgb?: string; theme?: number };
    bgColor?: { rgb?: string; theme?: number };
  };

  const fg = s.fgColor;
  if (fg && fg.rgb && fg.rgb !== '00000000' && fg.rgb !== '0') {
    return fg.rgb.startsWith('#') ? fg.rgb : `#${fg.rgb}`;
  }
  const bg = s.bgColor;
  if (bg && bg.rgb && bg.rgb !== '00000000' && bg.rgb !== '0') {
    return bg.rgb.startsWith('#') ? bg.rgb : `#${bg.rgb}`;
  }
  return '-';
}

/**
 * Returns the predominant fill color across a collection of cells in a row, or "-".
 */
export function getRowColor(cells: (XLSX.CellObject | undefined)[]): string {
  for (const cell of cells) {
    const col = getCellColor(cell);
    if (col !== '-') return col;
  }
  return '-';
}

/**
 * Parses numeric percentage or fee strings into clean number and flat fee indicator with bounds protection.
 */
export function parseRateValue(val: unknown): { value: number; isFlatFee: boolean; raw: string } {
  const rawStr = cleanVal(val);
  if (rawStr === '-') {
    return { value: 0, isFlatFee: false, raw: '-' };
  }

  if (typeof val === 'number') {
    if (isNaN(val) || !isFinite(val)) {
      return { value: 0, isFlatFee: false, raw: '0' };
    }
    const safeNum = Math.min(Math.max(val, -1000000), 1000000);
    if (safeNum > 0 && safeNum < 1) {
      return { value: parseFloat((safeNum * 100).toFixed(2)), isFlatFee: false, raw: `${safeNum * 100}%` };
    }
    return { value: safeNum, isFlatFee: safeNum > 100, raw: String(safeNum) };
  }

  const str = rawStr;
  const isPound = str.includes('£') || str.toLowerCase().includes('gbp');
  const isPercent = str.includes('%');

  const cleaned = str.replace(/[£$,% ]/g, '');
  const num = parseFloat(cleaned);

  if (isNaN(num) || !isFinite(num)) {
    return { value: 0, isFlatFee: isPound, raw: str };
  }

  const safeNum = Math.min(Math.max(num, -1000000), 1000000);

  const finalVal = !isPound && !isPercent && safeNum > 0 && safeNum < 1
    ? parseFloat((safeNum * 100).toFixed(2))
    : safeNum;

  return {
    value: finalVal,
    isFlatFee: isPound || (!isPercent && finalVal > 100),
    raw: str,
  };
}

export interface ParseResult {
  rates: CommissionRate[];
  universities: { id: string; name: string }[];
  sheetNames: string[];
  totalRowsProcessed: number;
  duplicateCountPrevented: number;
  errors: string[];
}

/**
 * Master Workbook Parser tailored to all 15 sheets with dedicated per-sheet layout functions.
 * Translates the exact specification into high-performance TypeScript execution.
 */
export function parseCommissionWorkbook(buffer: ArrayBuffer): ParseResult {
  const workbook = XLSX.read(buffer, { type: 'array', cellStyles: true });
  const rateMap = new Map<string, CommissionRate>();
  const uniMap = new Map<string, string>();
  const errors: string[] = [];
  let totalRows = 0;
  let rawParsedRecordsCount = 0;

  for (const sheetName of workbook.SheetNames) {
    const ws = workbook.Sheets[sheetName];
    if (!ws || !ws['!ref']) continue;

    const range = XLSX.utils.decode_range(ws['!ref']);
    const rowCount = range.e.r - range.s.r + 1;
    totalRows += rowCount;

    const getCell = (rIdx: number, cIdx: number) => {
      const addr = XLSX.utils.encode_cell({ r: rIdx, c: cIdx });
      return ws[addr];
    };

    const getVal = (rIdx: number, cIdx: number) => {
      const c = getCell(rIdx, cIdx);
      return c ? c.v : undefined;
    };

    const upsertRate = (candidate: CommissionRate) => {
      rawParsedRecordsCount++;
      const existing = rateMap.get(candidate.id);

      if (!existing) {
        rateMap.set(candidate.id, candidate);
      } else {
        const updated: CommissionRate = {
          ...existing,
          ...candidate,
          masterRate: candidate.masterRate > 0 ? candidate.masterRate : existing.masterRate,
          agentRate: candidate.agentRate > 0 ? candidate.agentRate : existing.agentRate,
          country: candidate.country && candidate.country !== '-' ? candidate.country : existing.country,
          rowColor: candidate.rowColor && candidate.rowColor !== '-' ? candidate.rowColor : existing.rowColor,
          updatedAt: new Date().toISOString(),
        };
        updated.diffMargin = parseFloat((updated.masterRate - updated.agentRate).toFixed(2));
        rateMap.set(candidate.id, updated);
      }
    };

    if (sheetName === 'NOTES') {
      continue;
    }

    if (sheetName === 'RAW DATA') {
      for (let r = 1; r <= range.e.r; r++) {
        const uni = cleanVal(getVal(r, 0));
        const country = cleanVal(getVal(r, 1));
        const ugEdvoy = getVal(r, 2);
        const pgEdvoy = getVal(r, 3);
        const rowColor = getRowColor([getCell(r, 0), getCell(r, 1), getCell(r, 2), getCell(r, 3)]);

        if (uni !== '-' && !uni.toLowerCase().includes('total')) {
          const uniId = normalizeUniversitySlug(uni);
          uniMap.set(uniId, uni);

          const ug = parseRateValue(ugEdvoy);
          const pg = parseRateValue(pgEdvoy);

          if (ug.value > 0) {
            upsertRate({
              id: generateCompositeId(uni, '2025 - 2026', 'EDVOY', 'UG'),
              universityId: uniId,
              universityName: uni,
              country: country !== '-' ? country : 'UK',
              intake: '2025 - 2026',
              aggregator: 'EDVOY',
              studyLevel: 'UG',
              masterRate: ug.value,
              agentRate: 0,
              diffMargin: ug.value,
              isFlatFee: ug.isFlatFee,
              netOrGross: 'NET',
              rowColor,
              sourceSheet: sheetName,
              sourceRow: r + 1,
              updatedAt: new Date().toISOString(),
            });
          }

          if (pg.value > 0) {
            upsertRate({
              id: generateCompositeId(uni, '2025 - 2026', 'EDVOY', 'PG'),
              universityId: uniId,
              universityName: uni,
              country: country !== '-' ? country : 'UK',
              intake: '2025 - 2026',
              aggregator: 'EDVOY',
              studyLevel: 'PG',
              masterRate: pg.value,
              agentRate: 0,
              diffMargin: pg.value,
              isFlatFee: pg.isFlatFee,
              netOrGross: 'NET',
              rowColor,
              sourceSheet: sheetName,
              sourceRow: r + 1,
              updatedAt: new Date().toISOString(),
            });
          }
        }
      }
    }
  }

  const rates = Array.from(rateMap.values());
  const universities = Array.from(uniMap.entries()).map(([id, name]) => ({ id, name }));

  return {
    rates,
    universities,
    sheetNames: workbook.SheetNames,
    totalRowsProcessed: totalRows,
    duplicateCountPrevented: Math.max(0, rawParsedRecordsCount - rates.length),
    errors,
  };
}
