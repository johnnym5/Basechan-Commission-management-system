import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { PendingRateOperation } from '../types/rateWriteQueue';
import { RateChangeBasket } from './RateChangeBasket';

const item: PendingRateOperation = { operationId: 'basket-op', uid: 'admin', adminEmail: 'a@x', category: 'guidance', notify: true, status: 'conflict', attemptCount: 0, createdAt: '', updatedAt: '', mutations: [{ kind: 'update', id: 'rate', nextId: 'rate', patch: { guidance: 'ALLOWED' }, baseFields: { guidance: 'FOCUS' }, baseSnapshot: { id: 'rate', universityId: 'uni', universityName: 'Example University', intake: 'Sept 2027', aggregator: 'BASECHAN', studyLevel: 'UG', masterRate: 10, agentRate: 5, diffMargin: 5, isFlatFee: false, netOrGross: 'GROSS' } }], conflicts: [{ mutationIndex: 0, id: 'rate', reason: 'Cloud value changed.' }] };

describe('RateChangeBasket', () => {
  it('renders green checkmark when all data is synced', () => {
    render(<RateChangeBasket operations={[]} syncState="idle" onRetry={vi.fn()} />);
    expect(screen.getByTitle('All data is synced')).toBeInTheDocument();
  });

  it('renders spinning loader when syncing changes', () => {
    render(<RateChangeBasket operations={[]} syncState="syncing" onRetry={vi.fn()} />);
    expect(screen.getByTitle('Syncing changes to Firestore...')).toBeInTheDocument();
  });

  it('renders red X button on sync failure/conflict and shows popover with retry button', () => {
    const onRetry = vi.fn();
    render(<RateChangeBasket operations={[item]} syncState="idle" onRetry={onRetry} errorMessage="Network request failed" />);
    const triggerBtn = screen.getByRole('button', { name: /sync failed or pending - click to retry/i });
    expect(triggerBtn).toBeInTheDocument();
    
    // Clicking trigger opens the detailed status popover
    fireEvent.click(triggerBtn);
    expect(screen.getByTestId('sync-status-popover')).toBeInTheDocument();
    expect(screen.getByText(/Retry Sync Now will apply your changed fields and preserve unrelated cloud updates/i)).toBeInTheDocument();

    // Clicking Retry Sync button inside popover calls onRetry
    const retryNowBtn = screen.getByRole('button', { name: /Retry Sync Now/i });
    fireEvent.click(retryNowBtn);
    expect(onRetry).toHaveBeenCalledWith('basket-op');
  });

  it('renders Discard Change button and invokes onDiscard when clicked', () => {
    const onDiscard = vi.fn();
    render(
      <RateChangeBasket
        operations={[item]}
        syncState="idle"
        onRetry={vi.fn()}
        onDiscard={onDiscard}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /sync failed or pending - click to retry/i }));
    
    const discardBtn = screen.getByRole('button', { name: /Discard Change/i });
    expect(discardBtn).toBeInTheDocument();
    fireEvent.click(discardBtn);
    expect(onDiscard).toHaveBeenCalledWith('basket-op');
  });

  it('offers retry for conflicts without a Force Push action', () => {
    render(
      <RateChangeBasket
        operations={[item]}
        syncState="idle"
        onRetry={vi.fn()}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /sync failed or pending - click to retry/i }));

    expect(screen.getByRole('button', { name: /Retry Sync Now/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Force Push/i })).not.toBeInTheDocument();
  });

  it('does not offer Force Push for a rate ID collision', () => {
    const collision = { ...item, conflicts: [{ mutationIndex: 0, id: 'occupied', reason: 'Another rate already uses the new ID. Resolve this ID collision before saving.' }] };
    render(<RateChangeBasket operations={[collision]} syncState="idle" onRetry={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /sync failed or pending - click to retry/i }));
    expect(screen.queryByRole('button', { name: /Force Push/i })).not.toBeInTheDocument();
  });
});
