import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Plus, Check, ChevronDown } from 'lucide-react';

interface PredictiveInputProps {
  label: string;
  value: string;
  onChange: (val: string) => void;
  options: string[];
  placeholder?: string;
  required?: boolean;
  onSelectOption?: (val: string) => void;
}

export const PredictiveInput: React.FC<PredictiveInputProps> = ({
  label,
  value,
  onChange,
  options,
  placeholder,
  required = false,
  onSelectOption,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  // Clean, unique options
  const uniqueOptions = useMemo(() => {
    return Array.from(new Set(options)).filter(Boolean).sort();
  }, [options]);

  // Filtered matching options based on typed input
  const filteredOptions = useMemo(() => {
    if (!value.trim()) return uniqueOptions.slice(0, 8);
    const q = value.toLowerCase().trim();
    return uniqueOptions
      .filter((opt) => opt.toLowerCase().includes(q))
      .slice(0, 8);
  }, [uniqueOptions, value]);

  // Check if typed value matches an existing option exactly
  const exactMatch = useMemo(() => {
    const q = value.toLowerCase().trim();
    return uniqueOptions.some((opt) => opt.toLowerCase() === q);
  }, [uniqueOptions, value]);

  // Handle outside click to close dropdown
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (selectedVal: string) => {
    onChange(selectedVal);
    if (onSelectOption) onSelectOption(selectedVal);
    setIsOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        setIsOpen(true);
      }
      return;
    }

    const totalItems = filteredOptions.length + (!exactMatch && value.trim() ? 1 : 0);

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev + 1) % (totalItems || 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev - 1 + totalItems) % (totalItems || 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (highlightedIndex < filteredOptions.length) {
        handleSelect(filteredOptions[highlightedIndex]);
      } else {
        handleSelect(value.trim());
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  return (
    <div ref={containerRef} className="relative space-y-1">
      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
        {label} {required && <span className="text-rose-500">*</span>}
      </label>

      <div className="relative">
        <input
          type="text"
          value={value}
          required={required}
          onChange={(e) => {
            onChange(e.target.value);
            setIsOpen(true);
            setHighlightedIndex(0);
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="w-full pl-3 pr-8 py-2 text-xs sm:text-sm border border-slate-300 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 font-medium"
        />

        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
        >
          <ChevronDown className="w-4 h-4" />
        </button>
      </div>

      {/* Autocomplete Dropdown */}
      {isOpen && (filteredOptions.length > 0 || (!exactMatch && value.trim())) && (
        <ul className="absolute z-50 w-full mt-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl max-h-56 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800 text-xs animate-in fade-in duration-100">
          {filteredOptions.map((opt, idx) => {
            const isSelected = value.toLowerCase().trim() === opt.toLowerCase();
            const isHighlighted = highlightedIndex === idx;

            return (
              <li
                key={opt}
                onMouseDown={() => handleSelect(opt)}
                className={`px-3 py-2.5 flex items-center justify-between cursor-pointer transition ${
                  isHighlighted
                    ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-900 dark:text-emerald-200 font-semibold'
                    : 'hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200'
                }`}
              >
                <span>{opt}</span>
                {isSelected && <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />}
              </li>
            );
          })}

          {/* Option to Add New if input doesn't match existing options */}
          {!exactMatch && value.trim() && (
            <li
              onMouseDown={() => handleSelect(value.trim())}
              className={`px-3 py-2.5 flex items-center gap-2 cursor-pointer transition font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50/50 dark:bg-emerald-950/40 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 ${
                highlightedIndex === filteredOptions.length ? 'bg-emerald-100 dark:bg-emerald-900/60' : ''
              }`}
            >
              <Plus className="w-3.5 h-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
              <span>Add as new: "{value.trim()}"</span>
            </li>
          )}
        </ul>
      )}
    </div>
  );
};
