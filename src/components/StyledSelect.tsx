import React, { useState, useRef, useEffect, useId } from 'react';
import { Check, ChevronDown } from 'lucide-react';

export interface SelectOption {
  value: string;
  label: string;
}

interface StyledSelectProps {
  id?: string;
  'aria-label'?: string;
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  className?: string;
  /** Max-height of the dropdown list in px. Defaults to 240. */
  maxHeight?: number;
}

/**
 * A fully-themed replacement for the native <select> element.
 * Respects Tailwind dark-mode classes, supports keyboard navigation,
 * and renders a custom popover instead of the OS-native picker.
 */
export const StyledSelect: React.FC<StyledSelectProps> = ({
  id,
  'aria-label': ariaLabel,
  value,
  onChange,
  options,
  className = '',
  maxHeight = 240,
}) => {
  const uid = useId();
  const triggerId = id ?? `styled-select-${uid}`;
  const listId = `${triggerId}-list`;

  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const [focusedIndex, setFocusedIndex] = useState<number>(-1);

  const selectedLabel = options.find((o) => o.value === value)?.label ?? value;

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [isOpen]);

  // Scroll focused item into view (guard: jsdom does not implement scrollIntoView)
  useEffect(() => {
    if (!isOpen || focusedIndex < 0) return;
    const item = listRef.current?.children[focusedIndex] as HTMLElement | undefined;
    if (item && typeof item.scrollIntoView === 'function') {
      item.scrollIntoView({ block: 'nearest' });
    }
  }, [focusedIndex, isOpen]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
        e.preventDefault();
        setIsOpen(true);
        setFocusedIndex(options.findIndex((o) => o.value === value));
      }
      return;
    }
    if (e.key === 'Escape') { setIsOpen(false); return; }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setFocusedIndex((p) => Math.min(p + 1, options.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setFocusedIndex((p) => Math.max(p - 1, 0));
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (focusedIndex >= 0) {
        onChange(options[focusedIndex].value);
        setIsOpen(false);
      }
    } else if (e.key === 'Tab') {
      setIsOpen(false);
    }
  };

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {/* Trigger button */}
      <button
        type="button"
        id={triggerId}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={listId}
        onClick={() => {
          setIsOpen((p) => !p);
          setFocusedIndex(options.findIndex((o) => o.value === value));
        }}
        onKeyDown={handleKeyDown}
        className={[
          'w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl',
          'text-xs font-medium text-left cursor-pointer',
          'bg-[#18181B] border border-[#33415d] text-white',
          'hover:border-[#4a5d7a] hover:bg-[#1e1e24]',
          'focus:outline-none focus:ring-2 focus:ring-blue-500/40',
          'transition-colors duration-150',
        ].join(' ')}
      >
        <span className="truncate">{selectedLabel}</span>
        <ChevronDown
          className={`w-3.5 h-3.5 text-slate-400 shrink-0 transition-transform duration-150 ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {/* Dropdown list */}
      {isOpen && (
        <ul
          ref={listRef}
          id={listId}
          role="listbox"
          aria-label={ariaLabel}
          style={{ maxHeight }}
          className={[
            'absolute left-0 right-0 top-full mt-1.5 z-[70]',
            'bg-[#18181B] border border-[#33415d] rounded-xl shadow-2xl',
            'overflow-y-auto py-1',
            'animate-in fade-in slide-in-from-top-1 duration-100',
          ].join(' ')}
        >
          {options.map((opt, idx) => {
            const isSelected = opt.value === value;
            const isFocused = idx === focusedIndex;
            return (
              <li
                key={opt.value}
                role="option"
                aria-selected={isSelected}
                onMouseEnter={() => setFocusedIndex(idx)}
                onClick={() => {
                  onChange(opt.value);
                  setIsOpen(false);
                }}
                className={[
                  'flex items-center justify-between gap-2 px-3 py-2 cursor-pointer text-xs font-medium select-none',
                  'transition-colors duration-75',
                  isFocused
                    ? 'bg-[#0E1526] text-white'
                    : isSelected
                    ? 'text-amber-400'
                    : 'text-slate-300 hover:bg-[#0E1526] hover:text-white',
                ].join(' ')}
              >
                <span className="truncate">{opt.label}</span>
                {isSelected && <Check className="w-3.5 h-3.5 text-amber-400 shrink-0" />}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};
