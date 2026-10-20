import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StaffPortalView } from './StaffPortalView';
import type { CommissionRate } from '../types';

vi.mock('../hooks/useSheetVisibility', () => ({
  useSheetVisibility: () => ({
    isSheetDisabled: () => false,
    sheetSettings: [],
    loading: false,
  }),
}));

describe('StaffPortalView - Route selection prioritization', () => {
  it('prioritizes isDefaultRoute === true over guidance === FOCUS', () => {
    const mockRates: CommissionRate[] = [
      {
        id: 'rate-1',
        universityId: 'uni-1',
        universityName: 'Aberdeen University',
        country: 'UK',
        intake: 'Sept 2026',
        aggregator: 'SI-UK',
        studyLevel: 'UG',
        masterRate: 20,
        agentRate: 10,
        diffMargin: 10,
        isFlatFee: false,
        netOrGross: 'GROSS',
        guidance: 'FOCUS',
        isDefaultRoute: false,
      },
      {
        id: 'rate-2',
        universityId: 'uni-1',
        universityName: 'Aberdeen University',
        country: 'UK',
        intake: 'Sept 2026',
        aggregator: 'BASECHAN',
        studyLevel: 'UG',
        masterRate: 25,
        agentRate: 15,
        diffMargin: 10,
        isFlatFee: false,
        netOrGross: 'GROSS',
        guidance: 'ALLOWED',
        isDefaultRoute: true,
      },
    ];

    render(<StaffPortalView rates={mockRates} loading={false} />);

    // Should display the card with BASECHAN, not SI-UK
    expect(screen.getByText('Aberdeen University')).toBeInTheDocument();
    expect(screen.getByText(/Use BASECHAN/i)).toBeInTheDocument();
    expect(screen.queryByText(/Use SI-UK/i)).not.toBeInTheDocument();
  });

  it('falls back to guidance === FOCUS when no isDefaultRoute is set', () => {
    const mockRates: CommissionRate[] = [
      {
        id: 'rate-1',
        universityId: 'uni-1',
        universityName: 'Aberdeen University',
        country: 'UK',
        intake: 'Sept 2026',
        aggregator: 'SI-UK',
        studyLevel: 'UG',
        masterRate: 20,
        agentRate: 10,
        diffMargin: 5,
        isFlatFee: false,
        netOrGross: 'GROSS',
        guidance: 'FOCUS',
        isDefaultRoute: false,
      },
      {
        id: 'rate-2',
        universityId: 'uni-1',
        universityName: 'Aberdeen University',
        country: 'UK',
        intake: 'Sept 2026',
        aggregator: 'EDVOY',
        studyLevel: 'UG',
        masterRate: 25,
        agentRate: 15,
        diffMargin: 12, // higher margin, but SI-UK has FOCUS
        isFlatFee: false,
        netOrGross: 'GROSS',
        guidance: 'ALLOWED',
        isDefaultRoute: false,
      },
    ];

    render(<StaffPortalView rates={mockRates} loading={false} />);

    expect(screen.getByText('Aberdeen University')).toBeInTheDocument();
    expect(screen.getByText(/Use SI-UK/i)).toBeInTheDocument();
    expect(screen.queryByText(/Use EDVOY/i)).not.toBeInTheDocument();
  });
});
