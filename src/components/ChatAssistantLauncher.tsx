import React, { useEffect, useRef, useState } from 'react';
import { MessageCircle, ArrowUpRight, X } from 'lucide-react';
import './ChatAssistantLauncher.css';

const mediaMatches = (query: string) => typeof window !== 'undefined' && (window.matchMedia?.(query).matches ?? false);

interface ChatAssistantLauncherProps {
  children: React.ReactNode;
  onViewDashboard: () => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  scopeKey?: string;
}

export const ChatAssistantLauncher: React.FC<ChatAssistantLauncherProps> = ({ children, onViewDashboard, open, onOpenChange, scopeKey }) => {
  const [internalOpen, setInternalOpen] = useState(false);
  const [hasOpened, setHasOpened] = useState(false);
  const isOpen = open ?? internalOpen;
  const setOpen = (value: boolean) => { setInternalOpen(value); if (value) setHasOpened(true); onOpenChange?.(value); };
  const [isMobile, setIsMobile] = useState(() => mediaMatches('(max-width: 767px)'));
  const [reducedMotion, setReducedMotion] = useState(() => mediaMatches('(prefers-reduced-motion: reduce)'));
  const fabRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const wasOpen = useRef(false);

  useEffect(() => {
    if (!window.matchMedia) return;
    const media = window.matchMedia('(max-width: 767px)');
    const update = () => setIsMobile(media.matches);
    media.addEventListener?.('change', update);
    return () => media.removeEventListener?.('change', update);
  }, []);

  useEffect(() => {
    if (!window.matchMedia) return;
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReducedMotion(media.matches);
    media.addEventListener?.('change', update);
    return () => media.removeEventListener?.('change', update);
  }, []);

  useEffect(() => { setOpen(false); setHasOpened(false); }, [scopeKey]);

  useEffect(() => {
    if (isOpen) {
      wasOpen.current = true;
      requestAnimationFrame(() => closeRef.current?.focus());
    } else if (wasOpen.current) {
      wasOpen.current = false;
      fabRef.current?.focus();
    }
  }, [isOpen]);

  const onPanelKeyDown = (event: React.KeyboardEvent<HTMLElement>) => {
    if (event.key === 'Escape') { event.preventDefault(); setOpen(false); return; }
    if (event.key !== 'Tab' || !panelRef.current) return;
    const focusable = Array.from(panelRef.current.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'));
    if (!focusable.length) { event.preventDefault(); panelRef.current.focus(); return; }
    const first = focusable[0]; const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  };

  return <>
    <button ref={fabRef} type="button" aria-label="Open chat assistant" aria-expanded={isOpen} onClick={() => setOpen(true)} className="chat-assistant-fab">
      <MessageCircle aria-hidden="true" className="h-5 w-5" /><span>Chat</span>
    </button>
    <div className={`chat-assistant-overlay${isOpen ? ' is-open' : ''}`} data-testid="chat-assistant-backdrop" hidden={!isOpen} onClick={event => { if (event.target === event.currentTarget) setOpen(false); }}>
      <section ref={panelRef} role="dialog" aria-modal="true" aria-label="Chat assistant" data-layout={isMobile ? 'mobile' : 'desktop'} data-reduced-motion={reducedMotion} tabIndex={-1} onKeyDown={onPanelKeyDown} className="chat-assistant-panel">
        <header className="chat-assistant-toolbar">
          <div><p className="text-[10px] font-bold uppercase tracking-[.16em] text-blue-300">Basechan assistant</p><h2 className="text-base font-extrabold text-white">Chat</h2></div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => { setOpen(false); onViewDashboard(); }} className="chat-assistant-view-button"><ArrowUpRight className="h-4 w-4" /><span>View on dashboard</span></button>
            <button ref={closeRef} type="button" onClick={() => setOpen(false)} aria-label="Close chat assistant" className="chat-assistant-close"><X className="h-5 w-5" /></button>
          </div>
        </header>
        <div className="chat-assistant-content">{hasOpened && children}</div>
      </section>
    </div>
  </>;
};
