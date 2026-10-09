import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { CommissionRate } from '../types';
import { DashboardView } from './DashboardView';

vi.mock('./MasterTable', () => ({ MasterTable: ({ readOnly }: { readOnly?: boolean }) => <div><span>Admin margin</span><button disabled={readOnly}>Edit rate</button></div> }));
const rate = { id: 'r', universityId: 'u', universityName: 'School', country: 'UK', intake: 'Jan 2026', aggregator: 'SI-UK', studyLevel: 'UG', masterRate: 20, agentRate: 10, diffMargin: 10, isFlatFee: false, netOrGross: 'GROSS' } as CommissionRate;

describe('DashboardView', () => {
  it('DashboardView uses shared dashboard shell and retains Admin-only margins and editing controls', () => {
    render(<DashboardView rates={[rate]} loading={false} onEditRate={vi.fn()} />);
    expect(document.querySelector('[data-dashboard-role="ADMIN"]')).toBeInTheDocument();
    expect(screen.getByText('Admin margin')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Edit rate' })).toBeEnabled();
  });
});
