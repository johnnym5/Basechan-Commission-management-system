import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PersonalWorkspaceWidget } from './PersonalWorkspaceWidget';

const mockUseAuth = vi.fn();

vi.mock('../context/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}));

vi.mock('../services/localRateDatabase', () => ({
  getLocalFavorites: vi.fn().mockResolvedValue([]),
}));

vi.mock('../services/accessRequestService', () => ({
  getOrganization: vi.fn().mockResolvedValue(null),
}));

describe('PersonalWorkspaceWidget', () => {
  it('renders welcome message with user displayName for Admin', () => {
    mockUseAuth.mockReturnValue({
      user: { uid: 'admin-1', displayName: 'Kwame Mensah', email: 'kwame@basechan.com' },
      role: 'ADMIN',
      access: { role: 'ADMIN', accessState: 'approved' },
      accessRequest: null,
    });

    render(<PersonalWorkspaceWidget favoriteCount={0} />);

    expect(screen.getByText('Welcome back, Kwame Mensah')).toBeInTheDocument();
    expect(screen.getByTestId('role-agency-badge')).toHaveTextContent('Admin Intelligence');
    expect(screen.queryByTestId('favorite-count-badge')).not.toBeInTheDocument();
  });

  it('renders email prefix fallback when displayName is not present and Staff badge', () => {
    mockUseAuth.mockReturnValue({
      user: { uid: 'staff-1', email: 'ama.serwaa@basechaninternational.com' },
      role: 'STAFF',
      access: { role: 'STAFF', accessState: 'approved' },
      accessRequest: null,
    });

    render(<PersonalWorkspaceWidget favoriteCount={3} />);

    expect(screen.getByText('Welcome back, ama.serwaa')).toBeInTheDocument();
    expect(screen.getByTestId('role-agency-badge')).toHaveTextContent('Staff Application Guide');
    expect(screen.getByTestId('favorite-count-badge')).toHaveTextContent('3 Favorite Schools');
  });

  it('renders Agent organization partner badge and single favorite count label', () => {
    mockUseAuth.mockReturnValue({
      user: { uid: 'agent-1', displayName: 'Kofi Agent', email: 'agent@partner.com' },
      role: 'AGENT',
      access: { role: 'AGENT', accessState: 'approved', organizationId: 'si-uk-ghana' },
      accessRequest: { requestedOrganizationName: 'SI-UK Ghana' },
    });

    render(<PersonalWorkspaceWidget favoriteCount={1} />);

    expect(screen.getByText('Welcome back, Kofi Agent')).toBeInTheDocument();
    expect(screen.getByTestId('role-agency-badge')).toHaveTextContent('SI-UK Ghana Partner');
    expect(screen.getByTestId('favorite-count-badge')).toHaveTextContent('1 Favorite School');
  });

  it('triggers onOpenChat and onScrollToResults callbacks on button click', () => {
    mockUseAuth.mockReturnValue({
      user: { uid: 'agent-1', displayName: 'Kofi Agent' },
      role: 'AGENT',
      access: { role: 'AGENT', accessState: 'approved' },
    });

    const onOpenChat = vi.fn();
    const onScrollToResults = vi.fn();

    render(
      <PersonalWorkspaceWidget
        favoriteCount={2}
        onOpenChat={onOpenChat}
        onScrollToResults={onScrollToResults}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /Ask AI/i }));
    expect(onOpenChat).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: /View Rates/i }));
    expect(onScrollToResults).toHaveBeenCalledTimes(1);
  });
});
