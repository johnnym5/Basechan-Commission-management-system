import { render, screen, fireEvent } from '@testing-library/react';
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
    intake: 'Sept 2028',
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
    intake: 'Jan 2028',
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
        externalIntakeFilter="ALL"
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
        externalIntakeFilter="ALL"
      />
    );

    expect(screen.getByText('Coventry University')).toBeInTheDocument();
    expect(screen.queryByText('University of Leicester')).not.toBeInTheDocument();
  });

  it('groups multiple routes for a university into 1 consolidated card', () => {
    const multiRouteData: CommissionRate[] = [
      {
        id: 'rate-1',
        universityId: 'u-leicester',
        universityName: 'University of Leicester',
        country: 'UK',
        intake: 'Sept 2028',
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
        universityId: 'u-leicester',
        universityName: 'University of Leicester',
        country: 'UK',
        intake: 'Jan 2028',
        studyLevel: 'UG',
        aggregator: 'Edvoy',
        masterRate: 18,
        agentRate: 10,
        diffMargin: 8,
        isFlatFee: false,
        netOrGross: 'GROSS',
        guidance: 'FOCUS',
      },
    ];

    render(
      <MasterTable
        data={multiRouteData}
        loading={false}
        onEditRate={() => {}}
        externalSearchQuery="Leicester"
        externalIntakeFilter="ALL"
      />
    );

    expect(screen.getByText('2 Routes')).toBeInTheDocument();
    expect(screen.getByText('University of Leicester')).toBeInTheDocument();
    expect(screen.getByText('FOCUS')).toBeInTheDocument();
  });

  it('opens modal and renders active vs previous intakes breakdown', async () => {
    const mixedIntakeData: CommissionRate[] = [
      {
        id: 'rate-active',
        universityId: 'u-leicester',
        universityName: 'University of Leicester',
        country: 'UK',
        intake: 'Sept 2028',
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
        id: 'rate-previous',
        universityId: 'u-leicester',
        universityName: 'University of Leicester',
        country: 'UK',
        intake: 'Sept 2024',
        studyLevel: 'UG',
        aggregator: 'Edvoy',
        masterRate: 15,
        agentRate: 10,
        diffMargin: 5,
        isFlatFee: false,
        netOrGross: 'GROSS',
        guidance: 'FOCUS',
      },
    ];

    render(
      <MasterTable
        data={mixedIntakeData}
        loading={false}
        onEditRate={() => {}}
        externalSearchQuery="Leicester"
        externalIntakeFilter="ALL"
      />
    );

    fireEvent.click(screen.getByText('University of Leicester'));

    expect(await screen.findByText(/Active Intakes \(1\)/i)).toBeInTheDocument();
    expect(screen.getByText(/View Previous Intakes \(1\)/i)).toBeInTheDocument();

    fireEvent.click(screen.getByText(/View Previous Intakes \(1\)/i));
    expect(await screen.findByText('Sept 2024')).toBeInTheDocument();
  });

  it('fallbacks to previous intakes in main list when active routes are empty', async () => {
    const onlyHistoricalData: CommissionRate[] = [
      {
        id: 'rate-old',
        universityId: 'u-coventry',
        universityName: 'Coventry University',
        country: 'UK',
        intake: 'Jan 2024',
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

    render(
      <MasterTable
        data={onlyHistoricalData}
        loading={false}
        onEditRate={() => {}}
        externalSearchQuery="Coventry"
        externalIntakeFilter="ALL"
      />
    );

    fireEvent.click(screen.getByText('Coventry University'));

    expect(await screen.findByText(/Previous Intakes \(1\)/i)).toBeInTheDocument();
    expect(screen.getByText('Jan 2024')).toBeInTheDocument();
  });
});
