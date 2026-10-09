import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { DashboardFilters, DashboardRate } from '../types/dashboard';
import { createEmptyDashboardFilters } from '../services/dashboardFilters';
import { RoleDashboardView } from './RoleDashboardView';

const staff: DashboardRate[] = [{ role: 'STAFF', id: 'r1', universityId: 'u1', universityName: 'Alpha University', country: 'UK', intake: 'Jan 2026', aggregator: 'SI-UK', studyLevel: 'UG', guidance: 'FOCUS' }];
const agent: DashboardRate[] = [{ role: 'AGENT', id: 'r2', universityId: 'u2', universityName: 'Beta College', country: 'Ghana', intake: 'Sept 2026', studyLevel: 'PG', guidance: 'ALLOWED', agentRate: 12, isFlatFee: false, netOrGross: 'NET' }];
const renderView = (role: 'STAFF' | 'AGENT', rates: DashboardRate[], filters: DashboardFilters = createEmptyDashboardFilters(), onFiltersChange = vi.fn()) => render(<RoleDashboardView role={role} rates={rates} loading={false} filters={filters} onFiltersChange={onFiltersChange} />);

describe('RoleDashboardView', () => {
  it('Staff sees route, school, country, and Focus KPIs without payout metrics', () => {
    renderView('STAFF', staff);
    expect(screen.getByText('Visible routes')).toBeInTheDocument();
    expect(screen.getByText('Universities')).toBeInTheDocument();
    expect(screen.getByText('Countries')).toBeInTheDocument();
    expect(screen.queryByText(/payout/i)).not.toBeInTheDocument();
    expect(screen.getByText('Alpha University')).toBeInTheDocument();
  });
  it('Agent sees role-scoped payout routes without margin or aggregator UI', () => {
    renderView('AGENT', agent);
    expect(screen.getByText('Beta College')).toBeInTheDocument();
    expect(screen.getByText(/12%/)).toBeInTheDocument();
    expect(screen.queryByText(/margin|aggregator/i)).not.toBeInTheDocument();
  });
  it('empty role results name active filters and offer clear all', () => {
    const onChange = vi.fn();
    renderView('STAFF', [], { ...createEmptyDashboardFilters(), countries: ['UK'] }, onChange);
    expect(screen.getByText(/No routes match/)).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole('button', { name: /clear all filters/i })[0]);
    expect(onChange).toHaveBeenCalledWith(createEmptyDashboardFilters());
  });
  it('Staff filter changes update the shared filter object', () => {
    const onChange = vi.fn();
    renderView('STAFF', staff, createEmptyDashboardFilters(), onChange);
    fireEvent.change(screen.getByLabelText('Country'), { target: { value: 'UK' } });
    expect(onChange).toHaveBeenCalledWith({ ...createEmptyDashboardFilters(), countries: ['UK'] });
  });
  it('active filter chips reflect controlled state', () => {
    renderView('STAFF', staff, { ...createEmptyDashboardFilters(), countries: ['UK'] });
    expect(screen.getByText('Country: UK')).toBeInTheDocument();
  });
  it('clear all filters resets all role-specific fields', () => {
    const onChange = vi.fn();
    renderView('AGENT', agent, { ...createEmptyDashboardFilters(), countries: ['UK'], agentPayoutKind: 'FLAT_FEE', payoutMinimum: 100 }, onChange);
    fireEvent.click(screen.getAllByRole('button', { name: /clear all filters/i })[0]);
    expect(onChange).toHaveBeenCalledWith(createEmptyDashboardFilters());
  });
});
