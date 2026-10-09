import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { ShareRateCardModal } from './ShareRateCardModal';
import type { CommissionRate } from '../types';

const mockUseAuth = vi.fn();

vi.mock('../context/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}));

vi.mock('../services/accessRequestService', () => ({
  getOrganization: vi.fn().mockResolvedValue({ id: 'si-uk-ghana', name: 'SI-UK Ghana' }),
}));

const mockRate: CommissionRate = {
  id: 'r12345678',
  universityId: 'u1',
  universityName: 'University of Leicester',
  country: 'United Kingdom',
  intake: 'Sep 2026',
  studyLevel: 'PG',
  aggregator: 'Direct',
  masterRate: 20,
  agentRate: 15,
  diffMargin: 5,
  isFlatFee: false,
  netOrGross: 'GROSS',
};

describe('ShareRateCardModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders agency attribution for Agent user with organization', async () => {
    mockUseAuth.mockReturnValue({
      user: { displayName: 'Sarah', email: 'sarah@example.com' },
      role: 'AGENT',
      access: { role: 'AGENT', accessState: 'approved', organizationId: 'si-uk-ghana' },
      accessRequest: { requestedOrganizationName: 'SI-UK Ghana' },
    });

    render(
      <ShareRateCardModal
        rate={mockRate}
        currency="GBP"
        isOpen={true}
        onClose={vi.fn()}
      />
    );

    // Verify Modal Preview UI Attribution Badge and WhatsApp Preview both render attribution
    const matches = screen.getAllByText(/Prepared for SI-UK Ghana • By Sarah/i);
    expect(matches.length).toBeGreaterThanOrEqual(2);

    // Verify Formatted WhatsApp Text Preview contains attribution and footer line
    const whatsappPreview = screen.getByText(/BASECHAN INTERNATIONAL OFFICIAL RATE QUOTE/i);
    expect(whatsappPreview).toBeInTheDocument();
    expect(whatsappPreview.textContent).toContain('Prepared for SI-UK Ghana • By Sarah');
    expect(whatsappPreview.textContent).toContain('Verified Corporate Schedule - Basechan CMS');
  });

  it('renders user attribution for Staff/Admin user without organization', () => {
    mockUseAuth.mockReturnValue({
      user: { displayName: 'John Admin', email: 'john@basechaninternational.com' },
      role: 'ADMIN',
      access: { role: 'ADMIN', accessState: 'admin' },
      accessRequest: null,
    });

    render(
      <ShareRateCardModal
        rate={mockRate}
        currency="GBP"
        isOpen={true}
        onClose={vi.fn()}
      />
    );

    // Verify Modal Preview UI Attribution Badge and WhatsApp Preview
    const matches = screen.getAllByText(/Prepared by John Admin/i);
    expect(matches.length).toBeGreaterThanOrEqual(2);

    // Verify Formatted WhatsApp Text Preview contains user attribution
    const whatsappPreview = screen.getByText(/BASECHAN INTERNATIONAL OFFICIAL RATE QUOTE/i);
    expect(whatsappPreview).toBeInTheDocument();
    expect(whatsappPreview.textContent).toContain('Prepared by John Admin');
  });
});
