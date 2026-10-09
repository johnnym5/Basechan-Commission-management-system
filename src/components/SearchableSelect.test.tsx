import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SearchableSelect } from './SearchableSelect';

const options = [
  ...Array.from({ length: 12 }, (_, index) => ({
    label: `Matching option ${index + 1}`,
    value: `match-${index + 1}`,
  })),
  { label: 'Different option', value: 'different' },
];

describe('SearchableSelect', () => {
  it('filters the complete option list, including matches beyond eight results', () => {
    render(
      <SearchableSelect
        options={options}
        value=""
        onChange={vi.fn()}
        ariaLabel="Choose an option"
      />,
    );

    const input = screen.getByRole('combobox', { name: 'Choose an option' });
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: 'matching' } });

    expect(screen.getByRole('option', { name: 'Matching option 12' })).toBeVisible();
    expect(screen.getAllByRole('option')).toHaveLength(12);
  });

  it('shows an empty state without changing the selected value when there is no match', () => {
    const onChange = vi.fn();
    render(
      <SearchableSelect
        options={options}
        value="match-1"
        onChange={onChange}
        ariaLabel="Choose an option"
      />,
    );

    const input = screen.getByRole('combobox', { name: 'Choose an option' });
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: 'no such option' } });

    expect(screen.getByText('No options found')).toBeVisible();
    expect(input).toHaveValue('no such option');
    expect(onChange).not.toHaveBeenCalled();
  });

  it('moves through filtered options with arrows and selects with Enter', () => {
    const onChange = vi.fn();
    render(
      <SearchableSelect
        options={[
          { label: 'United Kingdom', value: 'uk' },
          { label: 'United States', value: 'us' },
        ]}
        value=""
        onChange={onChange}
        ariaLabel="Country"
      />,
    );

    const input = screen.getByRole('combobox', { name: 'Country' });
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: 'united' } });
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(onChange).toHaveBeenCalledWith('uk');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('dismisses the options with Escape', () => {
    render(
      <SearchableSelect
        options={options}
        value=""
        onChange={vi.fn()}
        ariaLabel="Choose an option"
      />,
    );

    const input = screen.getByRole('combobox', { name: 'Choose an option' });
    fireEvent.focus(input);
    expect(screen.getByRole('listbox')).toBeVisible();
    fireEvent.keyDown(input, { key: 'Escape' });

    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('does not open or accept input while disabled', () => {
    const onChange = vi.fn();
    render(
      <SearchableSelect
        options={options}
        value="match-1"
        onChange={onChange}
        ariaLabel="Choose an option"
        disabled
      />,
    );

    const input = screen.getByRole('combobox', { name: 'Choose an option' });
    expect(input).toBeDisabled();
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: 'different' } });

    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
  });
});
