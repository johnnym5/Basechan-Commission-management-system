import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SmartSearchBar } from './SmartSearchBar';
import type { SearchToken } from '../types/search';
import type { CommissionRate } from '../types';

const mockRates: CommissionRate[] = [
  { id: '1', universityId: 'u-leicester', universityName: 'University of Leicester', country: 'UK', intake: 'Sept 2026', studyLevel: 'PG', aggregator: 'SI-UK', masterRate: 0, agentRate: 15, diffMargin: 0, isFlatFee: false, netOrGross: 'GROSS', guidance: 'FOCUS' },
  { id: '2', universityId: 'u-coventry', universityName: 'Coventry University', country: 'UK', intake: 'Jan 2026', studyLevel: 'UG', aggregator: 'Edvoy', masterRate: 0, agentRate: 12, diffMargin: 0, isFlatFee: false, netOrGross: 'GROSS', guidance: 'ALLOWED' },
];

describe('SmartSearchBar', () => {
  it('renders search input with accessibility label', () => {
    render(
      <SmartSearchBar
        rates={mockRates}
        activeTokens={[]}
        onTokensChange={vi.fn()}
        queryText=""
        onQueryTextChange={vi.fn()}
      />
    );
    expect(screen.getByRole('textbox', { name: 'Search directory' })).toBeInTheDocument();
  });

  it('renders active search token chips and allows individual removal', () => {
    const onTokensChange = vi.fn();
    const tokens: SearchToken[] = [{ id: 'PG', type: 'level', label: 'Postgraduate', value: 'PG' }];
    render(
      <SmartSearchBar
        rates={mockRates}
        activeTokens={tokens}
        onTokensChange={onTokensChange}
        queryText=""
        onQueryTextChange={vi.fn()}
      />
    );
    expect(screen.getAllByText('Postgraduate')[0]).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Remove Postgraduate filter' }));
    expect(onTokensChange).toHaveBeenCalledWith([]);
  });

  it('clears text input and creates search token when pressing Enter', () => {
    const onTokensChange = vi.fn();
    const onQueryTextChange = vi.fn();
    render(
      <SmartSearchBar
        rates={mockRates}
        activeTokens={[]}
        onTokensChange={onTokensChange}
        queryText=""
        onQueryTextChange={onQueryTextChange}
      />
    );

    const input = screen.getByRole('textbox', { name: 'Search directory' }) as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'Coventry' } });
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });

    expect(onTokensChange).toHaveBeenCalled();
    const addedTokens = onTokensChange.mock.calls[0][0];
    expect(addedTokens.some((t: SearchToken) => t.value === 'Coventry')).toBe(true);
  });

  it('allows resetting all filters and chips', () => {
    const onTokensChange = vi.fn();
    const onUniversityChange = vi.fn();
    const onCountryChange = vi.fn();
    const tokens: SearchToken[] = [{ id: 'UK', type: 'country', label: 'UK', value: 'UK' }];

    render(
      <SmartSearchBar
        rates={mockRates}
        activeTokens={tokens}
        onTokensChange={onTokensChange}
        queryText=""
        onQueryTextChange={vi.fn()}
        selectedCountry="UK"
        onCountryChange={onCountryChange}
        onUniversityChange={onUniversityChange}
        advanceFiltersOpen={true}
      />
    );

    const resetButton = screen.getAllByRole('button', { name: /reset all/i })[0];
    fireEvent.click(resetButton);

    expect(onTokensChange).toHaveBeenCalledWith([]);
    expect(onCountryChange).toHaveBeenCalledWith('ALL');
    expect(onUniversityChange).toHaveBeenCalledWith('ALL');
  });

  it('renders University and Sort By selectors inside Advanced Filters', () => {
    render(
      <SmartSearchBar
        rates={mockRates}
        activeTokens={[]}
        onTokensChange={vi.fn()}
        queryText=""
        onQueryTextChange={vi.fn()}
        advanceFiltersOpen={true}
        selectedUniversity="ALL"
        selectedSortBy="ALPHABETICAL"
      />
    );

    const universityTrigger = screen.getByRole('button', { name: 'University' });
    const sortByTrigger = screen.getByRole('button', { name: 'Sort By' });
    expect(universityTrigger).toBeInTheDocument();
    expect(sortByTrigger).toBeInTheDocument();

    // Options only render in DOM when the custom popover is open
    fireEvent.click(universityTrigger);
    expect(screen.getByRole('option', { name: 'Coventry University' })).toBeInTheDocument();
  });

  it('suggests didYouMean chip on typo and populates university filter on click without double emission', () => {
    const onUniversityChange = vi.fn();
    const onTokensChange = vi.fn();

    render(
      <SmartSearchBar
        rates={mockRates}
        activeTokens={[]}
        onTokensChange={onTokensChange}
        queryText=""
        onQueryTextChange={vi.fn()}
        onUniversityChange={onUniversityChange}
      />
    );

    const input = screen.getByRole('textbox', { name: 'Search directory' });
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: 'licester' } });

    const applyButton = screen.getByRole('button', { name: /apply chip/i });
    expect(applyButton).toBeInTheDocument();

    fireEvent.mouseDown(applyButton);
    fireEvent.click(applyButton);

    expect(onUniversityChange).toHaveBeenCalledTimes(1);
    expect(onUniversityChange).toHaveBeenCalledWith('University of Leicester');
  });
});
