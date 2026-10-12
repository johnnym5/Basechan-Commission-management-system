import { describe, it, expect } from 'vitest';
import {
  parseRateCell,
  parseAgentMasterSheet,
  parseKPIMetadata,
  type ParsedRateCell,
} from './agentMasterParser';

describe('agentMasterParser', () => {
  describe('parseRateCell', () => {
    it('returns null for missing, empty, dash, or invalid data', () => {
      expect(parseRateCell(null)).toBeNull();
      expect(parseRateCell(undefined)).toBeNull();
      expect(parseRateCell(NaN)).toBeNull();
      expect(parseRateCell('')).toBeNull();
      expect(parseRateCell('-')).toBeNull();
      expect(parseRateCell('  -  ')).toBeNull();
      expect(parseRateCell('--')).toBeNull();
      expect(parseRateCell('N/A')).toBeNull();
      expect(parseRateCell('NIL')).toBeNull();
    });

    it('parses percentage rate strings', () => {
      const res1 = parseRateCell('21%');
      expect(res1).toEqual<ParsedRateCell>({
        raw: '21%',
        type: 'percentage',
        value: 21,
        displayValue: '21%',
        currency: null,
      });

      const res2 = parseRateCell('10.50%');
      expect(res2).toEqual<ParsedRateCell>({
        raw: '10.50%',
        type: 'percentage',
        value: 10.5,
        displayValue: '10.50%',
        currency: null,
      });
    });

    it('parses numeric decimal representation of percentage', () => {
      const res = parseRateCell(0.21);
      expect(res).toEqual<ParsedRateCell>({
        raw: '0.21',
        type: 'percentage',
        value: 21,
        displayValue: '21%',
        currency: null,
      });
    });

    it('parses currency fixed fee cells', () => {
      const cad = parseRateCell('CAD 1,170.00');
      expect(cad).toEqual<ParsedRateCell>({
        raw: 'CAD 1,170.00',
        type: 'fixed_fee',
        value: 1170,
        displayValue: 'CAD 1,170.00',
        currency: 'CAD',
      });

      const usd = parseRateCell('USD 1,200.00');
      expect(usd).toEqual<ParsedRateCell>({
        raw: 'USD 1,200.00',
        type: 'fixed_fee',
        value: 1200,
        displayValue: 'USD 1,200.00',
        currency: 'USD',
      });

      const eur = parseRateCell('EUR 1,000');
      expect(eur).toEqual<ParsedRateCell>({
        raw: 'EUR 1,000',
        type: 'fixed_fee',
        value: 1000,
        displayValue: 'EUR 1,000',
        currency: 'EUR',
      });

      const chf = parseRateCell('CHF 700');
      expect(chf).toEqual<ParsedRateCell>({
        raw: 'CHF 700',
        type: 'fixed_fee',
        value: 700,
        displayValue: 'CHF 700',
        currency: 'CHF',
      });

      const gbp = parseRateCell('£1,500');
      expect(gbp).toEqual<ParsedRateCell>({
        raw: '£1,500',
        type: 'fixed_fee',
        value: 1500,
        displayValue: '£1,500',
        currency: 'GBP',
      });
    });

    it('parses numeric fixed fee strings and numbers', () => {
      const strFee = parseRateCell('1000');
      expect(strFee).toEqual<ParsedRateCell>({
        raw: '1000',
        type: 'fixed_fee',
        value: 1000,
        displayValue: '1000',
        currency: null,
      });

      const numFee = parseRateCell(1200);
      expect(numFee).toEqual<ParsedRateCell>({
        raw: '1200',
        type: 'fixed_fee',
        value: 1200,
        displayValue: '1200',
        currency: null,
      });
    });

    it('parses unconfirmed TBC cells', () => {
      const res = parseRateCell('TBC');
      expect(res).toEqual<ParsedRateCell>({
        raw: 'TBC',
        type: 'unconfirmed',
        value: null,
        displayValue: 'TBC',
        currency: null,
      });

      const tbd = parseRateCell('tbd');
      expect(tbd?.type).toBe('unconfirmed');
    });

    it('parses general text cells', () => {
      const text = parseRateCell('Conditional approval');
      expect(text).toEqual<ParsedRateCell>({
        raw: 'Conditional approval',
        type: 'text',
        value: null,
        displayValue: 'Conditional approval',
        currency: null,
      });
    });
  });

  describe('parseKPIMetadata', () => {
    it('extracts KPI summary metadata when present in header rows', () => {
      const mockRows = [
        ['2027 Master Baseline - Consolidated Summary'],
        ['Total Institutions: 150', 'Countries: 4', 'Avg UG/PG %: 18.5%'],
        ['Target Intake: Sept 2027', 'Compared Aggregators: 7'],
        [],
      ];

      const metadata = parseKPIMetadata(mockRows);
      expect(metadata.totalInstitutions).toBe(150);
      expect(metadata.countriesCount).toBe(4);
      expect(metadata.avgUgPgPercent).toBe('18.5%');
      expect(metadata.targetIntake).toBe('Sept 2027');
      expect(metadata.comparedAggregators).toBe(7);
    });
  });

  describe('parseAgentMasterSheet', () => {
    it('parses 2027 Master Baseline data rows with 7 aggregators into CommissionRate objects', () => {
      const mockRows = [
        ['2027 Master Baseline - Summary'],
        ['Total Institutions: 2', 'Target Intake: 2027'],
        [
          'Institution', 'Country', 'Baseline FD', 'Baseline UG', 'Baseline PG',
          'Basechan (UG)', 'Basechan (PG)',
          'EDVOY (UG)', 'EDVOY (PG)',
          'SI-UK (UG)', 'SI-UK (PG)',
          'UAP (UG)', 'UAP (PG)',
          'CRIZAC (UG)', 'CRIZAC (PG)',
          'KC OVERSEAS (UG)', 'KC OVERSEAS (PG)',
          'AIMS EDUCATION (UG)', 'AIMS EDUCATION (PG)',
        ],
        [
          'University of Toronto', 'Canada', '10%', '20%', '22%',
          '18%', '20%',
          'CAD 1,170.00', 'CAD 1,500.00',
          '17%', '19%',
          '15%', '17%',
          'TBC', '18%',
          '14%', '16%',
          '-', '15%',
        ],
        [
          'Coventry University', 'UK', '-', '18%', '20%',
          '16%', '18%',
          '-', '-',
          '15%', '17%',
          '-', '-',
          '-', '-',
          '-', '-',
          '-', '-',
        ],
      ];

      const rates = parseAgentMasterSheet(mockRows, '2027 Master Baseline');

      expect(rates.length).toBeGreaterThan(0);

      // Check Toronto Basechan UG
      const torontoBasechanUG = rates.find(
        (r) => r.universityName === 'University of Toronto' && r.aggregator === 'BASECHAN' && r.studyLevel === 'UG'
      );
      expect(torontoBasechanUG).toBeDefined();
      expect(torontoBasechanUG?.masterRate).toBe(20);
      expect(torontoBasechanUG?.agentRate).toBe(18);
      expect(torontoBasechanUG?.diffMargin).toBe(2);
      expect(torontoBasechanUG?.isFlatFee).toBe(false);
      expect(torontoBasechanUG?.country).toBe('Canada');
      expect(torontoBasechanUG?.intake).toBe('2027');

      // Check Toronto EDVOY UG (CAD 1,170.00)
      const torontoEdvoyUG = rates.find(
        (r) => r.universityName === 'University of Toronto' && r.aggregator === 'EDVOY' && r.studyLevel === 'UG'
      );
      expect(torontoEdvoyUG).toBeDefined();
      expect(torontoEdvoyUG?.agentRate).toBe(1170);
      expect(torontoEdvoyUG?.isFlatFee).toBe(true);

      // Check Toronto CRIZAC UG (TBC)
      const torontoCrizacUG = rates.find(
        (r) => r.universityName === 'University of Toronto' && r.aggregator === 'CRIZAC' && r.studyLevel === 'UG'
      );
      expect(torontoCrizacUG).toBeDefined();
      expect(torontoCrizacUG?.notes).toContain('TBC');

      // Check Coventry SI-UK UG
      const coventrySiukUG = rates.find(
        (r) => r.universityName === 'Coventry University' && r.aggregator === 'SI-UK' && r.studyLevel === 'UG'
      );
      expect(coventrySiukUG).toBeDefined();
      expect(coventrySiukUG?.masterRate).toBe(18);
      expect(coventrySiukUG?.agentRate).toBe(15);
      expect(coventrySiukUG?.diffMargin).toBe(3);

      // Verify no rates created for empty "-" cells (like Coventry EDVOY)
      const coventryEdvoyUG = rates.find(
        (r) => r.universityName === 'Coventry University' && r.aggregator === 'EDVOY' && r.studyLevel === 'UG'
      );
      expect(coventryEdvoyUG).toBeUndefined();
    });
  });
});
