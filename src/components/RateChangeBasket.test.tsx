import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { PendingRateOperation } from '../types/rateWriteQueue';
import { RateChangeBasket } from './RateChangeBasket';

const item: PendingRateOperation = {
  operationId: 'basket-op',
  uid: 'admin',
  adminEmail: 'a@x',
  category: 'guidance',
  notify: true,
  status: 'conflict',
  attemptCount: 0,
  createdAt: '',
  updatedAt: '',
  mutations: [
    {
      kind: 'update',
      id: 'rate',
      nextId: 'rate',
      patch: { guidance: 'ALLOWED' },
      baseFields: { guidance: 'FOCUS' },
      baseSnapshot: {
        id: 'rate',
        universityId: 'uni',
        universityName: 'Example University',
        intake: 'Sept 2027',
        aggregator: 'BASECHAN',
        studyLevel: 'UG',
        masterRate: 10,
        agentRate: 5,
        diffMargin: 5,
        isFlatFee: false,
        netOrGross: 'GROSS',
      },
    },
  ],
  conflicts: [{ mutationIndex: 0, id: 'rate', reason: 'Cloud value changed.' }],
};

describe('RateChangeBasket', () => {
  it('renders no local changes waiting when operations list is empty', () => {
    render(<RateChangeBasket operations={[]} syncState="idle" onRetry={vi.fn()} />);
    expect(screen.getByTitle('No local changes waiting')).toBeInTheDocument();
  });

  it('renders pending count badge and change basket popover on click', () => {
    render(<RateChangeBasket operations={[item]} syncState="idle" onRetry={vi.fn()} />);
    const triggerBtn = screen.getByRole('button', { name: /Pending rate changes: 1/i });
    expect(triggerBtn).toBeInTheDocument();

    fireEvent.click(triggerBtn);
    expect(screen.getByTestId('sync-status-popover')).toBeInTheDocument();
    expect(screen.getByText('Change basket')).toBeInTheDocument();
    expect(screen.getByText('Example University')).toBeInTheDocument();
  });

  it('allows discarding selected operations from the change basket popover', () => {
    const onDiscard = vi.fn();
    render(
      <RateChangeBasket
        operations={[item]}
        selectedIds={['basket-op']}
        syncState="idle"
        onRetry={vi.fn()}
        onDiscard={onDiscard}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /Pending rate changes: 1/i }));

    const discardBtn = screen.getByRole('button', { name: 'Discard' });
    expect(discardBtn).not.toBeDisabled();
    fireEvent.click(discardBtn);

    const confirmBtn = screen.getByRole('button', { name: 'Confirm discard' });
    expect(confirmBtn).toBeInTheDocument();
    fireEvent.click(confirmBtn);

    expect(onDiscard).toHaveBeenCalledWith(['basket-op']);
  });
});
