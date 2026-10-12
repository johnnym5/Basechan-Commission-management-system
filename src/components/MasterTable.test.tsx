import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MasterTable } from './MasterTable';
import type { CommissionRate } from '../types';
import type { SearchToken } from '../types/search';

const mockData: CommissionRate[] = [
  {
    id: 'rate-1',
    universityId: 'u-leicester',
    universityName: 'University of Leicester',
    country: 'UK',
    intake: 'Sept 2026',
    studyLevel: 'PG',
    aggregator: 'SI-UK',
    masterRate: 20,
    agentRate: 15,
    diffMargin: 5,
    isFlatFee: false,
    netOrGross: 'GROSS',
    guidance: 'FOCUS',
  },
  {
    id: 'rate-2',
    universityId: 'u-coventry',
    universityName: 'Coventry University',
    country: 'UK',
    intake: 'Jan 2026',
    studyLevel: 'UG',
    aggregator: 'Edvoy',
    masterRate: 15,
    agentRate: 12,
    diffMargin: 3,
    isFlatFee: false,
    netOrGross: 'GROSS',
    guidance: 'ALLOWED',
  },
];

describe('MasterTable', () => {
  it('filters rows by school token matching university name', () => {
    const schoolToken: SearchToken = {
      id: 'token-1',
      type: 'school',
      label: 'University of Leicester',
      value: 'Leicester',
    };

    render(
      <MasterTable
        data={mockData}
        loading={false}
        onEditRate={() => {}}
        activeTokens={[schoolToken]}
      />
    );

    expect(screen.getByText('University of Leicester')).toBeInTheDocument();
    expect(screen.queryByText('Coventry University')).not.toBeInTheDocument();
  });

  it('filters rows by school token matching university ID', () => {
    const schoolToken: SearchToken = {
      id: 'token-2',
      type: 'school',
      label: 'Coventry ID',
      value: 'u-coventry',
    };

    render(
      <MasterTable
        data={mockData}
        loading={false}
        onEditRate={() => {}}
        activeTokens={[schoolToken]}
      />
    );

    expect(screen.getByText('Coventry University')).toBeInTheDocument();
    expect(screen.queryByText('University of Leicester')).not.toBeInTheDocument();
  });
});
