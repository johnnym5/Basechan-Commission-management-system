import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { CommissionRate } from '../types';
import type { DashboardFilters } from '../types/dashboard';
import { createEmptyDashboardFilters } from '../services/dashboardFilters';
import { DashboardView } from './DashboardView';

vi.mock('./MasterTable', () => ({ MasterTable: (props: any) => <div><span>Admin margin</span><button disabled={props.readOnly}>Edit rate</button><output data-testid="controlled-filters">{[props.externalSearchQuery, props.externalCountryFilter, props.externalLevelFilter, props.externalIntakeFilter, props.externalGuidanceFilter, props.externalAggregatorFilter].join('|')}</output></div> }));
const rate = { id: 'r', universityId: 'u', universityName: 'School', country: 'UK', intake: 'Jan 2026', aggregator: 'SI-UK', studyLevel: 'UG', masterRate: 20, agentRate: 10, diffMargin: 10, isFlatFee: false, netOrGross: 'GROSS' } as CommissionRate;
const filters: DashboardFilters = { ...createEmptyDashboardFilters(), query: 'School', countries: ['UK'], levels: ['UG'], intakes: ['Jan 2026'], guidances: ['FOCUS'], aggregators: ['SI-UK'] };

describe('DashboardView', () => {
  it('DashboardView uses shared dashboard shell and retains Admin-only margins and editing controls', () => {
    render(<DashboardView rates={[rate]} loading={false} onEditRate={vi.fn()} />);
    expect(document.querySelector('[data-dashboard-role="ADMIN"]')).toBeInTheDocument();
    expect(screen.getByText('Admin margin')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Edit rate' })).toBeEnabled();
  });
  it('DashboardView passes country level intake guidance and aggregator filters to MasterTable', () => {
    render(<DashboardView rates={[rate]} loading={false} filters={filters} onFiltersChange={vi.fn()} onEditRate={vi.fn()} />);
    expect(screen.getByTestId('controlled-filters')).toHaveTextContent('School|UK|UG|Jan 2026|FOCUS|SI-UK');
  });
});

