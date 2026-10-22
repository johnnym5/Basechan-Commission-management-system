import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { UniversityDetailModal } from './UniversityDetailModal';
import type { CommissionRate } from '../types';

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    role: 'ADMIN',
    user: { email: 'admin@basechan.com' },
  }),
}));

describe('UniversityDetailModal - Add Route', () => {
  const mockRates: CommissionRate[] = [
    {
      id: 'aberdeen__sept_2026__basechan__ug',
      universityId: 'aberdeen',
      universityName: 'Aberdeen University',
      country: 'UK',
      intake: 'Sept 2026',
      aggregator: 'BASECHAN',
      studyLevel: 'UG',
      masterRate: 20,
      agentRate: 10,
      diffMargin: 10,
      isFlatFee: false,
      netOrGross: 'GROSS',
      guidance: 'ALLOWED',
      isDefaultRoute: true,
    },
  ];

  it('renders "+ Add Route" section in edit mode and fires onAddRoute when submitted', async () => {
    const onAddRoute = vi.fn();

    render(
      <UniversityDetailModal
        isOpen={true}
        onClose={vi.fn()}
        ratesForUniversity={mockRates}
        universityName="Aberdeen University"
        onAddRoute={onAddRoute}
      />
    );

    // Switch to edit mode
    const editBtn = screen.getByRole('button', { name: /Edit Record/i });
    fireEvent.click(editBtn);

    // Check that Add Route section is present
    expect(screen.getByText(/Add Custom Aggregator Route/i)).toBeInTheDocument();

    // Fill in custom aggregator
    const aggInput = screen.getByPlaceholderText(/e.g. INTO, Kaplan, QS/i);
    fireEvent.change(aggInput, { target: { value: 'INTO University Partnerships' } });

    // Fill in Agent Rate
    const agentRateInput = screen.getByPlaceholderText(/Agent Rate/i);
    fireEvent.change(agentRateInput, { target: { value: '12' } });

    // Fill in Master Rate
    const masterRateInput = screen.getByPlaceholderText(/Master Rate/i);
    fireEvent.change(masterRateInput, { target: { value: '18' } });

    // Click Add Route button
    const addRouteBtn = screen.getByRole('button', { name: /Add Route Now/i });
    fireEvent.click(addRouteBtn);

    expect(onAddRoute).toHaveBeenCalledTimes(1);
    const added: CommissionRate = onAddRoute.mock.calls[0][0];
    expect(added.universityName).toBe('Aberdeen University');
    expect(added.aggregator).toBe('INTO University Partnerships');
    expect(added.agentRate).toBe(12);
    expect(added.masterRate).toBe(18);
    expect(added.diffMargin).toBe(6);
    expect(added.intake).toBe('Sept 2026');
  });

  it('prevents adding a duplicate aggregator and level route for the same intake', async () => {
    const onAddRoute = vi.fn();

    render(
      <UniversityDetailModal
        isOpen={true}
        onClose={vi.fn()}
        ratesForUniversity={mockRates}
        universityName="Aberdeen University"
        onAddRoute={onAddRoute}
      />
    );

    // Switch to edit mode
    fireEvent.click(screen.getByRole('button', { name: /Edit Record/i }));

    // Try adding BASECHAN (UG) which already exists in mockRates
    const aggInput = screen.getByPlaceholderText(/e.g. INTO, Kaplan, QS/i);
    fireEvent.change(aggInput, { target: { value: 'BASECHAN' } });

    const agentRateInput = screen.getByPlaceholderText(/Agent Rate/i);
    fireEvent.change(agentRateInput, { target: { value: '15' } });

    const addRouteBtn = screen.getByRole('button', { name: /Add Route Now/i });
    fireEvent.click(addRouteBtn);

    expect(screen.getByText(/already exists in this intake/i)).toBeInTheDocument();
    expect(onAddRoute).not.toHaveBeenCalled();
  });

  it('correctly resolves and displays master rates when ratesForUniversity contains active master rate with 0 agent rate', () => {
    const ratesWithActiveMaster: CommissionRate[] = [
      {
        id: 'alexander__2026__basechan__ug',
        universityId: 'alexander',
        universityName: 'Alexander College',
        country: 'Canada',
        intake: '2026 SI-UK',
        aggregator: 'BASECHAN',
        studyLevel: 'UG',
        masterRate: 20,
        agentRate: 10,
        diffMargin: 10,
        isFlatFee: false,
        netOrGross: 'GROSS',
      },
      {
        id: 'alexander__2026__basechan__pg',
        universityId: 'alexander',
        universityName: 'Alexander College',
        country: 'Canada',
        intake: '2026 SI-UK',
        aggregator: 'BASECHAN',
        studyLevel: 'PG',
        masterRate: 15,
        agentRate: 0,
        diffMargin: 15,
        isFlatFee: false,
        netOrGross: 'GROSS',
      },
    ];

    render(
      <UniversityDetailModal
        isOpen={true}
        onClose={vi.fn()}
        ratesForUniversity={ratesWithActiveMaster}
        universityName="Alexander College"
      />
    );

    expect(screen.getByText('20%')).toBeInTheDocument();
    expect(screen.getByText('15%')).toBeInTheDocument();
  });

  it('picks active master rate even if a 0-value rate record comes first in ratesForUniversity array', () => {
    const ratesWith0First: CommissionRate[] = [
      {
        id: 'alexander__old__basechan__pg',
        universityId: 'alexander',
        universityName: 'Alexander College',
        country: 'Canada',
        intake: '2026 SI-UK',
        aggregator: 'BASECHAN',
        studyLevel: 'PG',
        masterRate: 0,
        agentRate: 0,
        diffMargin: 0,
        isFlatFee: false,
        netOrGross: 'GROSS',
      },
      {
        id: 'alexander__new__basechan__pg',
        universityId: 'alexander',
        universityName: 'Alexander College',
        country: 'Canada',
        intake: '2026 SI-UK',
        aggregator: 'BASECHAN',
        studyLevel: 'PG',
        masterRate: 15,
        agentRate: 0,
        diffMargin: 15,
        isFlatFee: false,
        netOrGross: 'GROSS',
      },
    ];

    render(
      <UniversityDetailModal
        isOpen={true}
        onClose={vi.fn()}
        ratesForUniversity={ratesWith0First}
        universityName="Alexander College"
      />
    );

    expect(screen.getByText('15%')).toBeInTheDocument();
  });
});
