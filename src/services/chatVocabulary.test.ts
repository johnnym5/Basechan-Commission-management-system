import { describe, expect, it } from 'vitest';
import { normalizeChatVocabulary } from './chatVocabulary';

describe('chat phrase and spelling library', () => {
  it('normalizes common Nigerian conversational searches', () => {
    expect(normalizeChatVocabulary('Abeg, make I see Focus schools wey get postgraduate')).toBe('show me focus schools with postgraduate');
    expect(normalizeChatVocabulary('how much dem dey pay')).toBe('payout');
  });

  it('corrects frequent query spelling mistakes', () => {
    expect(normalizeChatVocabulary('postgradute universitty focas scholl')).toBe('postgraduate university focus school');
  });
});
