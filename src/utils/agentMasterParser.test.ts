import { describe, it, expect } from 'vitest';
import {
  parseRateCell,
  type ParsedRate,
} from './agentMasterParser';

describe('agentMasterParser', () => {
  describe('parseRateCell', () => {
    it('returns NONE for missing, empty, dash, or invalid data', () => {
      expect(parseRateCell(null)).toEqual<ParsedRate>({
        type: 'NONE', value: null, displayValue: null, raw: ''
      });
      expect(parseRateCell(undefined)).toEqual<ParsedRate>({
        type: 'NONE', value: null, displayValue: null, raw: ''
      });
      expect(parseRateCell('')).toEqual<ParsedRate>({
        type: 'NONE', value: null, displayValue: null, raw: ''
      });
      expect(parseRateCell('-')).toEqual<ParsedRate>({
        type: 'NONE', value: null, displayValue: null, raw: '-'
      });
      expect(parseRateCell('  -  ')).toEqual<ParsedRate>({
        type: 'NONE', value: null, displayValue: null, raw: '-'
      });
      expect(parseRateCell('–')).toEqual<ParsedRate>({
        type: 'NONE', value: null, displayValue: null, raw: '–'
      });
      expect(parseRateCell('N/A')).toEqual<ParsedRate>({
        type: 'NONE', value: null, displayValue: null, raw: 'N/A'
      });
    });

    it('parses percentage rate strings', () => {
      const res1 = parseRateCell('21%');
      expect(res1).toEqual<ParsedRate>({
        type: 'PERCENT',
        value: 0.21,
        displayValue: '21%',
        currency: null,
        raw: '21%',
      });

      const res2 = parseRateCell('10.50%');
      expect(res2).toEqual<ParsedRate>({
        type: 'PERCENT',
        value: 0.105,
        displayValue: '10.5%',
        currency: null,
        raw: '10.50%',
      });
    });

    it('parses numeric decimal representation of percentage', () => {
      const res = parseRateCell(0.21);
      expect(res).toEqual<ParsedRate>({
        type: 'PERCENT',
        value: 0.21,
        displayValue: '21.00%',
        currency: null,
        raw: '0.21',
      });
    });

    it('parses currency fixed fee cells', () => {
      const cad = parseRateCell('CAD 1,800.00');
      expect(cad).toEqual<ParsedRate>({
        type: 'FIXED',
        value: 1800,
        displayValue: 'CAD 1,800.00',
        currency: 'CAD',
        raw: 'CAD 1,800.00',
      });

      const usd = parseRateCell('USD 2,500.00');
      expect(usd).toEqual<ParsedRate>({
        type: 'FIXED',
        value: 2500,
        displayValue: 'USD 2,500.00',
        currency: 'USD',
        raw: 'USD 2,500.00',
      });

      const eur = parseRateCell('EUR 1,050.00');
      expect(eur).toEqual<ParsedRate>({
        type: 'FIXED',
        value: 1050,
        displayValue: 'EUR 1,050.00',
        currency: 'EUR',
        raw: 'EUR 1,050.00',
      });

      const chf = parseRateCell('CHF 600.00');
      expect(chf).toEqual<ParsedRate>({
        type: 'FIXED',
        value: 600,
        displayValue: 'CHF 600.00',
        currency: 'CHF',
        raw: 'CHF 600.00',
      });

      const gbp = parseRateCell('£1,500');
      expect(gbp).toEqual<ParsedRate>({
        type: 'FIXED',
        value: 1500,
        displayValue: 'GBP 1,500.00',
        currency: 'GBP',
        raw: '£1,500',
      });
    });

    it('parses numeric fixed fee strings and numbers', () => {
      const numFee = parseRateCell(2000);
      expect(numFee).toEqual<ParsedRate>({
        type: 'FIXED',
        value: 2000,
        displayValue: '2000',
        currency: null,
        raw: '2000',
      });
    });

    it('parses unconfirmed TBC cells', () => {
      const res = parseRateCell('TBC');
      expect(res).toEqual<ParsedRate>({
        type: 'TBC',
        value: null,
        displayValue: 'TBC',
        raw: 'TBC',
      });
    });
  });

  describe('parseMasterCommissionWorkbook', () => {
    it('successfully parses 2027 Agent Consolidated Master.xlsx file', async () => {
      const path = 'C:/Users/HP/Documents/CODING/BASECHAN COMMISSION MANAGEMENT SYSTEM/2027 Agent Consolidated Master.xlsx';
      const { parseMasterCommissionWorkbook, institutionRecordsToCommissionRates } = await import('./agentMasterParser');
      const result = parseMasterCommissionWorkbook(path);

      expect(result.records).toBeDefined();
      expect(result.records.length).toBe(328);

      const flatRates = institutionRecordsToCommissionRates(result.records);
      expect(flatRates.length).toBe(1503);
    });
  });
});
