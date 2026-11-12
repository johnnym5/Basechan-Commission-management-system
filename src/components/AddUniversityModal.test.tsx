import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AddUniversityModal } from './AddUniversityModal';
import type { CommissionRate } from '../types';

describe('AddUniversityModal', () => {
  it('does not render when isOpen is false', () => {
    render(
      <AddUniversityModal
        isOpen={false}
        onClose={vi.fn()}
        existingRates={[]}
        onUniversityAdded={vi.fn()}
      />
    );
    expect(screen.queryByText(/Add New University/i)).not.toBeInTheDocument();
  });

  it('renders form inputs and generates rates only for filled fields', async () => {
    const onUniversityAdded = vi.fn();
    render(
      <AddUniversityModal
        isOpen={true}
        onClose={vi.fn()}
        existingRates={[]}
        defaultIntake="Sept 2026"
        onUniversityAdded={onUniversityAdded}
      />
    );

    expect(screen.getByText(/Add New University/i)).toBeInTheDocument();

    // Fill in University Name
    const uniInput = screen.getByLabelText(/University Name/i);
    fireEvent.change(uniInput, { target: { value: 'Oxford Brookes' } });

    // Fill in Agent PG rate (Basechan direct)
    const agentPgInput = screen.getByLabelText(/Agent Rate \(PG\)/i);
    fireEvent.change(agentPgInput, { target: { value: '15' } });

    // Fill in Master Direct PG rate
    const masterPgInput = screen.getByLabelText(/Master Direct \(PG\)/i);
    fireEvent.change(masterPgInput, { target: { value: '25' } });

    // Submit form
    const saveBtn = screen.getByRole('button', { name: /Save University/i });
    fireEvent.click(saveBtn);

    expect(onUniversityAdded).toHaveBeenCalledTimes(1);
    const addedRates: CommissionRate[] = onUniversityAdded.mock.calls[0][0];

    // Only 1 rate should be created (for PG) since only PG was filled
    expect(addedRates.length).toBe(1);
    expect(addedRates[0].universityName).toBe('Oxford Brookes');
    expect(addedRates[0].studyLevel).toBe('PG');
    expect(addedRates[0].agentRate).toBe(15);
    expect(addedRates[0].masterRate).toBe(25);
    expect(addedRates[0].diffMargin).toBe(10);
    expect(addedRates[0].aggregator).toBe('BASECHAN');
  });

  it('assigns aggregator rate as masterRate (incoming) and agent rate as agentRate (outgoing) for aggregator routes', async () => {
    const onUniversityAdded = vi.fn();
    render(
      <AddUniversityModal
        isOpen={true}
        onClose={vi.fn()}
        existingRates={[]}
        defaultIntake="Sept 2026"
        onUniversityAdded={onUniversityAdded}
      />
    );

    fireEvent.change(screen.getByLabelText(/University Name/i), { target: { value: 'Abertay University' } });
    fireEvent.change(screen.getByLabelText(/Agent Rate \(UG\)/i), { target: { value: '5' } });
    fireEvent.change(screen.getByLabelText(/Master Direct \(UG\)/i), { target: { value: '15' } });
    fireEvent.change(screen.getByLabelText(/EDVOY \(UG\)/i), { target: { value: '10.5' } });

    fireEvent.click(screen.getByRole('button', { name: /Save University/i }));

    expect(onUniversityAdded).toHaveBeenCalledTimes(1);
    const addedRates: CommissionRate[] = onUniversityAdded.mock.calls[0][0];

    const edvoyUg = addedRates.find((r) => r.aggregator === 'EDVOY' && r.studyLevel === 'UG');
    expect(edvoyUg).toBeDefined();
    expect(edvoyUg?.masterRate).toBe(10.5);
    expect(edvoyUg?.agentRate).toBe(5);
    expect(edvoyUg?.diffMargin).toBe(5.5);
  });

  it('warns when university name already exists for the same intake', () => {
    const existingRates: CommissionRate[] = [
      {
        id: 'oxford__sept_2026__basechan__ug',
        universityId: 'oxford',
        universityName: 'Oxford Brookes',
        country: 'United Kingdom',
        intake: 'Sept 2026',
        aggregator: 'BASECHAN',
        studyLevel: 'UG',
        masterRate: 20,
        agentRate: 10,
        diffMargin: 10,
        isFlatFee: false,
        netOrGross: 'GROSS',
      },
    ];

    render(
      <AddUniversityModal
        isOpen={true}
        onClose={vi.fn()}
        existingRates={existingRates}
        defaultIntake="Sept 2026"
        onUniversityAdded={vi.fn()}
      />
    );

    const uniInput = screen.getByLabelText(/University Name/i);
    fireEvent.change(uniInput, { target: { value: 'Oxford Brookes' } });

    expect(screen.getByText(/A university with this name already exists in this intake/i)).toBeInTheDocument();
  });

  it('supports independent intake and commission type per route when adding a university', async () => {
    const onUniversityAdded = vi.fn();
    render(
      <AddUniversityModal
        isOpen={true}
        onClose={vi.fn()}
        existingRates={[]}
        defaultIntake="Sept 2026"
        availableIntakes={['Sept 2026', 'Jan 2027']}
        onUniversityAdded={onUniversityAdded}
      />
    );

    // University name
    fireEvent.change(screen.getByLabelText(/University Name/i), { target: { value: 'Coventry University' } });

    // Set Basechan UG rate to 10
    fireEvent.change(screen.getByLabelText('Master Direct (UG)'), { target: { value: '10' } });

    // Configure SI-UK route with independent intake "Jan 2027" and "Fixed Fee" commission type
    const siUkIntakeSelect = screen.getByLabelText('SI-UK Intake');
    fireEvent.change(siUkIntakeSelect, { target: { value: 'Jan 2027' } });

    const siUkCommTypeSelect = screen.getByLabelText('SI-UK Commission Type');
    fireEvent.change(siUkCommTypeSelect, { target: { value: 'Fixed Fee' } });

    const siUkUgRateInput = screen.getByLabelText('SI-UK (UG)');
    fireEvent.change(siUkUgRateInput, { target: { value: '2500' } });

    fireEvent.click(screen.getByRole('button', { name: /Save University/i }));

    expect(onUniversityAdded).toHaveBeenCalledTimes(1);
    const addedRates: CommissionRate[] = onUniversityAdded.mock.calls[0][0];

    const basechanUg = addedRates.find((r) => r.aggregator === 'BASECHAN' && r.studyLevel === 'UG');
    expect(basechanUg).toBeDefined();
    expect(basechanUg?.intake).toBe('Sept 2026');
    expect(basechanUg?.isFlatFee).toBe(false);

    const siUkUg = addedRates.find((r) => r.aggregator === 'SI-UK' && r.studyLevel === 'UG');
    expect(siUkUg).toBeDefined();
    expect(siUkUg?.intake).toBe('Jan 2027');
    expect(siUkUg?.isFlatFee).toBe(true);
    expect(siUkUg?.masterRate).toBe(2500);
  });
});
