import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CompareView } from './CompareView';
import type { CommissionRate } from '../types';

const mockRates: CommissionRate[] = [
  {
    id: '1',
    universityId: 'u-aberdeen',
    universityName: 'University of Aberdeen',
    aggregator: 'KC Overseas',
    intake: 'Sept 2030',
    studyLevel: 'UG',
    masterRate: 15,
    agentRate: 10,
    diffMargin: 5,
    isFlatFee: false,
    netOrGross: 'GROSS',
  },
  {
    id: '2',
    universityId: 'u-aberdeen',
    universityName: 'University of Aberdeen',
    aggregator: 'Adventus',
    intake: 'Sept 2030',
    studyLevel: 'UG',
    masterRate: 18,
    agentRate: 10,
    diffMargin: 8,
    isFlatFee: false,
    netOrGross: 'GROSS',
  },
  {
    id: '3',
    universityId: 'u-aberdeen',
    universityName: 'University of Aberdeen',
    aggregator: 'KC Overseas',
    intake: 'Sept 2020',
    studyLevel: 'PG',
    masterRate: 12,
    agentRate: 10,
    diffMargin: 2,
    isFlatFee: false,
    netOrGross: 'GROSS',
  },
  {
    id: '4',
    universityId: 'u-leicester',
    universityName: 'University of Leicester',
    aggregator: 'Adventus',
    intake: 'Jan 2030',
    studyLevel: 'UG',
    masterRate: 20,
    agentRate: 15,
    diffMargin: 5,
    isFlatFee: false,
    netOrGross: 'GROSS',
  },
];

describe('CompareView', () => {
  it('consolidates routes per university into 1 card and handles historical intake collapse', () => {
    render(<CompareView allRates={mockRates} />);

    // Search and select University of Aberdeen
    const searchInput = screen.getByPlaceholderText(/Search university to add/i);
    fireEvent.focus(searchInput);
    fireEvent.change(searchInput, { target: { value: 'Aberdeen' } });

    const option = screen.getByText('University of Aberdeen');
    fireEvent.mouseDown(option);

    // Ensure 1 card header for University of Aberdeen
    expect(screen.getByRole('heading', { name: 'University of Aberdeen' })).toBeInTheDocument();

    // Verify active intake is shown
    expect(screen.getAllByText(/Sept 2030/i).length).toBeGreaterThan(0);

    // Verify collapsible "View Previous Intakes (1)" button exists
    const collapseButton = screen.getByRole('button', { name: /View Previous Intakes \(1\)/i });
    expect(collapseButton).toBeInTheDocument();

    // Previous intake row shouldn't be visible before clicking
    expect(screen.queryByText('Previous / Historical Intakes (1)')).not.toBeInTheDocument();

    // Click collapsible button
    fireEvent.click(collapseButton);

    // Verify historical intake is now revealed
    expect(screen.getByText('Previous / Historical Intakes (1)')).toBeInTheDocument();
    expect(screen.getAllByText(/Sept 2020/i).length).toBeGreaterThan(0);
    expect(screen.getByText('Hide Previous Intakes')).toBeInTheDocument();
  });

  it('contains no AI / Chat FAB or AI button in CompareView', () => {
    render(<CompareView allRates={mockRates} />);

    expect(screen.queryByRole('button', { name: /ai/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /chat/i })).not.toBeInTheDocument();
    expect(screen.queryByTestId('chat-launcher')).not.toBeInTheDocument();
  });
});
