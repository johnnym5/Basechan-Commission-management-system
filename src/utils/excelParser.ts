import * as XLSX from 'xlsx';
import type { CommissionRate } from '../types';

/**
 * Normalizes cell values: blanks, null, undefined, or empty strings resolve to default ("-").
 */
export function cleanVal(val: unknown, defaultVal = '-'): string {
  if (val === undefined || val === null) return defaultVal;
  const s = String(val).trim();
  return s !== '' ? s : defaultVal;
}

/**
 * Canonical university name normalization:
 * Removes noisy prefix/suffix terms ("The", "University of", "University", "College")
 * so "Aberdeen University" and "University of Aberdeen" resolve to identical slugs.
 */
export function normalizeUniversitySlug(name: string): string {
  return name
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
 * Parses numeric percentage or fee strings into clean number and flat fee indicator.
 */
export function parseRateValue(val: unknown): { value: number; isFlatFee: boolean; raw: string } {
  const rawStr = cleanVal(val);
  if (rawStr === '-') {
    return { value: 0, isFlatFee: false, raw: '-' };
  }

  if (typeof val === 'number') {
    if (val > 0 && val < 1) {
      return { value: parseFloat((val * 100).toFixed(2)), isFlatFee: false, raw: `${val * 100}%` };
    }
    return { value: val, isFlatFee: val > 100, raw: String(val) };
  }

  const str = rawStr;
  const isPound = str.includes('£') || str.toLowerCase().includes('gbp');
  const isPercent = str.includes('%');

  const cleaned = str.replace(/[£$,% ]/g, '');
  const num = parseFloat(cleaned);

  if (isNaN(num)) {
    return { value: 0, isFlatFee: isPound, raw: str };
  }

  const finalVal = !isPound && !isPercent && num > 0 && num < 1
    ? parseFloat((num * 100).toFixed(2))
    : num;

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

    // =========================================================================
    // 1. NOTES
    // Col A: Notes and conditions
    // =========================================================================
    if (sheetName === 'NOTES') {
      // Notes are metadata policies, not university commission rows
      continue;
    }

    // =========================================================================
    // 2. RAW DATA
    // - Block 1 (Cols A-D): University, Country, UG - EDVOY, PG - EDVOY
    // - Block 2 (Col G): Reference Institution List
    // =========================================================================
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
      continue;
    }

    // =========================================================================
    // 3. REAL
    // Cols A-L: Code, Location, Universities, Note/Condition,
    //           EDVOY UG/PG, SI-UK UG/PG, UAP UG/PG, CRIZAC UG/PG
    // =========================================================================
    if (sheetName === 'REAL') {
      for (let r = 1; r <= range.e.r; r++) {
        const country = cleanVal(getVal(r, 1));
        const uni = cleanVal(getVal(r, 2));
        const remarks = cleanVal(getVal(r, 3));
        const rowColor = getRowColor([getCell(r, 2), getCell(r, 4), getCell(r, 6), getCell(r, 8), getCell(r, 10)]);

        if (uni === '-' || uni.toLowerCase().includes('total')) continue;
        const uniId = normalizeUniversitySlug(uni);
        uniMap.set(uniId, uni);

        const aggregators = [
          { name: 'EDVOY', ugCol: 4, pgCol: 5 },
          { name: 'SI-UK', ugCol: 6, pgCol: 7 },
          { name: 'UAP', ugCol: 8, pgCol: 9 },
          { name: 'CRIZAC', ugCol: 10, pgCol: 11 },
        ];

        for (const agg of aggregators) {
          const ugVal = parseRateValue(getVal(r, agg.ugCol));
          const pgVal = parseRateValue(getVal(r, agg.pgCol));

          if (ugVal.value > 0) {
            upsertRate({
              id: generateCompositeId(uni, '2025 - 2026', agg.name, 'UG'),
              universityId: uniId,
              universityName: uni,
              country: country !== '-' ? country : undefined,
              intake: '2025 - 2026',
              aggregator: agg.name,
              studyLevel: 'UG',
              masterRate: ugVal.value,
              agentRate: 0,
              diffMargin: ugVal.value,
              isFlatFee: ugVal.isFlatFee,
              netOrGross: 'NET',
              notes: remarks !== '-' ? remarks : undefined,
              rowColor,
              sourceSheet: sheetName,
              sourceRow: r + 1,
              updatedAt: new Date().toISOString(),
            });
          }

          if (pgVal.value > 0) {
            upsertRate({
              id: generateCompositeId(uni, '2025 - 2026', agg.name, 'PG'),
              universityId: uniId,
              universityName: uni,
              country: country !== '-' ? country : undefined,
              intake: '2025 - 2026',
              aggregator: agg.name,
              studyLevel: 'PG',
              masterRate: pgVal.value,
              agentRate: 0,
              diffMargin: pgVal.value,
              isFlatFee: pgVal.isFlatFee,
              netOrGross: 'NET',
              notes: remarks !== '-' ? remarks : undefined,
              rowColor,
              sourceSheet: sheetName,
              sourceRow: r + 1,
              updatedAt: new Date().toISOString(),
            });
          }
        }
      }
      continue;
    }

    // =========================================================================
    // 4. MASTER
    // Cols A-H: Universities, FD - Net, UG - Net, PG - Net, [Blank], M-FD Comms, M-UG Comms, M-PG Comms
    // =========================================================================
    if (sheetName === 'MASTER') {
      for (let r = 1; r <= range.e.r; r++) {
        const uni = cleanVal(getVal(r, 0));
        if (uni === '-' || uni.toLowerCase().includes('total')) continue;
        const uniId = normalizeUniversitySlug(uni);
        uniMap.set(uniId, uni);

        const levels = [
          { level: 'FD' as const, agentCol: 1, masterCol: 5 },
          { level: 'UG' as const, agentCol: 2, masterCol: 6 },
          { level: 'PG' as const, agentCol: 3, masterCol: 7 },
        ];

        const rowColor = getRowColor([getCell(r, 0), getCell(r, 2), getCell(r, 6)]);

        for (const lvl of levels) {
          const agent = parseRateValue(getVal(r, lvl.agentCol));
          const master = parseRateValue(getVal(r, lvl.masterCol));

          if (master.value > 0 || agent.value > 0) {
            upsertRate({
              id: generateCompositeId(uni, '2025 - 2026', 'MASTER', lvl.level),
              universityId: uniId,
              universityName: uni,
              intake: '2025 - 2026',
              aggregator: 'BASECHAN',
              studyLevel: lvl.level,
              masterRate: master.value,
              agentRate: agent.value,
              diffMargin: parseFloat((master.value - agent.value).toFixed(2)),
              isFlatFee: master.isFlatFee || agent.isFlatFee,
              netOrGross: 'NET',
              rowColor,
              sourceSheet: sheetName,
              sourceRow: r + 1,
              updatedAt: new Date().toISOString(),
            });
          }
        }
      }
      continue;
    }

    // =========================================================================
    // 5. Master Comms
    // Cols A-D: Universities, M-FD Comms, M-UG Comms, M-PG Comms
    // Col G: Partner/Aggregator designation (SI-UK, CRIZAC, EDVOY, etc.)
    // =========================================================================
    if (sheetName === 'Master Comms') {
      for (let r = 1; r <= range.e.r; r++) {
        const uni = cleanVal(getVal(r, 0));
        if (uni === '-' || uni.toLowerCase().includes('total')) continue;
        const uniId = normalizeUniversitySlug(uni);
        uniMap.set(uniId, uni);

        const partner = cleanVal(getVal(r, 6), 'BASECHAN');
        const aggName = normalizeAggregatorSlug(partner);

        const levels = [
          { level: 'FD' as const, col: 1 },
          { level: 'UG' as const, col: 2 },
          { level: 'PG' as const, col: 3 },
        ];

        const rowColor = getRowColor([getCell(r, 0), getCell(r, 2), getCell(r, 6)]);

        for (const lvl of levels) {
          const mRate = parseRateValue(getVal(r, lvl.col));
          if (mRate.value > 0) {
            upsertRate({
              id: generateCompositeId(uni, '2025 - 2026', aggName, lvl.level),
              universityId: uniId,
              universityName: uni,
              intake: '2025 - 2026',
              aggregator: aggName,
              studyLevel: lvl.level,
              masterRate: mRate.value,
              agentRate: 0,
              diffMargin: mRate.value,
              isFlatFee: mRate.isFlatFee,
              netOrGross: 'NET',
              rowColor,
              sourceSheet: sheetName,
              sourceRow: r + 1,
              updatedAt: new Date().toISOString(),
            });
          }
        }
      }
      continue;
    }

    // =========================================================================
    // 6. SI-UK Master List
    // Cols A-H: Universities, FD - Net, UG - Net, PG - Net, [Blank], M-FD Comms, M-UG Comms, M-PG Comms
    // =========================================================================
    if (sheetName === 'SI-UK Master List') {
      for (let r = 1; r <= range.e.r; r++) {
        const uni = cleanVal(getVal(r, 0));
        if (uni === '-' || uni.toLowerCase().includes('total')) continue;
        const uniId = normalizeUniversitySlug(uni);
        uniMap.set(uniId, uni);

        const levels = [
          { level: 'FD' as const, netCol: 1, mCol: 5 },
          { level: 'UG' as const, netCol: 2, mCol: 6 },
          { level: 'PG' as const, netCol: 3, mCol: 7 },
        ];

        const rowColor = getRowColor([getCell(r, 0), getCell(r, 2), getCell(r, 6)]);

        for (const lvl of levels) {
          const net = parseRateValue(getVal(r, lvl.netCol));
          const master = parseRateValue(getVal(r, lvl.mCol));

          if (master.value > 0 || net.value > 0) {
            upsertRate({
              id: generateCompositeId(uni, '2025 - 2026', 'SI-UK', lvl.level),
              universityId: uniId,
              universityName: uni,
              intake: '2025 - 2026',
              aggregator: 'SI-UK',
              studyLevel: lvl.level,
              masterRate: master.value > 0 ? master.value : net.value,
              agentRate: 0,
              diffMargin: master.value > 0 ? master.value : net.value,
              isFlatFee: master.isFlatFee || net.isFlatFee,
              netOrGross: 'NET',
              rowColor,
              sourceSheet: sheetName,
              sourceRow: r + 1,
              updatedAt: new Date().toISOString(),
            });
          }
        }
      }
      continue;
    }

    // =========================================================================
    // 7. EDVOY Master List
    // Cols A-D: Universities, FD - Net, UG - Net, PG - Net
    // Cols F-H: M-FD Comms, M-UG Comms, M-PG Comms
    // =========================================================================
    if (sheetName === 'EDVOY Master List') {
      for (let r = 1; r <= range.e.r; r++) {
        const uni = cleanVal(getVal(r, 0));
        if (uni === '-' || uni.toLowerCase().includes('total')) continue;
        const uniId = normalizeUniversitySlug(uni);
        uniMap.set(uniId, uni);

        const levels = [
          { level: 'FD' as const, netCol: 1, mCol: 5 },
          { level: 'UG' as const, netCol: 2, mCol: 6 },
          { level: 'PG' as const, netCol: 3, mCol: 7 },
        ];

        const rowColor = getRowColor([getCell(r, 0), getCell(r, 2), getCell(r, 6)]);

        for (const lvl of levels) {
          const net = parseRateValue(getVal(r, lvl.netCol));
          const master = parseRateValue(getVal(r, lvl.mCol));

          if (master.value > 0 || net.value > 0) {
            upsertRate({
              id: generateCompositeId(uni, '2025 - 2026', 'EDVOY', lvl.level),
              universityId: uniId,
              universityName: uni,
              intake: '2025 - 2026',
              aggregator: 'EDVOY',
              studyLevel: lvl.level,
              masterRate: master.value > 0 ? master.value : net.value,
              agentRate: 0,
              diffMargin: master.value > 0 ? master.value : net.value,
              isFlatFee: master.isFlatFee || net.isFlatFee,
              netOrGross: 'NET',
              rowColor,
              sourceSheet: sheetName,
              sourceRow: r + 1,
              updatedAt: new Date().toISOString(),
            });
          }
        }
      }
      continue;
    }

    // =========================================================================
    // 8. UAP Master List
    // Cols A-H: Universities, FD - Net, UG - Net, PG - Net, [Blank], M-FD Comms, M-UG Comms, M-PG Comms
    // =========================================================================
    if (sheetName === 'UAP Master List') {
      for (let r = 1; r <= range.e.r; r++) {
        const uni = cleanVal(getVal(r, 0));
        if (uni === '-' || uni.toLowerCase().includes('total')) continue;
        const uniId = normalizeUniversitySlug(uni);
        uniMap.set(uniId, uni);

        const levels = [
          { level: 'FD' as const, netCol: 1, mCol: 5 },
          { level: 'UG' as const, netCol: 2, mCol: 6 },
          { level: 'PG' as const, netCol: 3, mCol: 7 },
        ];

        const rowColor = getRowColor([getCell(r, 0), getCell(r, 2), getCell(r, 6)]);

        for (const lvl of levels) {
          const net = parseRateValue(getVal(r, lvl.netCol));
          const master = parseRateValue(getVal(r, lvl.mCol));

          if (master.value > 0 || net.value > 0) {
            upsertRate({
              id: generateCompositeId(uni, '2025 - 2026', 'UAP', lvl.level),
              universityId: uniId,
              universityName: uni,
              intake: '2025 - 2026',
              aggregator: 'UAP',
              studyLevel: lvl.level,
              masterRate: master.value > 0 ? master.value : net.value,
              agentRate: 0,
              diffMargin: master.value > 0 ? master.value : net.value,
              isFlatFee: master.isFlatFee || net.isFlatFee,
              netOrGross: 'NET',
              rowColor,
              sourceSheet: sheetName,
              sourceRow: r + 1,
              updatedAt: new Date().toISOString(),
            });
          }
        }
      }
      continue;
    }

    // =========================================================================
    // 9. CRIZAC Master List
    // Cols A-H: Universities, FD - Net, UG - Net, PG - Net, [Blank], M-FD Comms, M-UG Comms, M-PG Comms
    // =========================================================================
    if (sheetName === 'CRIZAC Master List') {
      for (let r = 1; r <= range.e.r; r++) {
        const uni = cleanVal(getVal(r, 0));
        if (uni === '-' || uni.toLowerCase().includes('total')) continue;
        const uniId = normalizeUniversitySlug(uni);
        uniMap.set(uniId, uni);

        const levels = [
          { level: 'FD' as const, netCol: 1, mCol: 5 },
          { level: 'UG' as const, netCol: 2, mCol: 6 },
          { level: 'PG' as const, netCol: 3, mCol: 7 },
        ];

        const rowColor = getRowColor([getCell(r, 0), getCell(r, 2), getCell(r, 6)]);

        for (const lvl of levels) {
          const net = parseRateValue(getVal(r, lvl.netCol));
          const master = parseRateValue(getVal(r, lvl.mCol));

          if (master.value > 0 || net.value > 0) {
            upsertRate({
              id: generateCompositeId(uni, '2025 - 2026', 'CRIZAC', lvl.level),
              universityId: uniId,
              universityName: uni,
              intake: '2025 - 2026',
              aggregator: 'CRIZAC',
              studyLevel: lvl.level,
              masterRate: master.value > 0 ? master.value : net.value,
              agentRate: 0,
              diffMargin: master.value > 0 ? master.value : net.value,
              isFlatFee: master.isFlatFee || net.isFlatFee,
              netOrGross: 'NET',
              rowColor,
              sourceSheet: sheetName,
              sourceRow: r + 1,
              updatedAt: new Date().toISOString(),
            });
          }
        }
      }
      continue;
    }

    // =========================================================================
    // 10. UK - Agents
    // Primary: Cols A-E (Location, University, A-FD, A-UG, A-PG)
    // Side Lump Sum Block: Cols G-I (M-FD, M-UG, M-PG)
    // Channel Tag: Col L (SI-UK, CRIZAC, etc.)
    // =========================================================================
    if (sheetName === 'UK - Agents') {
      for (let r = 1; r <= range.e.r; r++) {
        const loc = cleanVal(getVal(r, 0));
        const uni = cleanVal(getVal(r, 1));
        if (uni === '-' || uni.toLowerCase().includes('total')) continue;
        const uniId = normalizeUniversitySlug(uni);
        uniMap.set(uniId, uni);

        const aFd = parseRateValue(getVal(r, 2));
        const aUg = parseRateValue(getVal(r, 3));
        const aPg = parseRateValue(getVal(r, 4));

        const sideFd = parseRateValue(getVal(r, 6));
        const sideUg = parseRateValue(getVal(r, 7));
        const sidePg = parseRateValue(getVal(r, 8));

        let partnerTag = cleanVal(getVal(r, 11));
        if (partnerTag === '-') partnerTag = cleanVal(getVal(r, 10));
        if (partnerTag === '-') partnerTag = 'SI-UK';
        const aggName = normalizeAggregatorSlug(partnerTag);

        const rowColor = getRowColor([getCell(r, 1), getCell(r, 3), getCell(r, 7)]);

        const levels = [
          { level: 'FD' as const, agent: aFd, master: sideFd },
          { level: 'UG' as const, agent: aUg, master: sideUg },
          { level: 'PG' as const, agent: aPg, master: sidePg },
        ];

        for (const item of levels) {
          if (item.master.value > 0 || item.agent.value > 0) {
            upsertRate({
              id: generateCompositeId(uni, '2025 - 2026', aggName, item.level),
              universityId: uniId,
              universityName: uni,
              country: loc !== '-' ? loc : 'UK',
              intake: '2025 - 2026',
              aggregator: aggName,
              studyLevel: item.level,
              masterRate: item.master.value,
              agentRate: item.agent.value,
              diffMargin: parseFloat((item.master.value - item.agent.value).toFixed(2)),
              isFlatFee: item.master.isFlatFee || item.agent.isFlatFee,
              netOrGross: 'NET',
              rowColor,
              sourceSheet: sheetName,
              sourceRow: r + 1,
              updatedAt: new Date().toISOString(),
            });
          }
        }
      }
      continue;
    }

    // =========================================================================
    // 11. 2025 AGENT MASTER
    // Col A: Universities, Col B: UG - Net, Col C: PG - Net
    // =========================================================================
    if (sheetName === '2025 AGENT MASTER') {
      for (let r = 1; r <= range.e.r; r++) {
        const uni = cleanVal(getVal(r, 0));
        if (uni === '-' || uni.toLowerCase().includes('total')) continue;
        const uniId = normalizeUniversitySlug(uni);
        uniMap.set(uniId, uni);

        const ugNet = parseRateValue(getVal(r, 1));
        const pgNet = parseRateValue(getVal(r, 2));
        const rowColor = getRowColor([getCell(r, 0), getCell(r, 1), getCell(r, 2)]);

        if (ugNet.value > 0) {
          upsertRate({
            id: generateCompositeId(uni, '2025 Intake', 'BASECHAN', 'UG'),
            universityId: uniId,
            universityName: uni,
            intake: '2025 Intake',
            aggregator: 'BASECHAN',
            studyLevel: 'UG',
            masterRate: ugNet.value,
            agentRate: ugNet.value,
            diffMargin: 0,
            isFlatFee: ugNet.isFlatFee,
            netOrGross: 'NET',
            rowColor,
            sourceSheet: sheetName,
            sourceRow: r + 1,
            updatedAt: new Date().toISOString(),
          });
        }

        if (pgNet.value > 0) {
          upsertRate({
            id: generateCompositeId(uni, '2025 Intake', 'BASECHAN', 'PG'),
            universityId: uniId,
            universityName: uni,
            intake: '2025 Intake',
            aggregator: 'BASECHAN',
            studyLevel: 'PG',
            masterRate: pgNet.value,
            agentRate: pgNet.value,
            diffMargin: 0,
            isFlatFee: pgNet.isFlatFee,
            netOrGross: 'NET',
            rowColor,
            sourceSheet: sheetName,
            sourceRow: r + 1,
            updatedAt: new Date().toISOString(),
          });
        }
      }
      continue;
    }

    // =========================================================================
    // 12. 2026 AGENT MASTER
    // Cols A-G: Universities, Agent UG/PG, Basechan UG/PG, DIFF UG/PG
    // =========================================================================
    if (sheetName === '2026 AGENT MASTER') {
      for (let r = 1; r <= range.e.r; r++) {
        const uni = cleanVal(getVal(r, 0));
        if (uni === '-' || uni.toLowerCase().includes('total')) continue;
        const uniId = normalizeUniversitySlug(uni);
        uniMap.set(uniId, uni);

        const aUg = parseRateValue(getVal(r, 1));
        const aPg = parseRateValue(getVal(r, 2));
        const bUg = parseRateValue(getVal(r, 3));
        const bPg = parseRateValue(getVal(r, 4));

        const rowColor = getRowColor([getCell(r, 0), getCell(r, 1), getCell(r, 3)]);

        if (bUg.value > 0 || aUg.value > 0) {
          upsertRate({
            id: generateCompositeId(uni, '2026 Intakes', 'BASECHAN', 'UG'),
            universityId: uniId,
            universityName: uni,
            intake: '2026 Intakes',
            aggregator: 'BASECHAN',
            studyLevel: 'UG',
            masterRate: bUg.value,
            agentRate: aUg.value,
            diffMargin: parseFloat((bUg.value - aUg.value).toFixed(2)),
            isFlatFee: bUg.isFlatFee || aUg.isFlatFee,
            netOrGross: 'NET',
            rowColor,
            sourceSheet: sheetName,
            sourceRow: r + 1,
            updatedAt: new Date().toISOString(),
          });
        }

        if (bPg.value > 0 || aPg.value > 0) {
          upsertRate({
            id: generateCompositeId(uni, '2026 Intakes', 'BASECHAN', 'PG'),
            universityId: uniId,
            universityName: uni,
            intake: '2026 Intakes',
            aggregator: 'BASECHAN',
            studyLevel: 'PG',
            masterRate: bPg.value,
            agentRate: aPg.value,
            diffMargin: parseFloat((bPg.value - aPg.value).toFixed(2)),
            isFlatFee: bPg.isFlatFee || aPg.isFlatFee,
            netOrGross: 'NET',
            rowColor,
            sourceSheet: sheetName,
            sourceRow: r + 1,
            updatedAt: new Date().toISOString(),
          });
        }
      }
      continue;
    }

    // =========================================================================
    // 13 & 14. 2026 Jan & Sept BIL-AGENT COMMS
    // Cols A-G: Universities, Agent M-FD/UG/PG, Master M-FD/UG/PG
    // Col J: Partner Tag (EDVOY, SI-UK, UAP, etc.)
    // =========================================================================
    if (sheetName.includes('BIL-AGENT COMMS') || sheetName.includes('BIL - AGENT COMMS')) {
      const intakeLabel = sheetName.includes('Jan') ? 'Jan 2026' : 'Sept 2026';
      for (let r = 1; r <= range.e.r; r++) {
        const uni = cleanVal(getVal(r, 0));
        if (uni === '-' || uni.toLowerCase().includes('total')) continue;
        const uniId = normalizeUniversitySlug(uni);
        uniMap.set(uniId, uni);

        const aFd = parseRateValue(getVal(r, 1));
        const aUg = parseRateValue(getVal(r, 2));
        const aPg = parseRateValue(getVal(r, 3));
        const mFd = parseRateValue(getVal(r, 4));
        const mUg = parseRateValue(getVal(r, 5));
        const mPg = parseRateValue(getVal(r, 6));

        const partnerTag = cleanVal(getVal(r, 9), 'BASECHAN');
        const aggName = normalizeAggregatorSlug(partnerTag);

        const rowColor = getRowColor([getCell(r, 0), getCell(r, 2), getCell(r, 5)]);

        const levels = [
          { level: 'FD' as const, agent: aFd, master: mFd },
          { level: 'UG' as const, agent: aUg, master: mUg },
          { level: 'PG' as const, agent: aPg, master: mPg },
        ];

        for (const item of levels) {
          if (item.master.value > 0 || item.agent.value > 0) {
            upsertRate({
              id: generateCompositeId(uni, intakeLabel, aggName, item.level),
              universityId: uniId,
              universityName: uni,
              intake: intakeLabel,
              aggregator: aggName,
              studyLevel: item.level,
              masterRate: item.master.value,
              agentRate: item.agent.value,
              diffMargin: parseFloat((item.master.value - item.agent.value).toFixed(2)),
              isFlatFee: item.master.isFlatFee || item.agent.isFlatFee,
              netOrGross: 'NET',
              rowColor,
              sourceSheet: sheetName,
              sourceRow: r + 1,
              updatedAt: new Date().toISOString(),
            });
          }
        }
      }
      continue;
    }

    // =========================================================================
    // 15. Oct - Feb 2026
    // Dual Header at Rows 1-2, data starts at Row 3 (r = 2 0-indexed)
    // Row 1: Universities, AGENT x3, RAW x3
    // Cols: 0: Uni, 1-3: Agent FD/UG/PG, 4-6: Raw FD/UG/PG
    // =========================================================================
    if (sheetName.includes('Oct - Feb 2026')) {
      for (let r = 2; r <= range.e.r; r++) {
        const uni = cleanVal(getVal(r, 0));
        if (uni === '-' || uni.toLowerCase().includes('total')) continue;
        const uniId = normalizeUniversitySlug(uni);
        uniMap.set(uniId, uni);

        const aFd = parseRateValue(getVal(r, 1));
        const aUg = parseRateValue(getVal(r, 2));
        const aPg = parseRateValue(getVal(r, 3));
        const rFd = parseRateValue(getVal(r, 4));
        const rUg = parseRateValue(getVal(r, 5));
        const rPg = parseRateValue(getVal(r, 6));

        let partnerTag = cleanVal(getVal(r, 9));
        if (partnerTag === '-') partnerTag = cleanVal(getVal(r, 8));
        if (partnerTag === '-') partnerTag = 'SI-UK';
        const aggName = normalizeAggregatorSlug(partnerTag);

        const rowColor = getRowColor([getCell(r, 0), getCell(r, 2), getCell(r, 5)]);

        const levels = [
          { level: 'FD' as const, agent: aFd, master: rFd },
          { level: 'UG' as const, agent: aUg, master: rUg },
          { level: 'PG' as const, agent: aPg, master: rPg },
        ];

        for (const item of levels) {
          if (item.master.value > 0 || item.agent.value > 0) {
            upsertRate({
              id: generateCompositeId(uni, 'Oct - Feb 2026', aggName, item.level),
              universityId: uniId,
              universityName: uni,
              intake: 'Oct - Feb 2026',
              aggregator: aggName,
              studyLevel: item.level,
              masterRate: item.master.value,
              agentRate: item.agent.value,
              diffMargin: parseFloat((item.master.value - item.agent.value).toFixed(2)),
              isFlatFee: item.master.isFlatFee || item.agent.isFlatFee,
              netOrGross: 'NET',
              rowColor,
              sourceSheet: sheetName,
              sourceRow: r + 1,
              updatedAt: new Date().toISOString(),
            });
          }
        }
      }
      continue;
    }
  }

  const finalRates = Array.from(rateMap.values());
  const universities = Array.from(uniMap.entries()).map(([id, name]) => ({ id, name }));
  const duplicatesPrevented = Math.max(0, rawParsedRecordsCount - finalRates.length);

  return {
    rates: finalRates,
    universities,
    sheetNames: workbook.SheetNames,
    totalRowsProcessed: totalRows,
    duplicateCountPrevented: duplicatesPrevented,
    errors,
  };
}
