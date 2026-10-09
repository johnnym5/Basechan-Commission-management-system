import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ChatAssistantLauncher } from './ChatAssistantLauncher';

function setMedia(matches: boolean, reduced = false) {
  vi.stubGlobal('matchMedia', vi.fn((query: string) => ({ matches: query.includes('prefers-reduced-motion') ? reduced : matches, media: query, onchange: null, addListener: vi.fn(), removeListener: vi.fn(), addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn() })));
}

describe('ChatAssistantLauncher', () => {
  afterEach(() => vi.unstubAllGlobals());
  it('Chat FAB opens a right drawer on desktop', () => {
    setMedia(false);
    render(<ChatAssistantLauncher onViewDashboard={vi.fn()}><p>Chat content</p></ChatAssistantLauncher>);
    fireEvent.click(screen.getByRole('button', { name: /open chat assistant/i }));
    expect(screen.getByRole('dialog', { name: 'Chat assistant' })).toHaveAttribute('data-layout', 'desktop');
    expect(screen.getByText('Chat content')).toBeInTheDocument();
  });
  it('Chat FAB opens a modal popup on mobile', () => {
    setMedia(true);
    render(<ChatAssistantLauncher onViewDashboard={vi.fn()}><p>Chat content</p></ChatAssistantLauncher>);
    fireEvent.click(screen.getByRole('button', { name: /open chat assistant/i }));
    expect(screen.getByRole('dialog', { name: 'Chat assistant' })).toHaveAttribute('data-layout', 'mobile');
  });
  it('Escape and backdrop close and restore FAB focus', () => {
    setMedia(false);
    render(<ChatAssistantLauncher onViewDashboard={vi.fn()}><p>Chat content</p></ChatAssistantLauncher>);
    const fab = screen.getByRole('button', { name: /open chat assistant/i });
    fireEvent.click(fab);
    fireEvent.keyDown(screen.getByRole('dialog', { name: 'Chat assistant' }), { key: 'Escape' });
    expect(fab).toHaveFocus();
    fireEvent.click(fab);
    fireEvent.click(screen.getByTestId('chat-assistant-backdrop'));
    expect(fab).toHaveFocus();
  });
  it('View on dashboard closes Chat and retains active filters', () => {
    setMedia(false);
    const onViewDashboard = vi.fn();
    render(<ChatAssistantLauncher onViewDashboard={onViewDashboard}><p>Chat content</p></ChatAssistantLauncher>);
    fireEvent.click(screen.getByRole('button', { name: /open chat assistant/i }));
    fireEvent.click(screen.getByRole('button', { name: /view on dashboard/i }));
    expect(onViewDashboard).toHaveBeenCalledOnce();
    expect(screen.getByRole('button', { name: /open chat assistant/i })).toHaveFocus();
  });
});

describe('Chat Assistant panel persistence', () => {
  afterEach(() => vi.unstubAllGlobals());
  it('closing Chat preserves the composer draft', () => {
    setMedia(false);
    render(<ChatAssistantLauncher onViewDashboard={vi.fn()}><input aria-label="composer draft" defaultValue="draft text" /></ChatAssistantLauncher>);
    const fab = screen.getByRole('button', { name: /open chat assistant/i });
    fireEvent.click(fab);
    fireEvent.click(screen.getByRole('button', { name: /close chat assistant/i }));
    fireEvent.click(fab);
    expect(screen.getByRole('textbox', { name: 'composer draft' })).toHaveValue('draft text');
  });
});

describe('Chat assistant accessibility states', () => {
  afterEach(() => vi.unstubAllGlobals());
  it('reduced motion removes panel transition behavior', () => {
    setMedia(false, true);
    render(<ChatAssistantLauncher onViewDashboard={vi.fn()}><p>Assistant</p></ChatAssistantLauncher>);
    fireEvent.click(screen.getByRole('button', { name: /open chat assistant/i }));
    expect(screen.getByRole('dialog', { name: 'Chat assistant' })).toHaveAttribute('data-reduced-motion', 'true');
  });
  it('traps keyboard focus in the open panel', () => {
    setMedia(false);
    render(<ChatAssistantLauncher onViewDashboard={vi.fn()}><p>Assistant</p></ChatAssistantLauncher>);
    fireEvent.click(screen.getByRole('button', { name: /open chat assistant/i }));
    const close = screen.getByRole('button', { name: /close chat assistant/i });
    const view = screen.getByRole('button', { name: /view on dashboard/i });
    close.focus();
    fireEvent.keyDown(close, { key: 'Tab' });
    expect(view).toHaveFocus();
  });
  it('closes the panel when the account scope changes', () => {
    setMedia(false);
    const { rerender } = render(<ChatAssistantLauncher scopeKey="user-a" onViewDashboard={vi.fn()}><p>Assistant</p></ChatAssistantLauncher>);
    fireEvent.click(screen.getByRole('button', { name: /open chat assistant/i }));
    rerender(<ChatAssistantLauncher scopeKey="user-b" onViewDashboard={vi.fn()}><p>Assistant</p></ChatAssistantLauncher>);
    expect(screen.queryByRole('dialog', { name: 'Chat assistant' })).not.toBeInTheDocument();
  });
});
