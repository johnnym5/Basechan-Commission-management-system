import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { OrganizationRequestForm } from './AgentAccessGate';

describe('OrganizationRequestForm', () => {
  const organizations = [
    { id: 'north-star', name: 'North Star Partners', normalizedName: 'north star partners', createdAt: '', createdBy: '' },
  ];

  it('submits a selected existing organization', () => {
    const onSubmit = vi.fn();
    render(<OrganizationRequestForm organizations={organizations} onSubmit={onSubmit} busy={false} />);

    fireEvent.change(screen.getByLabelText(/existing organization/i), { target: { value: 'north-star' } });
    fireEvent.click(screen.getByRole('button', { name: /request access/i }));

    expect(onSubmit).toHaveBeenCalledWith({ organizationId: 'north-star' });
  });

  it('lets the Agent request that Admin add a missing organization', () => {
    const onSubmit = vi.fn();
    render(<OrganizationRequestForm organizations={organizations} onSubmit={onSubmit} busy={false} />);

    fireEvent.click(screen.getByRole('button', { name: /request a new organization/i }));
    fireEvent.change(screen.getByLabelText(/organization name/i), { target: { value: 'New Agency Network' } });
    fireEvent.click(screen.getByRole('button', { name: /request organization/i }));

    expect(onSubmit).toHaveBeenCalledWith({ requestedOrganizationName: 'New Agency Network' });
  });
});
