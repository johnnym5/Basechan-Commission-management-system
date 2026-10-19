import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { PendingRateOperation } from '../types/rateWriteQueue';
import { RateChangeBasket } from './RateChangeBasket';

const item: PendingRateOperation = { operationId: 'basket-op', uid: 'admin', adminEmail: 'a@x', category: 'guidance', notify: true, status: 'conflict', attemptCount: 0, createdAt: '', updatedAt: '', mutations: [{ kind: 'update', id: 'rate', nextId: 'rate', patch: { guidance: 'ALLOWED' }, baseFields: { guidance: 'FOCUS' }, baseSnapshot: { id: 'rate', universityId: 'uni', universityName: 'Example University', intake: 'Sept 2027', aggregator: 'BASECHAN', studyLevel: 'UG', masterRate: 10, agentRate: 5, diffMargin: 5, isFlatFee: false, netOrGross: 'GROSS' } }], conflicts: [{ mutationIndex: 0, id: 'rate', reason: 'Cloud value changed.' }] };
describe('RateChangeBasket', () => {
  it('shows conflict status and offers explicit resolution choices', () => {
    const onResolve = vi.fn();
    render(<RateChangeBasket operations={[item]} syncState="idle" onRetry={vi.fn()} onDiscard={vi.fn()} onResolveConflict={onResolve} />);
    expect(screen.getByText('Needs review: 1')).toBeInTheDocument();
    expect(screen.getByText('Cloud value changed.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Keep cloud' }));
    expect(onResolve).toHaveBeenCalledWith('basket-op', 'keep-cloud');
    fireEvent.click(screen.getByRole('button', { name: 'Apply my change' }));
    expect(onResolve).toHaveBeenCalledWith('basket-op', 'apply-local');
  });
});
