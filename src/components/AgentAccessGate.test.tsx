import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AgentAccessGate, OrganizationRequestForm } from './AgentAccessGate';
import { useAuth } from '../context/AuthContext';

vi.mock('../context/AuthContext', () => ({
  useAuth: vi.fn(),
}));

vi.mock('../services/accessRequestService', () => ({
  requestOrganizationAccess: vi.fn(),
  subscribeToOrganizations: vi.fn((cb) => {
    cb([]);
    return () => {};
  }),
}));

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

describe('AgentAccessGate', () => {
  it('renders a Back to login button and calls signOut when clicked', () => {
    const mockSignOut = vi.fn().mockResolvedValue(undefined);
    vi.mocked(useAuth).mockReturnValue({
      user: { uid: 'agent-1', email: 'agent@example.com' } as any,
      access: { role: 'AGENT', accessState: 'pending' },
      accessRequest: { status: 'pending', organizationId: 'org-1' } as any,
      signOut: mockSignOut,
    } as any);

    render(<AgentAccessGate />);

    const backButton = screen.getByRole('button', { name: /back to login/i });
    expect(backButton).toBeInTheDocument();

    fireEvent.click(backButton);
    expect(mockSignOut).toHaveBeenCalledTimes(1);
  });
});

